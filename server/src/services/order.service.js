import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, ProductType } from '../constants/enums.js';
import Order from '../models/order.model.js';
import whatsappService from './whatsapp.service.js';
import escrowManager from './EscrowManager.js';

class OrderService {
  /**
   * Create a new order with fee calculations and status determination
   */
  static async createOrder(orderData) {
    const client = await pool.connect();
    try {
      const {
        buyerId,
        sellerId,
        paymentMethod,
        buyerName,
        buyerEmail,
        buyerPhone, // older code might still pass this
        buyerMobilePayment,
        buyerWhatsApp,
        shippingAddress,
        notes,
        metadata = {}
      } = orderData;

      logger.info('OrderService: Starting order creation', { buyerId, sellerId });
      await client.query('BEGIN');

      // 1. Verify seller exists and is active
      const sellerCheck = await client.query(
        'SELECT id FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
        [sellerId, 'active']
      );

      if (sellerCheck.rows.length === 0) {
        throw new Error(`Seller with ID ${sellerId} not found or inactive`);
      }

      // 2. Process and validate order items
      const items = metadata.items || [];
      this._validateItems(items);

      // 3. Calculate totals and fees
      const { totalAmount, platformFee, sellerPayout } = this._calculateTotals(items);
      logger.info(`Calculated totals - Total: ${totalAmount}, Fee: ${platformFee}, Payout: ${sellerPayout}`);

      // 4. Enrich items with product type for status determination
      const productIds = items.map(item => parseInt(item.productId, 10));
      const productsResult = await client.query(
        'SELECT id, product_type::text as product_type, is_digital, service_options FROM products WHERE id = ANY($1)',
        [productIds]
      );
      const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

      items.forEach(item => {
        const prod = productsMap.get(parseInt(item.productId, 10));
        if (prod) {
          item.productType = prod.product_type;
          item.isDigital = prod.is_digital;

          // Robustness: Infer 'service' type if missing but has service options
          if (!item.productType && prod.service_options) {
            item.productType = ProductType.SERVICE;
          }
        }
      });

      // Shopless Service Logic: If seller has no shop_id and product is service, ensure location_type is set
      if (!sellerInfo.shop_id) {
        const hasService = items.some(i => i.productType === ProductType.SERVICE || i.productType === 'service');
        if (hasService && !metadata.location_type) {
          metadata.location_type = 'Virtual/Online';
        }
      }

      logger.info('OrderService: items enriched', {
        items: items.map(i => ({ id: i.productId, type: i.productType, digital: i.isDigital }))
      });

      // 5. Determine initial status
      const initialStatus = this._determineInitialStatus(items);
      logger.info(`OrderService: initial status determined: ${initialStatus}`);

      // 5. Prepare Order Record
      const orderRecord = {
        buyer_id: buyerId,
        seller_id: sellerId,
        total_amount: totalAmount,
        platform_fee_amount: platformFee,
        seller_payout_amount: sellerPayout,
        payment_method: paymentMethod,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_mobile_payment: buyerMobilePayment || buyerPhone,
        buyer_whatsapp_number: buyerWhatsApp || buyerPhone,
        shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
        notes: notes,
        metadata: JSON.stringify(metadata),
        status: initialStatus,
        payment_status: 'pending', // Default
        service_requirements: metadata.service_requirements || null
      };

      // 6. Insert Order (Using Model as DAO)
      // We will create a new 'create' method in Order model that is pure INSERT
      const order = await Order.insert(client, orderRecord);

      // 7. Insert Order Items (Using Model as DAO)
      if (items.length > 0) {
        // Pass the enriched items (with productType/isDigital) to avoid redundant queries in Model
        await Order.insertItems(client, order.id, items);
      }

      await client.query('COMMIT');
      logger.info(`OrderService: Order ${order.id} created successfully`);

      // 8. Notification removed from here - moved to completeOrder to ensure payment success first

      return order;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('OrderService: Error creating order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update order status with transition validation
   */
  static async updateOrderStatus(orderId, user, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch Order and Lock
      const lockResult = await client.query(
        `SELECT id FROM product_orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      if (lockResult.rows.length === 0) throw new Error('Order not found');

      const orderResult = await client.query(
        `SELECT * FROM product_orders WHERE id = $1`,
        [orderId]
      );
      const order = orderResult.rows[0];

      // 2. Permission Check
      // Strategy 1: User is acting as Seller and matches the order's seller_id
      const isProfileMatch = (user.userType === 'seller' || user.role === 'seller') && order.seller_id === user.id;

      // Strategy 2: User owns the Seller Account (Unified ID check)
      // This handles cases where user is logged in as 'buyer' but owns the seller account
      let isUnifiedMatch = false;
      if (!isProfileMatch) {
        const sellerCheck = await client.query('SELECT user_id FROM sellers WHERE id = $1', [order.seller_id]);
        if (sellerCheck.rows.length > 0 && sellerCheck.rows[0].user_id === user.userId) {
          isUnifiedMatch = true;
        }
      }

      if (!isProfileMatch && !isUnifiedMatch) {
        throw new Error('Unauthorized: You can only update your own orders');
      }

      // 3. Validate Status Transition
      const validTransitions = {
        [OrderStatus.PENDING]: [OrderStatus.DELIVERY_PENDING, OrderStatus.CANCELLED],
        [OrderStatus.SERVICE_PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED], // Added Service flow
        [OrderStatus.DELIVERY_PENDING]: [OrderStatus.DELIVERY_COMPLETE, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERY_COMPLETE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.FAILED]: []
      };

      const currentStatus = order.status || OrderStatus.PENDING;
      const newStatus = status;

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }

      // 4. Determine side-effects (payment status updates)
      let paymentStatus = order.payment_status;
      if (newStatus === OrderStatus.COMPLETED && order.payment_status === 'pending') {
        paymentStatus = 'completed';
      } else if (newStatus === OrderStatus.CANCELLED && order.payment_status === 'pending') {
        paymentStatus = 'cancelled';
      }

      // 5. Update Order
      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, newStatus, paymentStatus);

      // 6. Handle Seller Payout if Completed
      if (newStatus === OrderStatus.COMPLETED && currentStatus !== OrderStatus.COMPLETED) {
        await this._processSellerPayout(client, updatedOrder);
      }

      await client.query('COMMIT');

      // 7. Send Notification
      try {
        const fullOrderResult = await pool.query(
          `SELECT o.*, 
                  b.full_name as buyer_name_actual, b.mobile_payment as buyer_phone_actual, b.whatsapp_number as buyer_whatsapp_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.whatsapp_number as seller_phone, s.email as seller_email, 
                  s.physical_address as seller_address, s.latitude as seller_latitude, s.longitude as seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           WHERE o.id = $1`,
          [orderId]
        );

        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];
          const buyerData = {
            name: fullOrder.buyer_name || fullOrder.buyer_name_actual,
            phone: fullOrder.buyer_mobile_payment || fullOrder.buyer_phone_actual,
            whatsapp_number: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp_actual,
            email: fullOrder.buyer_email || fullOrder.buyer_email_actual
          };
          const sellerData = {
            name: fullOrder.seller_name,
            phone: fullOrder.seller_phone,
            email: fullOrder.seller_email,
            physicalAddress: fullOrder.seller_address,
            latitude: fullOrder.seller_latitude,
            longitude: fullOrder.seller_longitude
          };

          const notificationPayload = {
            buyer: buyerData,
            seller: sellerData,
            order: {
              orderNumber: fullOrder.order_number,
              totalAmount: fullOrder.total_amount,
              status: newStatus,
              metadata: fullOrder.metadata
            },
            oldStatus: currentStatus,
            newStatus: newStatus,
            notes: 'Status updated by seller'
          };

          whatsappService.notifyBuyerStatusUpdate(notificationPayload)
            .catch(err => logger.error('Error sending status update notification:', err));
        }
      } catch (e) {
        logger.error('Error sending status notification:', e);
      }

      return updatedOrder;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel an order and handle inventory restoration and buyer refund tracking
   */
  static async cancelOrder(orderId, reason = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch Order
      const orderQuery = 'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE';
      const orderResult = await client.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) throw new Error('Order not found');
      const order = orderResult.rows[0];

      // 2. Validate Status
      if (order.status === OrderStatus.COMPLETED) throw new Error('Cannot cancel a completed order');
      if (order.status === OrderStatus.CANCELLED) throw new Error('Order is already cancelled');

      // 3. Update Status
      const updatedOrder = await Order.updateStatusWithReason(client, orderId, OrderStatus.CANCELLED, reason);

      if (updatedOrder) {
        // 4. Update Buyer Refunds (Track cumulative refunds)
        const refundAmount = parseFloat(order.total_amount);
        await client.query(
          `UPDATE buyers 
           SET refunds = COALESCE(refunds, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [refundAmount, order.buyer_id]
        );
      }

      await client.query('COMMIT');

      // 6. Send Notification
      try {
        const fullOrderResult = await pool.query(
          `SELECT o.*, 
                  b.full_name as buyer_name_actual, b.mobile_payment as buyer_phone_actual, b.whatsapp_number as buyer_whatsapp_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.whatsapp_number as seller_phone, s.email as seller_email, s.physical_address as seller_address
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           WHERE o.id = $1`,
          [orderId]
        );

        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];

          // Prepare minimal data for notification helper
          const orderData = {
            id: fullOrder.id,
            order_id: fullOrder.order_number || fullOrder.id, // match helper expectation
            total_amount: fullOrder.total_amount,
            amount: fullOrder.total_amount,
            buyer_mobile_payment: fullOrder.buyer_mobile_payment || fullOrder.buyer_phone_actual,
            buyer_whatsapp_number: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp_actual,
            phone: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp_actual,
            // We might need items for detailed notification?
            // Helper likely expects items. But we don't have them in 'fullOrder' unless we join.
            // Let's rely on basic info for now or fetch items.
            // fetching items is better.
          };

          // Fetch items for better notification
          const itemsResult = await pool.query('SELECT product_name, quantity, product_price FROM order_items WHERE order_id = $1', [orderId]);
          orderData.items = itemsResult.rows.map(i => ({
            product_name: i.product_name,
            quantity: i.quantity,
            product_price: i.product_price
          }));

          const buyer = {
            full_name: fullOrder.buyer_name || fullOrder.buyer_name_actual,
            phone: fullOrder.buyer_phone || fullOrder.buyer_phone_actual, // Use normalized if possible
            email: fullOrder.buyer_email || fullOrder.buyer_email_actual
          };

          const seller = {
            id: fullOrder.seller_id,
            full_name: fullOrder.seller_name,
            phone: fullOrder.seller_phone,
            shop_name: fullOrder.seller_name // fallback
          };

          // Notify Buyer "You cancelled"
          whatsappService.sendBuyerOrderCancellationNotification(orderData, 'Buyer')
            .catch(err => logger.error('Error sending buyer cancellation notification:', err));

          // Notify Seller "Buyer cancelled"
          whatsappService.sendSellerOrderCancellationNotification(orderData, seller, 'Buyer')
            .catch(err => logger.error('Error sending seller cancellation notification:', err));
        }
      } catch (e) {
        logger.error('Error sending cancellation notifications:', e);
      }

      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // --- Private Helpers ---

  static _validateItems(items) {
    items.forEach((item, index) => {
      if (typeof item.price !== 'number' || isNaN(item.price) || item.price <= 0) {
        throw new Error(`Invalid price for item at index ${index}`);
      }
      if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.productId}`);
      }
    });
  }

  static _calculateTotals(items) {
    const totalAmount = items.reduce((sum, item) => {
      const subtotal = item.subtotal || (item.price * item.quantity);
      return sum + subtotal;
    }, 0);

    const platformFee = parseFloat((totalAmount * Fees.PLATFORM_COMMISSION_RATE).toFixed(2));
    const sellerPayout = parseFloat((totalAmount - platformFee).toFixed(2));

    return { totalAmount, platformFee, sellerPayout };
  }

  static _determineInitialStatus(items) {
    let initialStatus = OrderStatus.PENDING;

    const hasPhysical = items.some(item => item.productType === ProductType.PHYSICAL || (!item.productType && !item.isDigital));
    const hasService = items.some(item => item.productType === ProductType.SERVICE);
    const isServiceOnly = hasService && !hasPhysical;

    if (isServiceOnly) {
      initialStatus = OrderStatus.SERVICE_PENDING;
    }
    return initialStatus;
  }


  /**
   * Complete an order after successful payment
   */
  static async completeOrder(payment) {
    const client = await pool.connect();
    try {
      const { metadata = {} } = payment;
      const orderId = metadata.order_id;

      if (!orderId) throw new Error('No order_id found in payment metadata');

      await client.query('BEGIN');

      // 1. Fetch Order
      const orderResult = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      if (orderResult.rows.length === 0) throw new Error('Order not found');
      const order = orderResult.rows[0];

      // 2. Idempotency Check
      if (order.status === OrderStatus.COMPLETED && order.payment_status === 'completed') {
        await client.query('ROLLBACK');
        return { success: true, message: 'Order already completed' };
      }

      // 3. Mark as Paid & Completed
      // Logic from PaymentCompletionService: 
      // Physical -> DELIVERY_PENDING (usually, or just COMPLETED for simplicity if no shipping logic yet?)
      // Service -> CONFIRMED
      // Digital -> COMPLETED
      // The original code checked items. Let's replicate that logic smarty.

      const itemsQuery = `
        SELECT oi.*, p.product_type::text as product_type, p.is_digital, p.service_options
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [orderId]);
      const items = itemsResult.rows;

      // Fetch Seller to check for Shop Address
      const { rows: sellers } = await client.query('SELECT physical_address FROM sellers WHERE id = $1', [order.seller_id]);
      const sellerHasShop = sellers.length > 0 && !!sellers[0].physical_address;

      // Enrich product type if missing but service_options exist
      items.forEach(i => {
        if (!i.product_type && i.service_options) {
          i.product_type = ProductType.SERVICE;
          logger.info(`[OrderService] Inferred SERVICE type for item ${i.product_id}`);
        }
      });

      let hasPhysical = items.some(i => i.product_type === ProductType.PHYSICAL);
      let hasService = items.some(i => i.product_type === ProductType.SERVICE);

      // Fallback logic for metadata if product/type missing (e.g. deleted product)
      if (!hasPhysical && !hasService && metadata.product_type) {
        if (metadata.product_type === ProductType.PHYSICAL) hasPhysical = true;
        if (metadata.product_type === ProductType.SERVICE) hasService = true;
      }

      logger.info(`[PURCHASE-FLOW] CompleteOrder Check: hasPhysical=${hasPhysical}, hasService=${hasService}, ItemsCount=${items.length}`);

      let newStatus = OrderStatus.COMPLETED;
      if (hasPhysical) {
        if (sellerHasShop) {
          newStatus = OrderStatus.COLLECTION_PENDING;
        } else {
          newStatus = OrderStatus.DELIVERY_PENDING;
        }
      } else if (hasService) {
        newStatus = OrderStatus.SERVICE_PENDING;
        logger.info(`[PURCHASE-FLOW] Service Order Detected -> Setting Status to SERVICE_PENDING`);
      }

      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, newStatus, 'completed', payment.provider_reference);

      logger.info(`[PURCHASE-FLOW] 8a. Order Status Updated to: ${newStatus}, Payment Status: completed, Shop Detected: ${sellerHasShop}`, {
        orderId, newStatus
      });

      // Check if we accidentally auto-completed it (e.g. digital) - handle payout?
      // Digital usually goes to COMPLETED immediately.
      if (newStatus === OrderStatus.COMPLETED) {
        logger.info(`[PURCHASE-FLOW] 8b. Auto-completing Order (Digital/Collection), Processing Payout...`);
        await this._processSellerPayout(client, updatedOrder);
      }

      // 4. Update Payment Metadata
      await client.query(
        `UPDATE payments 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb), 
           '{order_completed_at}', 
           to_jsonb(NOW())
         )
         WHERE id = $1`,
        [payment.id]
      );

      await client.query('COMMIT');

      // Trigger Notifications (WhatsApp/Email)
      try {
        // Fetch full order details with buyer and seller for notification
        const fullOrderResult = await pool.query(
          `SELECT o.*, 
                  b.full_name as buyer_name_actual, b.mobile_payment as buyer_phone_actual, b.whatsapp_number as buyer_whatsapp_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.whatsapp_number as seller_phone, s.email as seller_email, 
                  s.physical_address as seller_address, s.shop_name, s.latitude as seller_latitude, s.longitude as seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           WHERE o.id = $1`,
          [orderId]
        );

        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];
          const buyerData = {
            name: fullOrder.buyer_name || fullOrder.buyer_name_actual,
            phone: fullOrder.buyer_mobile_payment || fullOrder.buyer_phone_actual,
            whatsapp_number: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp_actual,
            email: fullOrder.buyer_email || fullOrder.buyer_email_actual
          };
          const sellerData = {
            name: fullOrder.seller_name,
            phone: fullOrder.seller_phone,
            email: fullOrder.seller_email,
            physicalAddress: fullOrder.seller_address,
            shop_name: fullOrder.shop_name,
            latitude: fullOrder.seller_latitude,
            longitude: fullOrder.seller_longitude
          };

          const notificationPayload = {
            buyer: buyerData,
            seller: sellerData,
            order: {
              orderNumber: fullOrder.order_number,
              totalAmount: fullOrder.total_amount,
              status: newStatus,
              metadata: fullOrder.metadata,
              service_requirements: fullOrder.service_requirements
            },
            items: items
          };


          logger.info(`[PURCHASE-FLOW] 9b. Sending Order Confirmation to Buyer ${buyerData.phone || 'NO_PHONE'}`);
          whatsappService.notifyBuyerOrderConfirmation(notificationPayload)
            .then(() => logger.info(`[PURCHASE-FLOW] 9c. Buyer confirmation sent successfully`))
            .catch(err => logger.error('Error sending buyer confirmation:', err));



          // Notify Seller of New Order (now that payment is confirmed)
          logger.info(`[PURCHASE-FLOW] 9d. Sending New Order Notification to Seller ${sellerData.phone || 'NO_PHONE'}`);
          logger.info(`[PURCHASE-FLOW] 9d-DEBUG. Seller Data:`, JSON.stringify(sellerData, null, 2));
          logger.info(`[PURCHASE-FLOW] 9d-DEBUG. Order Data:`, JSON.stringify(notificationPayload.order, null, 2));
          logger.info(`[PURCHASE-FLOW] 9d-DEBUG. Items:`, JSON.stringify(items, null, 2));

          whatsappService.notifySellerNewOrder({
            seller: sellerData,
            buyer: buyerData,
            order: notificationPayload.order,
            items: items
          })
            .then(() => logger.info(`[PURCHASE-FLOW] 9e. ✅ Seller notification sent successfully to ${sellerData.phone}`))
            .catch(err => {
              logger.error(`[PURCHASE-FLOW] 9e. ❌ Error sending seller new order notification to ${sellerData.phone}:`, err);
              logger.error(`[PURCHASE-FLOW] 9e. Error stack:`, err.stack);
            });
        }
      } catch (e) {
        logger.error('Error triggering completion notifications:', e);
      }

