import crypto from 'node:crypto';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, ProductType } from '../constants/enums.js';
import Order from '../models/order.model.js';
import Buyer from '../models/buyer.model.js';
import whatsappService from './whatsapp.service.js';
import escrowManager from './EscrowManager.js';
import ReferralService from './referral.service.js';
import { sendProductOrderConfirmationEmail, sendNewOrderNotificationEmail, sendPaymentReceiptEmail } from '../utils/email.js';

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
        metadata: rawMetadata = {},
        buyerLocation = null // { latitude, longitude, fullAddress }
      } = orderData;

      // Block 11 fix: Whitelist allowed metadata keys to prevent internal state injection
      const metadata = {
        items: rawMetadata.items || [],
        seller_initiated: rawMetadata.seller_initiated || false,
        is_seller_initiated: rawMetadata.is_seller_initiated || false,
        location_type: rawMetadata.location_type,
        service_requirements: rawMetadata.service_requirements,
        product_type: rawMetadata.product_type,
        product_id: rawMetadata.product_id,
        narration: rawMetadata.narration,
        // Booking specific keys
        booking_date: rawMetadata.booking_date,
        booking_time: rawMetadata.booking_time,
        service_location: rawMetadata.service_location,
        buyer_location: rawMetadata.buyer_location,
        // Any other specific frontend keys needed for display
        customerName: rawMetadata.customerName,
        productName: rawMetadata.productName
      };

      logger.info('OrderService: Starting order creation', { buyerId, sellerId, hasLocation: !!buyerLocation });
      await client.query('BEGIN');

      // 1. Verify seller exists and is active
      sellerInfo = await this._getSellerDetails(client, sellerId);

      // 2. Process and validate order items
      const items = metadata.items || [];
      this._validateItems(items);

      // 3. Calculate totals and fees
      const { totalAmount, platformFee, sellerPayout } = this._calculateTotals(items);
      logger.info(`Calculated totals - Total: ${totalAmount}, Fee: ${platformFee}, Payout: ${sellerPayout}`);

      // 4. Enrich items with product type and inventory data
      await this._enrichItemsWithProductData(client, items);

      // 4b. INVENTORY CHECK: Verify stock availability for tracked products
      this._checkInventory(items);

      // 4c. Update Buyer Location if provided
      await this._handleLocationUpdate(buyerId, buyerLocation, metadata);

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

      // 5. Generate unique order number
      const orderNumber = await this._generateOrderNumber(client);

      // 5. Prepare Order Record
      const orderRecord = {
        order_number: orderNumber,
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
      const userSellerId = String(user.sellerId || user.profileId || '');
      const orderSellerId = String(order.seller_id || '');
      const isAdmin = user.userType === 'admin' || user.role === 'admin';
      const isSellerMatch = userSellerId && userSellerId === orderSellerId;

      if (!isAdmin && !isSellerMatch) {
        // Last-resort fallback: cross-check via users table (handles old tokens)
        const sellerCheck = await client.query(
          'SELECT user_id FROM sellers WHERE id = $1', [order.seller_id]
        );
        const isUnifiedMatch = sellerCheck.rows.length > 0 &&
          String(sellerCheck.rows[0].user_id) === String(user.userId || user.id);

        if (!isUnifiedMatch) {
          throw new Error('Unauthorized: You can only update your own orders');
        }
      }

      // 3. Validate Status Transition
      const validTransitions = {
        [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.CANCELLED],
        [OrderStatus.PROCESSING]: [OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.DELIVERY_COMPLETE, OrderStatus.CONFIRMED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.SERVICE_PENDING]: [OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.COMPLETED],
        [OrderStatus.DELIVERY_PENDING]: [OrderStatus.PROCESSING, OrderStatus.DELIVERY_COMPLETE, OrderStatus.CANCELLED],
        [OrderStatus.COLLECTION_PENDING]: [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Buyer picks up -> Complete
        [OrderStatus.DELIVERY_COMPLETE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.CLIENT_PAYMENT_PENDING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Client orders can only complete or cancel
        [OrderStatus.DEBT_PENDING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Debt orders can only complete or cancel
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
                  b.full_name as buyer_name_actual, b.mobile_payment as buyer_phone_actual, 
                  b.whatsapp_number as buyer_whatsapp_actual, b.email as buyer_email_actual,
                  b.latitude AS buyer_latitude, b.longitude AS buyer_longitude,
                  COALESCE(s.full_name, u.email, 'Unknown Seller') as seller_name, 
                  COALESCE(s.whatsapp_number, NULL) as seller_phone, 
                  COALESCE(s.email, u.email) as seller_email, 
                  s.physical_address as seller_address, s.shop_name,
                  s.latitude as seller_latitude, s.longitude as seller_longitude,
                  s.instagram_link, s.tiktok_link, s.facebook_link
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
            email: fullOrder.buyer_email || fullOrder.buyer_email_actual,
            latitude: fullOrder.buyer_latitude,
            longitude: fullOrder.buyer_longitude
          };
          const sellerData = {
            name: fullOrder.seller_name,
            phone: fullOrder.seller_phone,
            email: fullOrder.seller_email,
            physicalAddress: fullOrder.seller_address,
            shopName: fullOrder.shop_name,
            latitude: fullOrder.seller_latitude,
            longitude: fullOrder.seller_longitude,
            instagram_link: fullOrder.instagram_link,
            tiktok_link: fullOrder.tiktok_link,
            facebook_link: fullOrder.facebook_link
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
        const refundAmount = Number.parseFloat(order.total_amount);
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

          // Fetch items      // 3. WhatsApp Notifications
          const { rows: items } = await pool.query(
            `SELECT oi.*, p.product_type 
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [orderId]
          );
          orderData.items = items.map(i => ({
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

          // Prepare notification calls
          const notificationPromises = [];

          // 1. Notify Buyer "You cancelled"
          try {
            await whatsappService.sendBuyerOrderCancellationNotification(orderData, 'Buyer');
          } catch (err) {
            logger.error('Error sending buyer cancellation notification:', err);
          }

          // 2. Notify Seller "Buyer cancelled"
          try {
            await whatsappService.sendSellerOrderCancellationNotification(orderData, seller, 'Buyer');
          } catch (err) {
            logger.error('Error sending seller cancellation notification:', err);
          }

          // 3. Notify courier if this was a logistics (delivery) order
          const cancelledProductType = fullOrder.metadata?.product_type;
          const wasDeliveryOrder = cancelledProductType !== 'service' &&
            cancelledProductType !== 'digital' &&
            !fullOrder.seller_address;

          if (wasDeliveryOrder) {
            try {
              const buyerForCancel = {
                fullName: fullOrder.buyer_name || fullOrder.buyer_name_actual,
                whatsapp_number: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp_actual,
                phone: fullOrder.buyer_mobile_payment || fullOrder.buyer_phone_actual
              };
              const sellerForCancel = {
                shop_name: fullOrder.seller_name,
                whatsapp_number: fullOrder.seller_phone,
                physicalAddress: fullOrder.seller_address || null
              };
              const orderForCancel = {
                id: fullOrder.id,
                orderNumber: fullOrder.order_number || fullOrder.id,
                total_amount: fullOrder.total_amount,
                items: itemsResult.rows
              };
              await whatsappService.sendLogisticsCancellationNotification(
                orderForCancel, buyerForCancel, sellerForCancel, 'Buyer'
              );
            } catch (err) {
              logger.error('Error sending logistics cancellation notification:', err);
            }
          }
        }
      } catch (e) {
        logger.error('Critical error in cancellation notification block:', e);
      }

      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async _getSellerDetails(client, sellerId) {
    try {
      let sellerCheck;
      try {
        sellerCheck = await client.query(
          'SELECT id, user_id, physical_address, status FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
          [sellerId, 'active']
        );
      } catch (schemaError) {
        logger.warn('Seller schema issue, trying minimal query:', schemaError);
        sellerCheck = await client.query(
          'SELECT id, user_id FROM sellers WHERE id = $1 FOR UPDATE',
          [sellerId]
        );
      }

      if (sellerCheck.rows.length === 0) {
        throw new Error(`Seller with ID ${sellerId} not found or inactive`);
      }

      const sellerInfo = sellerCheck.rows[0];

      if (sellerInfo.user_id) {
        const userCheck = await client.query(
          'SELECT id, email, role FROM users WHERE id = $1',
          [sellerInfo.user_id]
        );

        if (userCheck.rows.length > 0) {
          const userInfo = userCheck.rows[0];
          sellerInfo.full_name = userInfo.role === 'seller' ? 'Seller' : userInfo.email;
          sellerInfo.email = userInfo.email;
          sellerInfo.whatsapp_number = null;

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

      sellerInfo.name = sellerInfo.full_name || 'Unknown Seller';
      return sellerInfo;
    } catch (err) {
      logger.error(`Error fetching seller info for ID ${sellerId}:`, err);
      throw err;
    }
  }

  static async _enrichItemsWithProductData(client, items) {
    const productIds = items.map(item => Number.parseInt(item.productId, 10));
    const productsResult = await client.query(
      'SELECT id, product_type::text as product_type, is_digital, service_options, track_inventory, quantity FROM products WHERE id = ANY($1)',
      [productIds]
    );
    const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

    items.forEach(item => {
      const prod = productsMap.get(Number.parseInt(item.productId, 10));
      if (prod) {
        item.productType = prod.product_type;
        item.isDigital = prod.is_digital;
        item.trackInventory = prod.track_inventory;
        item.availableQuantity = prod.quantity;

        if (!item.productType && prod.service_options) {
          item.productType = ProductType.SERVICE;
        }
      }
    });
  }

  static _checkInventory(items) {
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
  }

  static async _handleLocationUpdate(buyerId, buyerLocation, metadata) {
    if (buyerId && buyerLocation) {
      try {
        const Buyer = (await import('../models/buyer.model.js')).default;
        await Buyer.updateLocation(buyerId, {
          latitude: buyerLocation.latitude,
          longitude: buyerLocation.longitude,
          fullAddress: buyerLocation.fullAddress
        });
        logger.info(`Updated buyer ${buyerId} location coordinates`);
        metadata.buyer_location = buyerLocation;
      } catch (locError) {
        logger.error('Error updating buyer location during order creation:', locError);
      }
    }
  }

  static _validateItems(items) {
    items.forEach((item, index) => {
      if (typeof item.price !== 'number' || Number.isNaN(item.price) || item.price <= 0) {
        throw new Error(`Invalid price for item at index ${index}`);
      }
      if (typeof item.quantity !== 'number' || Number.isNaN(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.productId}`);
      }
    });
  }

  static _calculateTotals(items) {
    const totalAmount = items.reduce((sum, item) => {
      const subtotal = item.subtotal || (item.price * item.quantity);
      return sum + subtotal;
    }, 0);

    const platformFee = Number.parseFloat((totalAmount * Fees.PLATFORM_COMMISSION_RATE).toFixed(2));
    const sellerPayout = Number.parseFloat((totalAmount - platformFee).toFixed(2));

    return { totalAmount, platformFee, sellerPayout };
  }

  static _determineInitialStatus(items) {
    const initialStatus = OrderStatus.PENDING;
    logger.info(`[OrderService] Initial status set to ${initialStatus} for new order`);
    return initialStatus;
  }


  /**
   * Complete an order after successful payment
   */
  static async completeOrder(payment, externalClient = null) {
    const client = externalClient || await pool.connect();
    const shouldManageTransaction = !externalClient;

    try {
      const { metadata = {} } = payment;
      const orderId = metadata.order_id;

      if (!orderId) throw new Error('No order_id found in payment metadata');

      if (shouldManageTransaction) await client.query('BEGIN');

      // 1. Fetch Order
      const orderResult = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      if (orderResult.rows.length === 0) throw new Error('Order not found');
      const order = orderResult.rows[0];

      // 2. Atomic idempotency check AFTER acquiring the lock
      if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(order.status) &&
        order.payment_status === 'completed') {
        if (shouldManageTransaction) await client.query('ROLLBACK')
        logger.info(`[ORDER] Order ${orderId} already in terminal state ${order.status}. Skipping.`)
        return { success: true, message: 'Order already in terminal state', alreadyProcessed: true }
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
      await this._decrementInventory(client, items, orderId, order);

      // Fetch Seller to check for Shop Address & Coordinates
      const { rows: sellers } = await client.query('SELECT physical_address, latitude, longitude FROM sellers WHERE id = $1', [order.seller_id]);
      const s = sellers[0];
      const isPlaceholderCoords = s && Math.abs(Number(s.latitude) - (-1.2921)) < 0.001 && Math.abs(Number(s.longitude) - 36.8219) < 0.001;
      const sellerHasShop = sellers.length > 0 && !!s.physical_address &&
        (!!s.latitude && !!s.longitude && Number(s.latitude) !== 0) && !isPlaceholderCoords;

      // Enrich product type if missing but service_options exist
      items.forEach(i => {
        if (!i.product_type && i.service_options) {
          i.product_type = ProductType.SERVICE;
          logger.info(`[OrderService] Inferred SERVICE type for item ${i.product_id}`);
        }
      });

      // 3. Determine if this order has physical, digital or service items
      let hasPhysical = items.some(i => i.product_type === ProductType.PHYSICAL || i.product_type === 'physical');
      let hasService = items.some(i => i.product_type === ProductType.SERVICE || i.product_type === 'service');
      let hasDigital = items.some(i => i.product_type === ProductType.DIGITAL || i.product_type === 'digital' || i.is_digital === true);

      // Fallback logic for metadata if product/type missing (e.g. deleted product)
      if (!hasPhysical && !hasService && !hasDigital && metadata.product_type) {
        if (metadata.product_type === ProductType.PHYSICAL) hasPhysical = true;
        if (metadata.product_type === ProductType.SERVICE) hasService = true;
        if (metadata.product_type === ProductType.DIGITAL) hasDigital = true;
      }

      logger.info(`[PURCHASE-FLOW] CompleteOrder - Product Analysis:`, {
        hasPhysical,
        hasService,
        itemsCount: items.length,
        sellerHasShop,
        sellerId: order.seller_id
      });

      // Check if this is a client order (seller-initiated)
      // Client orders should auto-complete since clients don't have accounts to update status
      const isClientOrder = order.client_id !== null || order.is_seller_initiated === true;

      // Determine final status based on order type
      const newStatus = this._determineCompletionStatus(items, sellerHasShop, order, metadata);

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

        // If this order is linked to a debt, mark the debt as paid
        if (order.metadata?.debt_id) {
          const debtId = order.metadata.debt_id;
          logger.info(`[DEBT-PAYMENT] Order ${orderId} linked to debt ${debtId}, marking debt as paid`);

          await client.query(
            'UPDATE client_debts SET is_paid = true, updated_at = NOW() WHERE id = $1',
            [debtId]
          );

          logger.info(`[DEBT-PAYMENT] Debt ${debtId} marked as paid after order completion`);
        }
      }

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

      if (shouldManageTransaction) await client.query('COMMIT');

      // Trigger side effects (non-blocking)
      this._handleOrderCompletionSideEffects(updatedOrder, items, payment).catch(err =>
        logger.error('[ORDER-SIDE-EFFECTS] Error in completion side effects:', err)
      );

      return { success: true, orderId, newStatus };

    } catch (error) {
      if (shouldManageTransaction) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (shouldManageTransaction) client.release();
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
                  b.full_name          AS buyer_name_actual,
                  b.mobile_payment     AS buyer_phone_actual,
                  b.whatsapp_number    AS buyer_whatsapp_actual,
                  b.email              AS buyer_email_actual,
                  b.city               AS buyer_city,
                  b.location           AS buyer_location_text,
                  b.latitude           AS buyer_latitude,
                  b.longitude          AS buyer_longitude,
                  b.full_address       AS buyer_full_address,
                  COALESCE(s.full_name, u.email, 'Unknown Seller') AS seller_name, 
                  COALESCE(s.whatsapp_number, NULL)                AS seller_phone, 
                  COALESCE(s.email, u.email)                       AS seller_email, 
                  s.physical_address   AS seller_address, s.latitude AS seller_latitude, s.longitude AS seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           LEFT JOIN users u ON s.user_id = u.id
           WHERE o.id = $1`,
          [orderId]
        );

        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];
          const buyerData = this._buildBuyerNotificationData(fullOrder);
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
        OrderStatus.PENDING,
        OrderStatus.DELIVERY_PENDING,
        OrderStatus.DELIVERY_COMPLETE,
        OrderStatus.CONFIRMED,
        OrderStatus.SERVICE_PENDING,
        OrderStatus.COLLECTION_PENDING
      ];
      if (!allowedStatuses.includes(order.status)) {
        throw new Error(`Cannot confirm receipt for order in ${order.status} status`);
      }

      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, OrderStatus.COMPLETED, 'completed');
      await this._processSellerPayout(client, updatedOrder);

      await client.query('COMMIT');

      // 6. Send Notifications
      try {
        const fullOrderResult = await pool.query(
          `SELECT o.*, 
                  b.full_name          AS buyer_name_actual,
                  b.mobile_payment     AS buyer_phone_actual,
                  b.whatsapp_number    AS buyer_whatsapp_actual,
                  b.email              AS buyer_email_actual,
                  b.city               AS buyer_city,
                  b.location           AS buyer_location_text,
                  b.latitude           AS buyer_latitude,
                  b.longitude          AS buyer_longitude,
                  b.full_address       AS buyer_full_address,
                  COALESCE(s.full_name, u.email, 'Unknown Seller') AS seller_name, 
                  COALESCE(s.whatsapp_number, NULL)                AS seller_phone, 
                  COALESCE(s.email, u.email)                       AS seller_email, 
                  s.physical_address   AS seller_address, s.latitude AS seller_latitude, s.longitude AS seller_longitude
           FROM product_orders o
           LEFT JOIN buyers b ON o.buyer_id = b.id
           LEFT JOIN sellers s ON o.seller_id = s.id
           LEFT JOIN users u ON s.user_id = u.id
           WHERE o.id = $1`,
          [orderId]
        );

        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];
          const buyerData = this._buildBuyerNotificationData(fullOrder);
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
            oldStatus: order.status,
            newStatus: OrderStatus.COMPLETED,
            notes: 'Service confirmed as done by buyer'
          };

          // Notify Seller: "Buyer confirmed the service is done, funds released."
          whatsappService.notifySellerStatusUpdate(notificationPayload)
            .catch(err => logger.error('Error sending confirmation notification to seller:', err));

          // Notify Buyer: "Thank you for confirming. Order completed."
          whatsappService.notifyBuyerStatusUpdate(notificationPayload)
            .catch(err => logger.error('Error sending confirmation notification to buyer:', err));
        }
      } catch (e) {
        logger.error('Error sending confirmation notifications:', e);
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
        items,
        skipInventoryDecrement = false, // For debt payments where inventory already decremented
        debtId = null // Link to debt record if this is a debt payment
      } = data;

      logger.info('[ClientOrder] Starting seller-initiated client order', { sellerId, clientPhone, paymentType, skipInventoryDecrement, debtId, fullData: JSON.stringify(data) });
      await client.query('BEGIN');

      // Prevent multiple STK pushes for the same debt
      if (debtId) {
        const { rows: existing } = await client.query(
          "SELECT order_number, status FROM product_orders WHERE (metadata->>'debt_id')::int = $1 AND status != 'FAILED' AND status != 'CANCELLED'",
          [debtId]
        );
        if (existing.length > 0) {
          throw new Error(`A payment request for this debt is already active (Order #${existing[0].order_number}). Please wait or cancel the previous order.`);
        }
      }

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
      const productIds = items.map(item => Number.parseInt(item.productId, 10));
      const productsResult = await client.query(
        'SELECT id, product_type::text as product_type, is_digital, service_options, name FROM products WHERE id = ANY($1)',
        [productIds]
      );
      const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

      items.forEach(item => {
        const prod = productsMap.get(Number.parseInt(item.productId, 10));
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
          notes: skipInventoryDecrement ? 'Debt payment order' : 'Seller-initiated client order',
          metadata: JSON.stringify({
            items,
            client_id: clientRecord.id,
            seller_initiated: true,
            is_debt: false,
            skip_inventory_decrement: skipInventoryDecrement,
            debt_id: debtId
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
        return await this._handleDebtFlow(client, sellerId, clientRecord, items, totalAmount);
      }

      // BRANCH: STK FLOW (Default)
      return await this._handleStkPaymentFlow(client, sellerId, clientRecord, order, items, totalAmount, clientPhone, skipInventoryDecrement, debtId);


    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[ClientOrder] Error creating client order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async _decrementInventory(client, items, orderId = null, order = null) {
    if (order && order.metadata?.skip_inventory_decrement === true) {
      logger.info(`[INVENTORY] Skipping inventory decrement for order ${orderId}`);
      return;
    }

    const trackedItems = items.map(item => ({
      productId: item.product_id || item.productId,
      quantity: Number.parseInt(item.quantity || 1, 10),
      track_inventory: item.track_inventory === true
    })).filter(i => i.track_inventory && i.productId);

    if (trackedItems.length === 0) return;

    // Lock rows to prevent race conditions
    const productIds = trackedItems.map(i => i.productId);
    await client.query(
      `SELECT id, quantity, name FROM products
       WHERE id = ANY($1::int[]) AND track_inventory = true
       FOR UPDATE`,
      [productIds]
    );

    const values = trackedItems.map(item => `(${item.productId}, ${item.quantity})`).join(',');
    const bulkUpdateResult = await client.query(
      `UPDATE products AS p
       SET quantity = p.quantity - v.qty,
           updated_at = NOW()
       FROM (VALUES ${values}) AS v(id, qty)
       WHERE p.id = v.id AND p.track_inventory = true AND p.quantity >= v.qty
       RETURNING p.id, p.quantity, p.low_stock_threshold, p.name`,
      []
    );

    if (bulkUpdateResult.rows.length !== trackedItems.length) {
      const updatedIds = new Set(bulkUpdateResult.rows.map(r => r.id));
      const failedItem = trackedItems.find(i => !updatedIds.has(i.productId));
      throw new Error(`Insufficient stock for product ID ${failedItem?.productId}. Operation aborted.`);
    }

    // Post-update alerts
    for (const row of bulkUpdateResult.rows) {
      const sellerId = order ? order.seller_id : null;
      if (sellerId) {
        if (row.low_stock_threshold && row.quantity <= row.low_stock_threshold && row.quantity > 0) {
          this._sendLowStockAlert(sellerId, row.name, row.quantity, row.low_stock_threshold).catch(e => logger.error('[INVENTORY] Low stock alert failed:', e));
        } else if (row.quantity === 0) {
          this._sendOutOfStockAlert(sellerId, row.name).catch(e => logger.error('[INVENTORY] Out of stock alert failed:', e));
        }
      }
    }
  }

  static _determineCompletionStatus(items, sellerHasShop, order, metadata) {
    const isClientOrder = order.client_id !== null || order.is_seller_initiated === true;
    if (isClientOrder) return OrderStatus.COMPLETED;

    const hasPhysical = items.some(i => i.product_type === ProductType.PHYSICAL || i.product_type === 'physical');
    const hasService = items.some(i => i.product_type === ProductType.SERVICE || i.product_type === 'service');
    const hasDigital = items.some(i => i.product_type === ProductType.DIGITAL || i.product_type === 'digital' || i.is_digital === true);

    // Mixed orders: If they have physical, fulfillment is pending
    if (hasPhysical) {
      // If seller has no shop, it must be delivered by courier -> DELIVERY_PENDING
      // If seller HAS a shop, it can be collected -> COLLECTION_PENDING
      return sellerHasShop ? OrderStatus.COLLECTION_PENDING : OrderStatus.DELIVERY_PENDING;
    }

    if (hasService) {
      return OrderStatus.SERVICE_PENDING;
    }

    // Purely digital orders are completed immediately
    if (hasDigital) {
      return OrderStatus.COMPLETED;
    }

    return OrderStatus.COMPLETED;
  }

  static _buildBuyerNotificationData(fullOrder) {
    const metadata = typeof fullOrder.metadata === 'string' ? JSON.parse(fullOrder.metadata) : (fullOrder.metadata || {});
    const buyerLocation = metadata.buyer_location || {};

    // Parse shipping address if it's a string
    let shippingAddr = fullOrder.shipping_address;
    if (typeof shippingAddr === 'string' && shippingAddr.startsWith('{')) {
      try { shippingAddr = JSON.parse(shippingAddr); } catch (e) { /* ignore */ }
    }

    const city = fullOrder.buyer_city || (typeof shippingAddr === 'object' ? shippingAddr.city : null) || 'Nairobi';
    const location = fullOrder.buyer_location_text || (typeof shippingAddr === 'string' ? shippingAddr : (shippingAddr?.address || shippingAddr?.location));
    const full_address = fullOrder.buyer_full_address || buyerLocation.fullAddress || (typeof shippingAddr === 'string' ? shippingAddr : shippingAddr?.fullAddress);
    const latitude = fullOrder.buyer_latitude || buyerLocation.latitude;
    const longitude = fullOrder.buyer_longitude || buyerLocation.longitude;

    return {
      name: fullOrder.buyer_name || fullOrder.buyer_name_actual || 'Customer',
      phone: fullOrder.buyer_mobile_payment || fullOrder.buyer_phone_actual,
      whatsapp_number: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp_actual,
      email: fullOrder.buyer_email || fullOrder.buyer_email_actual,
      city,
      location: location || full_address || 'Not specified',
      full_address: full_address || location || 'Not specified',
      latitude,
      longitude
    };
  }
  static async _handleOrderCompletionSideEffects(order, items, payment) {
    const orderId = order.id;

    // 1. Referral Activation
    ReferralService.activateReferral(order.seller_id).catch(err =>
      logger.warn(`[REFERRAL] activateReferral failed for seller ${order.seller_id} on order ${orderId}: ${err.message}`)
    );

    // 2. Cache Invalidation
    try {
      const cacheService = (await import('./cache.service.js')).default;
      await cacheService.clearPattern('products:*');
    } catch (cacheErr) {
      logger.warn('[ORDER] Cache invalidation failed:', cacheErr.message);
    }

    // 3. Notifications
    try {
      const fullOrderResult = await pool.query(
        `SELECT o.*, 
                b.full_name AS buyer_name_actual, b.mobile_payment AS buyer_phone_actual,
                b.whatsapp_number AS buyer_whatsapp_actual, b.email AS buyer_email_actual,
                b.city AS buyer_city, b.location AS buyer_location_text, b.latitude AS buyer_latitude,
                b.longitude AS buyer_longitude, b.full_address AS buyer_full_address,
                COALESCE(s.full_name, u.email, 'Unknown Seller') AS seller_name, 
                COALESCE(s.whatsapp_number, NULL) AS seller_phone, 
                COALESCE(s.email, u.email) AS seller_email, 
                s.physical_address AS seller_address, s.shop_name, s.city AS seller_city,
                s.latitude AS seller_latitude, s.longitude AS seller_longitude,
                s.instagram_link, s.tiktok_link, s.facebook_link
         FROM product_orders o
         LEFT JOIN buyers b ON o.buyer_id = b.id
         LEFT JOIN sellers s ON o.seller_id = s.id
         LEFT JOIN users u ON s.user_id = u.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (fullOrderResult.rows.length === 0) return;
      const fullOrder = fullOrderResult.rows[0];
      const buyerData = this._buildBuyerNotificationData(fullOrder);
      const sellerData = {
        name: fullOrder.seller_name, phone: fullOrder.seller_phone, email: fullOrder.seller_email,
        physicalAddress: fullOrder.seller_address, shopName: fullOrder.shop_name,
        latitude: fullOrder.seller_latitude, longitude: fullOrder.seller_longitude,
        instagram_link: fullOrder.instagram_link, tiktok_link: fullOrder.tiktok_link, facebook_link: fullOrder.facebook_link
      };

      const isSellerInitiated = fullOrder.metadata?.seller_initiated === true ||
        fullOrder.metadata?.is_seller_initiated === true ||
        fullOrder.is_seller_initiated === true;

      // Always notify Seller via Email
      if (sellerData.email) {
        sendNewOrderNotificationEmail(sellerData.email, {
          ...fullOrder,
          seller_name: sellerData.name,
          items
        }).catch(e => logger.error('[ORDER] Seller notification email failed:', e));

        // Also send formal Receipt to Seller
        sendPaymentReceiptEmail(sellerData.email, {
          ...fullOrder,
          items
        }, true).catch(e => logger.error('[ORDER] Seller receipt email failed:', e));
      }

      if (isSellerInitiated) return logger.info(`[ORDER] Skipping buyer notifications for seller-initiated order #${fullOrder.order_number}`);

      const payload = {
        buyer: buyerData, seller: sellerData,
        order: {
          orderNumber: fullOrder.order_number, totalAmount: fullOrder.total_amount,
          status: fullOrder.status, metadata: fullOrder.metadata,
          service_requirements: fullOrder.service_requirements
        },
        items
      };

      whatsappService.notifyBuyerOrderConfirmation(payload).catch(e => logger.error('[ORDER] Buyer notification failed:', e));
      whatsappService.notifySellerNewOrder({ seller: sellerData, buyer: buyerData, order: payload.order, items })
        .catch(e => logger.error('[ORDER] Seller notification failed:', e));

      // 4. Logistics / Courier Notification (If Physical and no Shop Coordinates)
      const hasPhysical = items.some(i => i.product_type === 'physical' || i.productType === 'physical');
      const isPlaceholderCoords = sellerData && Math.abs(Number(sellerData.latitude) - (-1.2921)) < 0.001 && Math.abs(Number(sellerData.longitude) - 36.8219) < 0.001;
      const sellerHasNoCoordinates = !sellerData.latitude || !sellerData.longitude || Number(sellerData.latitude) === 0 || isPlaceholderCoords;

      if (hasPhysical && (sellerHasNoCoordinates || !sellerData.physicalAddress)) {
        whatsappService.sendLogisticsNotification(payload.order, payload.buyer, payload.seller, items)
          .catch(e => logger.error('[ORDER] Courier notification failed:', e));
      }

      // Notify Buyer via Email if not seller-initiated
      if (buyerData.email) {
        sendProductOrderConfirmationEmail(buyerData.email, {
          ...fullOrder,
          items
        }).catch(e => logger.error('[ORDER] Buyer confirmation email failed:', e));

        // Also send formal Receipt to Buyer
        sendPaymentReceiptEmail(buyerData.email, {
          ...fullOrder,
          items
        }, false).catch(e => logger.error('[ORDER] Buyer receipt email failed:', e));
      }


    } catch (e) {
      logger.error('[ORDER] Error triggering completion notifications:', e);
    }
  }

  static async _handleDebtFlow(client, sellerId, clientRecord, items, totalAmount) {
    await this._decrementInventory(client, items);
    for (const item of items) {
      await client.query(
        `INSERT INTO client_debts (seller_id, client_id, product_id, amount, quantity, is_paid)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [sellerId, clientRecord.id, Number.parseInt(item.productId, 10), item.price * item.quantity, item.quantity]
      );
    }
    await client.query('COMMIT');
    logger.info(`[ORDER] Debt recorded for client ${clientRecord.id}`);
    return {
      success: true,
      order: { id: `debt-${Date.now()}`, orderNumber: `DEBT-${Date.now()}`, totalAmount, status: OrderStatus.DEBT_PENDING },
      message: 'Inventory updated. Debt recorded.'
    };
  }

  static async _handleStkPaymentFlow(client, sellerId, clientRecord, order, items, totalAmount, clientPhone, skipInventoryDecrement, debtId) {
    const paymentService = (await import('./payment.service.js')).default;
    const paymentData = {
      invoice_id: order.order_number, amount: totalAmount, currency: 'KES', status: 'pending', payment_method: 'mpesa',
      mobile_payment: clientPhone, whatsapp_number: clientPhone, email: `client_${clientRecord.id}@byblos.local`,
      metadata: { order_id: order.id, order_number: order.order_number, client_id: clientRecord.id, seller_initiated: true }
    };

    const paymentInsert = await client.query(
      `INSERT INTO payments (invoice_id, email, mobile_payment, whatsapp_number, amount, status, payment_method, metadata)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'mpesa', $6) RETURNING *`,
      [paymentData.invoice_id, paymentData.email, paymentData.mobile_payment, paymentData.whatsapp_number, paymentData.amount, JSON.stringify(paymentData.metadata)]
    );
    const payment = paymentInsert.rows[0];

    try {
      const stkResult = await paymentService.initiatePayment({
        ...paymentData, phone: clientPhone, narrative: `Payment for Order ${order.order_number}`, billing_address: 'Kenya'
      });

      await client.query('UPDATE payments SET provider_reference = $1, api_ref = $1 WHERE id = $2', [stkResult.reference, payment.id]);

      // Notification
      try {
        const { rows } = await client.query('SELECT shop_name, full_name as businessName FROM sellers WHERE id = $1', [sellerId]);
        await whatsappService.notifyClientOrderCreated(clientPhone, { seller: rows[0], order: { orderNumber: order.order_number, totalAmount }, items });
      } catch (waError) {
        logger.warn('[ORDER] Client notification failed:', waError.message);
      }

      await client.query('COMMIT');
      return {
        success: true,
        order: { id: order.id, orderNumber: order.order_number, totalAmount, status: OrderStatus.CLIENT_PAYMENT_PENDING },
        payment: { id: payment.id, reference: stkResult.reference },
        message: 'Payment prompt sent to client'
      };
    } catch (paymentError) {
      await client.query('ROLLBACK');
      logger.error('[ORDER] STK Push failed:', paymentError.message);
      await pool.query("UPDATE product_orders SET status = 'FAILED', payment_status = 'failed' WHERE id = $1", [order.id]).catch(() => { });
      await pool.query("UPDATE payments SET status = 'failed' WHERE metadata->>'order_id' = $1", [order.id]).catch(() => { });
      throw new Error(`Failed to initiate payment: ${paymentError.message}`);
    }
  }

  static async _generateOrderNumber(client) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters like O, 0, I, 1
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      let suffix = '';
      for (let i = 0; i < 6; i++) {
        // Use crypto.randomInt for secure randomness (SonarQube compliance)
        suffix += chars.charAt(crypto.randomInt(0, chars.length));
      }
      const orderNumber = `BYB-${suffix}`;

      // Check for uniqueness
      const checkResult = await client.query(
        'SELECT id FROM product_orders WHERE order_number = $1',
        [orderNumber]
      );

      if (checkResult.rows.length === 0) {
        return orderNumber;
      }
      attempts++;
    }

    // Fallback to timestamp if random collisions occur
    return `BYB-${Date.now().toString().slice(-6)}`;
  }
}

export default OrderService;
