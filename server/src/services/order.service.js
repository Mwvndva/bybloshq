import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, ProductType } from '../constants/enums.js';
import Order from '../models/order.model.js';
import whatsappService from './whatsapp.service.js';

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
        buyerPhone,
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

      // 4. Determine initial status
      const initialStatus = this._determineInitialStatus(items);

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
        buyer_phone: buyerPhone,
        shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
        notes: notes,
        metadata: JSON.stringify(metadata),
        status: initialStatus,
        payment_status: 'pending' // Default
      };

      // 6. Insert Order (Using Model as DAO)
      // We will create a new 'create' method in Order model that is pure INSERT
      const order = await Order.insert(client, orderRecord);

      // 7. Insert Order Items (Using Model as DAO)
      if (items.length > 0) {
        await Order.insertItems(client, order.id, items);
      }

      await client.query('COMMIT');
      logger.info(`OrderService: Order ${order.id} created successfully`);

      // 8. Send Notification (Non-blocking)
      try {
        const sellerInfo = await pool.query('SELECT phone, email, full_name FROM sellers WHERE id = $1', [sellerId]);
        if (sellerInfo.rows.length > 0) {
          whatsappService.notifySellerNewOrder({
            seller: {
              phone: sellerInfo.rows[0].phone,
              name: sellerInfo.rows[0].full_name,
              email: sellerInfo.rows[0].email
            },
            order: {
              order_number: order.order_number,
              total_amount: totalAmount,
              status: initialStatus,
              metadata: metadata
            },
            items: items
          }).catch(err => logger.error('Error sending new order notification:', err));
        }
      } catch (notifyError) {
        logger.error('Error preparing notification data:', notifyError);
      }

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
  static async updateOrderStatus(orderId, userId, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock and Fetch Order
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
      if (order.seller_id !== userId) {
        throw new Error('Unauthorized: You can only update your own orders');
      }

      // 3. Validate Status Transition
      const validTransitions = {
        [OrderStatus.PENDING]: [OrderStatus.DELIVERY_PENDING, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERY_PENDING]: [OrderStatus.DELIVERY_COMPLETE, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERY_COMPLETE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.SERVICE_PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
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
                  b.full_name as buyer_name_actual, b.phone as buyer_phone_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.phone as seller_phone, s.email as seller_email, 
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
                  b.full_name as buyer_name_actual, b.phone as buyer_phone_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.phone as seller_phone, s.email as seller_email, s.physical_address as seller_address
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
            buyer_phone: fullOrder.buyer_phone || fullOrder.buyer_phone_actual,
            phone: fullOrder.buyer_phone || fullOrder.buyer_phone_actual,
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
        SELECT oi.*, p.product_type::text as product_type, p.is_digital
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [orderId]);
      const items = itemsResult.rows;

      let hasPhysical = items.some(i => i.product_type === ProductType.PHYSICAL);
      let hasService = items.some(i => i.product_type === ProductType.SERVICE);
      // Check for Service Locations (Shop Address) in metadata
      let hasShopAddress = items.some(i => i.metadata?.serviceLocations && i.metadata.serviceLocations.length > 0);

      // Fallback logic for metadata if product/type missing
      if (!items.length && metadata.product_type) {
        if (metadata.product_type === ProductType.PHYSICAL) hasPhysical = true;
        if (metadata.product_type === ProductType.SERVICE) hasService = true;
      }

      let newStatus = OrderStatus.COMPLETED;
      if (hasPhysical) {
        if (hasShopAddress) {
          newStatus = OrderStatus.COLLECTION_PENDING;
        } else {
          newStatus = OrderStatus.DELIVERY_PENDING;
        }
      } else if (hasService) {
        newStatus = OrderStatus.CONFIRMED;
      }

      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, newStatus, 'completed', payment.provider_reference);

      logger.info(`[PURCHASE-FLOW] 8a. Order Status Updated to: ${newStatus}, Payment Status: completed`, {
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
                  b.full_name as buyer_name_actual, b.phone as buyer_phone_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.phone as seller_phone, s.email as seller_email, s.physical_address as seller_address
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
              status: newStatus,
              metadata: fullOrder.metadata
            },
            items: items
          };

          whatsappService.notifyBuyerOrderConfirmation(notificationPayload)
            .catch(err => logger.error('Error sending buyer confirmation:', err));

          // Also notify seller of payment success? 
          // notifyBuyerOrderConfirmation usually sends to Buyer. 
          // notifySellerNewOrder was sent at creation. 
          // Maybe notifySellerStatusUpdate?
          whatsappService.notifySellerStatusUpdate({
            ...notificationPayload,
            oldStatus: OrderStatus.PENDING,
            newStatus: newStatus,
            notes: 'Payment Received'
          }).catch(err => logger.error('Error sending seller payment notification:', err));
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
    // Ensure we haven't paid out for this order yet to be idempotent
    // Check if payout_processed flag exists in metadata? Or trust the status transition?
    // Status transition check (in caller) + Transaction lock is reasonably safe.
    // But let's add a metadata flag for extra safety.

    const orderCheck = await client.query("SELECT metadata FROM product_orders WHERE id = $1", [order.id]);
    const currentMeta = orderCheck.rows[0]?.metadata || {};

    if (currentMeta.payout_processed) {
      logger.info(`Payout for Order ${order.id} already processed. Skipping.`);
      return;
    }

    const payoutAmount = parseFloat(order.seller_payout_amount);
    const totalAmount = parseFloat(order.total_amount || 0);

    if (payoutAmount > 0) {
      await client.query(
        `UPDATE sellers 
         SET 
           balance = balance + $1,
           net_revenue = net_revenue + $1,
           total_sales = total_sales + $2
         WHERE id = $3`,
        [payoutAmount, totalAmount, order.seller_id]
      );

      // Harmonize with DB Trigger:
      // The trigger 'handle_order_completion' creates a payout record with status 'pending' on order completion.
      // Since we just updated the balance, we should mark that payout as 'completed'.
      await client.query(
        `UPDATE payouts 
         SET status = 'completed', 
             processed_at = NOW(),
             completed_at = NOW(), 
             metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{processed_by_service}', '"OrderService"'::jsonb)
         WHERE order_id = $1`,
        [order.id]
      );

      // Mark as processed in Order Metadata (Legacy/Extra Safety)
      await client.query(
        `UPDATE product_orders 
             SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{payout_processed}', 'true'::jsonb)
             WHERE id = $1`,
        [order.id]
      );

      logger.info(`[PURCHASE-FLOW] 8c. Processed payout of KES ${payoutAmount} to Seller ${order.seller_id} for Order ${order.id}`);
    }
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
                  b.full_name as buyer_name_actual, b.phone as buyer_phone_actual, b.email as buyer_email_actual,
                  s.full_name as seller_name, s.phone as seller_phone, s.email as seller_email, s.physical_address as seller_address, s.latitude as seller_latitude, s.longitude as seller_longitude
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
}

export default OrderService;