      return { success: true, orderId, newStatus };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  static async _processSellerPayout(client, order) {
    return await escrowManager.releaseFunds(client, order, 'OrderService');
  }

  /**
   * Buyer marks order as collected
   */
  static async markAsCollected(orderId, buyerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch Order and lock
      const orderQuery = 'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE';
      const orderResult = await client.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) throw new Error('Order not found');
      const order = orderResult.rows[0];

      // 2. Validate Ownership & Status
      if (order.buyer_id !== buyerId) {
        throw new Error('Unauthorized: You can only update your own orders');
      }

      if (order.status !== OrderStatus.COLLECTION_PENDING) {
        throw new Error('Order is not ready for collection or already collected');
      }

      // 3. Update Status
      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, OrderStatus.COMPLETED, 'completed');

      // 4. Process Payout
      await this._processSellerPayout(client, updatedOrder);

      await client.query('COMMIT');

      // 5. Send Notification
      try {
        // Re-fetch order details or reuse
        const fullOrderResult = await pool.query(
          `SELECT o.*, 
                  b.full_name as buyer_name_actual, b.mobile_payment as buyer_phone_actual, b.whatsapp_number as buyer_whatsapp_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.whatsapp_number as seller_phone, s.email as seller_email, s.physical_address as seller_address, s.latitude as seller_latitude, s.longitude as seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           WHERE o.id = $1`,
          [orderId]
        );

        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];
          const buyerData = {
            name: fullOrder.buyer_name || fullOrder.buyer_name_actual,
            phone: fullOrder.buyer_phone || fullOrder.buyer_phone_actual,
            email: fullOrder.buyer_email || fullOrder.buyer_email_actual
          };
          const sellerData = {
            name: fullOrder.seller_name,
            phone: fullOrder.seller_phone,
            email: fullOrder.seller_email,
            physicalAddress: fullOrder.seller_address,
            latitude: fullOrder.seller_latitude,
            longitude: fullOrder.seller_longitude
          };

          const notificationPayload = {
            buyer: buyerData,
            seller: sellerData,
            order: {
              orderNumber: fullOrder.order_number,
              totalAmount: fullOrder.total_amount,
              status: OrderStatus.COMPLETED,
              metadata: fullOrder.metadata
            },
            oldStatus: OrderStatus.COLLECTION_PENDING,
            newStatus: OrderStatus.COMPLETED,
            notes: 'Order collected by buyer'
          };

          whatsappService.notifySellerStatusUpdate(notificationPayload) // Notify Seller their item was collected
            .catch(err => logger.error('Error sending collection notification to seller:', err));

          whatsappService.notifyBuyerStatusUpdate(notificationPayload) // Notify Buyer "Thanks for collecting"
            .catch(err => logger.error('Error sending collection notification to buyer:', err));
        }
      } catch (e) {
        logger.error('Error sending collection notifications:', e);
      }

      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Buyer confirms receipt of shipped/delivery order
   */
  static async confirmOrderReceipt(orderId, buyerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderQuery = 'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE';
      const orderResult = await client.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) throw new Error('Order not found');
      const order = orderResult.rows[0];

      if (order.buyer_id !== buyerId) {
        throw new Error('Unauthorized: You can only update your own orders');
      }

      // Allow if shipped, delivered, or pending (if stuck)
      const allowedStatuses = [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.PENDING, OrderStatus.DELIVERY_PENDING, 'delivery_pending']; // Add loose check
      if (!allowedStatuses.includes(order.status)) {
        throw new Error(`Cannot confirm receipt for order in ${order.status} status`);
      }

      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, OrderStatus.COMPLETED, 'completed');
      await this._processSellerPayout(client, updatedOrder);

      await client.query('COMMIT');

      // Notification logic (simplified)
      try {
        // notify seller
      } catch (e) {
        logger.error('Error sending confirmation notification:', e);
      }

      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default OrderService;
