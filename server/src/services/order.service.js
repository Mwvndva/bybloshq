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
    let sellerInfo = null;
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
      try {
        // First try to get basic seller info that should definitely exist
        let sellerCheck;
        try {
          sellerCheck = await client.query(
            'SELECT id, user_id, physical_address, status FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
            [sellerId, 'active']
          );
        } catch (schemaError) {
          // If even basic columns don't exist, try minimal query
          logger.warn('Seller schema issue, trying minimal query:', schemaError);
          sellerCheck = await client.query(
            'SELECT id, user_id FROM sellers WHERE id = $1 FOR UPDATE',
            [sellerId]
          );
        }

        if (sellerCheck.rows.length === 0) {
          throw new Error(`Seller with ID ${sellerId} not found or inactive`);
        }

        sellerInfo = sellerCheck.rows[0];

        // Always fetch user details since sellers table might not have the contact info
        if (sellerInfo.user_id) {
          const userCheck = await client.query(
            'SELECT id, email, role FROM users WHERE id = $1',
            [sellerInfo.user_id]
          );

          if (userCheck.rows.length > 0) {
            const userInfo = userCheck.rows[0];

            // Map user info to sellerInfo structure expected by the rest of the code
            sellerInfo.full_name = userInfo.role === 'seller' ? 'Seller' : userInfo.email; // Fallback name
            sellerInfo.email = userInfo.email;
            sellerInfo.whatsapp_number = null; // Will be set later if available

            // Try to get additional contact info from buyers table (some sellers might have buyer records too)
            try {
              const buyerContactCheck = await client.query(
                'SELECT full_name, whatsapp_number FROM buyers WHERE user_id = $1 LIMIT 1',
                [sellerInfo.user_id]
              );

              if (buyerContactCheck.rows.length > 0) {
                const buyerInfo = buyerContactCheck.rows[0];
                sellerInfo.full_name = sellerInfo.full_name || buyerInfo.full_name;
                sellerInfo.whatsapp_number = sellerInfo.whatsapp_number || buyerInfo.whatsapp_number;
              }
            } catch (buyerError) {
              logger.debug('Could not fetch buyer contact info:', buyerError);
            }
          }
        }

        // Ensure 'name' is available for notifications
        sellerInfo.name = sellerInfo.full_name || 'Unknown Seller';

      } catch (err) {
        logger.error(`Error fetching seller info for ID ${sellerId}:`, err);
        throw err;
      }

      // 2. Process and validate order items
      const items = metadata.items || [];
      this._validateItems(items);

      // 3. Calculate totals and fees
      const { totalAmount, platformFee, sellerPayout } = this._calculateTotals(items);
      logger.info(`Calculated totals - Total: ${totalAmount}, Fee: ${platformFee}, Payout: ${sellerPayout}`);

      // 4. Enrich items with product type and inventory data
      const productIds = items.map(item => parseInt(item.productId, 10));
      const productsResult = await client.query(
        'SELECT id, product_type::text as product_type, is_digital, service_options, track_inventory, quantity FROM products WHERE id = ANY($1)',
        [productIds]
      );
      const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

      items.forEach(item => {
        const prod = productsMap.get(parseInt(item.productId, 10));
        if (prod) {
          item.productType = prod.product_type;
          item.isDigital = prod.is_digital;
          item.trackInventory = prod.track_inventory;
          item.availableQuantity = prod.quantity;

          // Robustness: Infer 'service' type if missing but has service options
          if (!item.productType && prod.service_options) {
            item.productType = ProductType.SERVICE;
          }
        }
      });

      // 4b. INVENTORY CHECK: Verify stock availability for tracked products
      for (const item of items) {
        if (item.trackInventory === true) {
          const requestedQty = item.quantity || 1;

          if (item.availableQuantity === null || item.availableQuantity === undefined) {
            throw new Error(`Product "${item.name || item.productId}" has inventory tracking enabled but no quantity set`);
          }

          if (item.availableQuantity < requestedQty) {
            throw new Error(`Insufficient stock for "${item.name || item.productId}". Available: ${item.availableQuantity}, Requested: ${requestedQty}`);
          }

          if (item.availableQuantity === 0) {
            throw new Error(`Product "${item.name || item.productId}" is out of stock`);
          }
        }
      }

      // Shopless Service Logic: If seller has no physical_address and product is service, ensure location_type is set
      if (!sellerInfo.physical_address) {
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
        [OrderStatus.PENDING]: [OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.CANCELLED],
        [OrderStatus.SERVICE_PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERY_PENDING]: [OrderStatus.DELIVERY_COMPLETE, OrderStatus.CANCELLED],
        [OrderStatus.COLLECTION_PENDING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Buyer picks up -> Complete
        [OrderStatus.DELIVERY_COMPLETE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.FAILED]: []
      };

      const currentStatus = order.status || OrderStatus.PENDING;
      const newStatus = status;

      logger.info(`[OrderService] Status transition requested: ${currentStatus} -> ${newStatus} for Order #${order.order_number}`);

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        logger.error(`[OrderService] Invalid status transition blocked: ${currentStatus} -> ${newStatus}`);
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }

      logger.info(`[OrderService] Status transition validated: ${currentStatus} -> ${newStatus}`);

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
                  COALESCE(s.full_name, u.email, 'Unknown Seller') as seller_name, 
                  COALESCE(s.whatsapp_number, NULL) as seller_phone, 
                  COALESCE(s.email, u.email) as seller_email, 
                  s.physical_address as seller_address, s.latitude as seller_latitude, s.longitude as seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           LEFT JOIN users u ON s.user_id = u.id
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
    // Determine product types in the order
    const hasPhysical = items.some(item => item.productType === ProductType.PHYSICAL || (!item.productType && !item.isDigital));
    const hasDigital = items.some(item => item.productType === ProductType.DIGITAL || item.isDigital);
    const hasService = items.some(item => item.productType === ProductType.SERVICE);

    // Digital-only orders start as PENDING (will auto-complete after payment)
    // Service-only orders start as SERVICE_PENDING (requires seller confirmation)
    // Physical orders start as PENDING (will transition based on shop availability)
    let initialStatus = OrderStatus.PENDING;

    const isServiceOnly = hasService && !hasPhysical && !hasDigital;
    if (isServiceOnly) {
      initialStatus = OrderStatus.SERVICE_PENDING;
      logger.info(`[OrderService] Service-only order detected -> Initial status: ${initialStatus}`);
    } else {
      logger.info(`[OrderService] Order type: Physical=${hasPhysical}, Digital=${hasDigital}, Service=${hasService} -> Initial status: ${initialStatus}`);
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
        SELECT oi.*, p.product_type::text as product_type, p.is_digital, p.service_options, p.track_inventory, p.quantity as available_quantity, p.low_stock_threshold, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [orderId]);
      const items = itemsResult.rows;

      // 3a. INVENTORY DECREMENT: Update stock for tracked products
      for (const item of items) {
        if (item.track_inventory === true && item.product_id) {
          const requestedQty = item.quantity || 1;
          logger.info(`[INVENTORY-DEBUG] Product ${item.product_id} - quantity field: ${item.quantity}, type: ${typeof item.quantity}, requestedQty: ${requestedQty}`);

          // Decrement inventory atomically
          const updateResult = await client.query(
            `UPDATE products 
             SET quantity = quantity - $1 
             WHERE id = $2 AND track_inventory = true AND quantity >= $3
             RETURNING quantity, low_stock_threshold, name`,
            [requestedQty, item.product_id, requestedQty]
          );

          if (updateResult.rows.length === 0) {
            throw new Error(`Failed to decrement inventory for product ${item.name || item.product_id}. Insufficient stock.`);
          }

          const updatedProduct = updateResult.rows[0];
          const newQuantity = updatedProduct.quantity;

          logger.info(`[INVENTORY] Decremented stock for product ${item.product_id}: ${newQuantity + requestedQty} -> ${newQuantity}`);

          // Check if low stock alert should be sent
          if (updatedProduct.low_stock_threshold && newQuantity <= updatedProduct.low_stock_threshold && newQuantity > 0) {
            logger.warn(`[INVENTORY] Low stock alert for product ${updatedProduct.name || item.product_name || item.product_id}: ${newQuantity} units remaining`);

            // Send low stock WhatsApp alert to seller (async, don't block)
            this._sendLowStockAlert(order.seller_id, updatedProduct.name || item.product_name || item.product_id, newQuantity, updatedProduct.low_stock_threshold).catch(err => {
              logger.error('[INVENTORY] Failed to send low stock alert:', err);
            });
          } else if (newQuantity === 0) {
            logger.warn(`[INVENTORY] Product ${updatedProduct.name || item.product_name || item.product_id} is now OUT OF STOCK`);

            // Send out of stock alert
            this._sendOutOfStockAlert(order.seller_id, updatedProduct.name || item.product_name || item.product_id).catch(err => {
              logger.error('[INVENTORY] Failed to send out of stock alert:', err);
            });
          }
        }
      }

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

      logger.info(`[PURCHASE-FLOW] CompleteOrder - Product Analysis:`, {
        hasPhysical,
        hasService,
        itemsCount: items.length,
        sellerHasShop,
        sellerId: order.seller_id
      });

      // Determine final status based on product type and seller shop availability
      let newStatus = OrderStatus.COMPLETED;
      if (hasPhysical) {
        if (sellerHasShop) {
          newStatus = OrderStatus.COLLECTION_PENDING;
          logger.info(`[PURCHASE-FLOW] Physical product with shop -> Status: ${newStatus} (buyer must collect)`);
        } else {
          newStatus = OrderStatus.DELIVERY_PENDING;
          logger.info(`[PURCHASE-FLOW] Physical product without shop -> Status: ${newStatus} (delivery required)`);
        }
      } else if (hasService) {
        newStatus = OrderStatus.SERVICE_PENDING;
        logger.info(`[PURCHASE-FLOW] Service order detected -> Status: ${newStatus} (seller must confirm)`);
      } else {
        // Digital or unknown - auto-complete
        logger.info(`[PURCHASE-FLOW] Digital/Auto-complete order -> Status: ${newStatus}`);
      }

      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, newStatus, 'completed', payment.provider_reference);

      logger.info(`[PURCHASE-FLOW] 8a. Order #${order.order_number} status updated:`, {
        orderId,
        previousStatus: order.status,
        newStatus,
        paymentStatus: 'completed',
        sellerHasShop
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
                  COALESCE(s.full_name, u.email, 'Unknown Seller') as seller_name, 
                  COALESCE(s.whatsapp_number, NULL) as seller_phone, 
                  COALESCE(s.email, u.email) as seller_email, 
                  s.physical_address as seller_address, s.shop_name, s.latitude as seller_latitude, s.longitude as seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           LEFT JOIN users u ON s.user_id = u.id
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

          // Check if it's a seller-initiated client order
          const isSellerInitiated = fullOrder.metadata && (fullOrder.metadata.seller_initiated === true || fullOrder.metadata.is_seller_initiated === true);

          if (isSellerInitiated) {
            logger.info(`[PURCHASE-FLOW] 9b. Skipping notifications for seller-initiated client order #${fullOrder.order_number}`);
          } else {
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
                  COALESCE(s.full_name, u.email, 'Unknown Seller') as seller_name, 
                  COALESCE(s.whatsapp_number, NULL) as seller_phone, 
                  COALESCE(s.email, u.email) as seller_email, 
                  s.physical_address as seller_address, s.latitude as seller_latitude, s.longitude as seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           LEFT JOIN users u ON s.user_id = u.id
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

      // Allow if shipped, delivered, pending, or confirmed (for services)
      const allowedStatuses = [
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.PENDING,
        OrderStatus.DELIVERY_PENDING,
        OrderStatus.CONFIRMED,        // Service orders that seller confirmed
        OrderStatus.SERVICE_PENDING,  // Service orders awaiting confirmation
        OrderStatus.COLLECTION_PENDING, // Physical orders awaiting pickup
        'delivery_pending'
      ];
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

  /**
   * Send low stock WhatsApp alert to seller
   */
  static async _sendLowStockAlert(sellerId, productName, currentQuantity, threshold) {
    try {
      const sellerResult = await pool.query(
        'SELECT whatsapp_number FROM sellers WHERE id = $1',
        [sellerId]
      );

      if (sellerResult.rows.length === 0) {
        logger.warn(`[INVENTORY] Could not find seller ${sellerId} for low stock alert`);
        return;
      }

      const sellerPhone = sellerResult.rows[0].whatsapp_number;
      if (!sellerPhone) {
        logger.warn(`[INVENTORY] Seller ${sellerId} has no phone number for low stock alert`);
        return;
      }

      const message = `⚠️ *LOW STOCK ALERT*\n\nProduct: *${productName}*\nCurrent Stock: *${currentQuantity} units*\nThreshold: ${threshold} units\n\nPlease restock soon to avoid running out.`;

      await whatsappService.sendMessage(sellerPhone, message);
      logger.info(`[INVENTORY] Low stock alert sent to seller ${sellerId} for product ${productName}`);
    } catch (error) {
      logger.error('[INVENTORY] Error sending low stock alert:', error);
      throw error;
    }
  }

  /**
   * Send out of stock WhatsApp alert to seller
   */
  static async _sendOutOfStockAlert(sellerId, productName) {
    try {
      const sellerResult = await pool.query(
        'SELECT whatsapp_number FROM sellers WHERE id = $1',
        [sellerId]
      );

      if (sellerResult.rows.length === 0) {
        logger.warn(`[INVENTORY] Could not find seller ${sellerId} for out of stock alert`);
        return;
      }

      const sellerPhone = sellerResult.rows[0].whatsapp_number;
      if (!sellerPhone) {
        logger.warn(`[INVENTORY] Seller ${sellerId} has no phone number for out of stock alert`);
        return;
      }

      const message = `🚨 *OUT OF STOCK ALERT*\n\nProduct: *${productName}*\nStatus: *SOLD OUT*\n\nThis product is now unavailable for purchase. Please restock as soon as possible.`;

      await whatsappService.sendMessage(sellerPhone, message);
      logger.info(`[INVENTORY] Out of stock alert sent to seller ${sellerId} for product ${productName}`);
    } catch (error) {
      logger.error('[INVENTORY] Error sending out of stock alert:', error);
      throw error;
    }
  }

  /**
   * Create a client order (seller-initiated)
   * @param {number} sellerId - The seller creating the order
   * @param {Object} data - Order data including client info and products
   * @returns {Promise<Object>} Created order and payment reference
   */
  static async createClientOrder(sellerId, data) {
    const client = await pool.connect();
    try {
      const {
        clientName,
        clientPhone,
        paymentType,
        items
      } = data;

      logger.info('[ClientOrder] Starting seller-initiated client order', { sellerId, clientPhone, paymentType, fullData: JSON.stringify(data) });
      await client.query('BEGIN');

      // 1. Upsert Client
      const ClientModel = (await import('../models/client.model.js')).default;
      const clientRecord = await ClientModel.upsertClient(client, sellerId, clientName, clientPhone);
      logger.info(`[ClientOrder] Client upserted: ID ${clientRecord.id}`);

      // 2. Validate items
      this._validateItems(items);

      // 3. Calculate totals
      const { totalAmount, platformFee, sellerPayout } = this._calculateTotals(items);
      logger.info(`[ClientOrder] Calculated totals - Total: ${totalAmount}, Fee: ${platformFee}, Payout: ${sellerPayout}`);

      // 4. Enrich items with product data
      const productIds = items.map(item => parseInt(item.productId, 10));
      const productsResult = await client.query(
        'SELECT id, product_type::text as product_type, is_digital, service_options, name FROM products WHERE id = ANY($1)',
        [productIds]
      );
      const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

      items.forEach(item => {
        const prod = productsMap.get(parseInt(item.productId, 10));
        if (prod) {
          item.productType = prod.product_type;
          item.isDigital = prod.is_digital;
          item.name = item.name || prod.name;
        }
      });

      // Determine if this is a debt order
      const isDebt = paymentType === 'debt';
      const orderStatus = isDebt ? OrderStatus.DEBT_PENDING : OrderStatus.CLIENT_PAYMENT_PENDING;

      // 5. Prepare Order Record (Only for non-debt)
      let order;
      if (!isDebt) {
        const orderRecord = {
          buyer_id: null,
          seller_id: sellerId,
          total_amount: totalAmount,
          platform_fee_amount: platformFee,
          seller_payout_amount: sellerPayout,
          payment_method: 'mpesa',
          buyer_name: clientName,
          buyer_email: `client_${clientRecord.id}@byblos.local`,
          buyer_mobile_payment: clientPhone,
          buyer_whatsapp_number: clientPhone,
          shipping_address: null,
          notes: 'Seller-initiated client order',
          metadata: JSON.stringify({
            items,
            client_id: clientRecord.id,
            seller_initiated: true,
            is_debt: false
          }),
          status: OrderStatus.CLIENT_PAYMENT_PENDING,
          payment_status: 'pending',
          client_id: clientRecord.id,
          is_seller_initiated: true,
          is_debt: false
        };

        // 6. Insert Order
        order = await Order.insert(client, orderRecord);
        logger.info(`[ClientOrder] Order created: ID ${order.id}, Number ${order.order_number}`);

        // 7. Insert Order Items
        if (items.length > 0) {
          await Order.insertItems(client, order.id, items);
        }
      }

      // BRANCH: DEBT FLOW
      if (isDebt) {
        // Decrement inventory immediately
        await this._decrementInventory(client, items);

        // Record debt in client_debts table
        for (const item of items) {
          await client.query(
            `INSERT INTO client_debts (seller_id, client_id, product_id, amount, quantity, is_paid)
              VALUES ($1, $2, $3, $4, $5, false)`,
            [sellerId, clientRecord.id, parseInt(item.productId, 10), item.price * item.quantity, item.quantity]
          );
        }

        await client.query('COMMIT');
        logger.info(`[ClientOrder] Debt recorded successfully for client ${clientRecord.id}`);

        return {
          success: true,
          order: {
            id: 'debt-' + Date.now(), // specific ID format for debts if needed by frontend, though distinct from order IDs
            orderNumber: 'DEBT-' + Date.now(),
            totalAmount,
            status: OrderStatus.DEBT_PENDING
          },
          message: 'Inventory updated. Debt recorded.'
        };
      }

      // BRANCH: STK FLOW (Default)
      // 8. Initiate M-Pesa STK Push
      const paymentService = (await import('./payment.service.js')).default;


      // Create payment record
      const paymentData = {
        invoice_id: order.order_number,
        amount: totalAmount,
        currency: 'KES',
        status: 'pending',
        payment_method: 'mpesa',
        mobile_payment: clientPhone,
        whatsapp_number: clientPhone,
        email: `client_${clientRecord.id}@byblos.local`,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          client_id: clientRecord.id,
          seller_initiated: true
        }
      };

      const paymentInsert = await client.query(
        `INSERT INTO payments (invoice_id, email, mobile_payment, whatsapp_number, amount, status, payment_method, metadata)
         VALUES ($1, $2, $3, $4, $5, 'pending', 'mpesa', $6) RETURNING *`,
        [
          paymentData.invoice_id,
          paymentData.email,
          paymentData.mobile_payment,
          paymentData.whatsapp_number,
          paymentData.amount,
          JSON.stringify(paymentData.metadata)
        ]
      );
      const payment = paymentInsert.rows[0];

      // Initiate STK Push
      try {
        const stkResult = await paymentService.initiatePayment({
          ...paymentData,
          phone: clientPhone,
          narrative: `Payment for Order ${order.order_number}`,
          billing_address: 'Kenya'
        });

        // Update payment with provider reference
        await client.query(
          'UPDATE payments SET provider_reference = $1, api_ref = $1 WHERE id = $2',
          [stkResult.reference, payment.id]
        );

        // 9. Send WhatsApp notification to client
        // DISABLED: WhatsApp notification temporarily disabled due to enrichedItems error
        /*
        try {
          const waService = (await import('./whatsapp.service.js')).default;

          // Get seller details
          const sellerQuery = await client.query(
            'SELECT id, shop_name, full_name as businessName FROM sellers WHERE id = $1',
            [sellerId]
          );
          const seller = sellerQuery.rows[0];

          await waService.sendClientOrderNotification(
            clientPhone,
            {
              sellerName: seller.shop_name || seller.businessName || 'Seller',
              orderNumber: order.order_number,
              totalAmount,
              items: enrichedItems
            }
          );
          logger.info(`[ClientOrder] WhatsApp notification sent to ${clientPhone}`);
        } catch (waError) {
          logger.error('[ClientOrder] Failed to send WhatsApp notification:', waError.message);
          // Non-critical, continue
        }
        */
        logger.info('[ClientOrder] WhatsApp notification skipped (disabled)');
        // Don't fail the order creation if WhatsApp fails


        await client.query('COMMIT');
        logger.info(`[ClientOrder] STK Push initiated successfully for order ${order.id}`);

        return {
          success: true,
          order: {
            id: order.id,
            orderNumber: order.order_number,
            totalAmount,
            status: OrderStatus.CLIENT_PAYMENT_PENDING
          },
          payment: {
            id: payment.id,
            reference: stkResult.reference
          },
          message: 'Payment prompt sent to client'
        };

      } catch (paymentError) {
        // If STK push fails, mark both order and payment as failed
        await client.query(
          'UPDATE product_orders SET status = $1 WHERE id = $2',
          ['FAILED', order.id]
        );
        await client.query(
          'UPDATE payments SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3',
          ['failed', JSON.stringify({ error: paymentError.message }), payment.id]
        );
        await client.query('COMMIT');

        logger.error('[ClientOrder] STK Push failed, order marked as failed:', paymentError);
        throw new Error(`Order created but payment initiation failed: ${paymentError.message}`);
      }


    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[ClientOrder] Error creating client order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper to decrement inventory for sold items
   */
  static async _decrementInventory(client, items) {
    const Product = (await import('../models/product.model.js')).default;

    for (const item of items) {
      // Skip digital products or services if they don't track stock
      if (item.productType === 'digital' || item.productType === 'service') {
        continue;
      }

      // Decrease stock (only if track_inventory is true)
      await client.query(
        `UPDATE products 
         SET quantity = quantity - $1, 
             updated_at = NOW() 
         WHERE id = $2 AND track_inventory = true`,
        [item.quantity, item.productId]
      );

      logger.info(`[ClientOrder] Decremented inventory for product ${item.productId} by ${item.quantity}`);
    }
  }
}

export default OrderService;
