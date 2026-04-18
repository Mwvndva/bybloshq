import crypto from 'node:crypto';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, ProductType, OrderType } from '../constants/enums.js';
import Order from '../models/order.model.js';
import Buyer from '../models/buyer.model.js';
import whatsappService from './whatsapp.service.js';
import escrowManager from './EscrowManager.js';
import { sellerHasPhysicalShop } from '../utils/sellerUtils.js';
import ReferralService from './referral.service.js';
import { sendProductOrderConfirmationEmail, sendNewOrderNotificationEmail, sendPaymentReceiptEmail } from '../utils/email.js';
import cacheService from './cache.service.js';
import { resolveFulfillmentType, validateFulfillmentPayload, FulfillmentType } from '../utils/fulfillment.js';

/**
 * OrderService — Order lifecycle orchestrator.
 * 
 * KNOWN TECHNICAL DEBT: This class handles too many concerns.
 * Planned refactor: Extract InventoryService, NotificationService, DebtService.
 * Do not add new business logic here without first evaluating extraction.
 */
class OrderService {
  /**
   * Create a new order with fee calculations and status determination
   */
  static async createOrder(orderData) {
    let sellerInfo = null;
    const {
      buyerId,
      sellerId,
      items: rawItems, // renamed to avoid conflict
      paymentMethod,
      buyerName,
      buyerEmail,
      buyerPhone,
      buyerMobilePayment,
      buyerWhatsApp,
      shippingAddress,
      notes,
      metadata: rawMetadata = {},
      buyerLocation = null,
      idempotencyKey = null
    } = orderData;

    // --- PIN-01: DISTRIBUTED LOCK FOR ATOMIC ORDER CREATION ---
    const lockKey = idempotencyKey ? `lock:order_create:${idempotencyKey}` : `lock:order_create:buyer:${buyerId}:seller:${sellerId}`;

    const client = await pool.connect();
    try {
      // 1. Acquire Lock
      const acquired = await cacheService.redis.set(lockKey, 'locked', 'EX', 10, 'NX');
      if (!acquired) {
        const error = new Error('Order creation already in progress. Please wait.');
        error.code = 'CONCURRENT_REQUEST';
        throw error;
      }

      // 2. Transaction Start
      try {
        // Whitelist allowed metadata keys to prevent internal state injection
        // Handles both snake_case (frontend) and camelCase (potential future use)
        const metadata = {
          items: rawMetadata.items || [],
          seller_initiated: rawMetadata.seller_initiated || rawMetadata.sellerInitiated || false,
          is_seller_initiated: rawMetadata.is_seller_initiated || rawMetadata.isSellerInitiated || false,
          location_type: rawMetadata.location_type || rawMetadata.locationType,
          service_requirements: rawMetadata.service_requirements || rawMetadata.serviceRequirements,
          product_type: rawMetadata.product_type || rawMetadata.productType,
          product_id: rawMetadata.product_id || rawMetadata.productId,
          narration: rawMetadata.narration,
          booking_date: rawMetadata.booking_date || rawMetadata.bookingDate,
          booking_time: rawMetadata.booking_time || rawMetadata.bookingTime,
          service_location: rawMetadata.service_location || rawMetadata.serviceLocation,
          buyer_location: rawMetadata.buyer_location || rawMetadata.buyerLocation,
          customerName: rawMetadata.customerName || rawMetadata.customer_name,
          productName: rawMetadata.productName || rawMetadata.product_name
        };

        logger.info('OrderService: Starting order creation', { buyerId, sellerId, hasLocation: !!buyerLocation });
        await client.query('BEGIN');

        // 1. Verify seller exists and is active
        sellerInfo = await this._getSellerDetails(client, sellerId);

        // 2. Process and validate order items
        const items = metadata.items || [];
        metadata.items = items;
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

        // 4d. ENRICH PRODUCT TYPE & VIRTUAL STATUS (BEFORE VALIDATION) (Task BUG-BOOK-05)
        const primaryProductType = items[0]?.productType || metadata.product_type || 'physical';

        // Shopless Service Logic: Default to Virtual/Online if seller has no address/coords
        const isShopless = !sellerHasPhysicalShop(sellerInfo) && !sellerInfo.physical_address;
        const reflectsService = (primaryProductType === ProductType.SERVICE || primaryProductType === 'service');

        if (isShopless && reflectsService && !metadata.location_type && !metadata.service_location) {
          metadata.location_type = 'Virtual/Online';
          logger.info(`Shopless service detected for buyer ${buyerId}, defaulting to Virtual/Online`);
        }

        // 4e. RESOLVE & VALIDATE FULFILLMENT (STRICT ENFORCEMENT)
        const fulfillmentType = resolveFulfillmentType(sellerInfo, primaryProductType, metadata);

        // Standardize buyer location format for validation (Robust Extraction - Task BUG-BOOK-06)
        const rawLoc = buyerLocation || metadata.buyer_location;
        const normalizedLocation = (rawLoc && typeof rawLoc === 'object') ? {
          lat: rawLoc.lat !== undefined ? rawLoc.lat : rawLoc.latitude,
          lng: rawLoc.lng !== undefined ? rawLoc.lng : rawLoc.longitude,
          address: rawLoc.address || rawLoc.fullAddress
        } : null;

        try {
          validateFulfillmentPayload(fulfillmentType, normalizedLocation, metadata);
        } catch (err) {
          logger.warn(`Fulfillment validation failed for Order: ${err.message}`);
          throw err;
        }

        logger.info('OrderService: items enriched', {
          items: items.map(i => ({ id: i.productId, type: i.productType, digital: i.isDigital }))
        });

        // 4f. RESOLVE ORDER TYPE
        const hasService = items.some(i => i.productType === ProductType.SERVICE || i.productType === 'service');
        const hasDigital = items.every(i => i.isDigital === true);
        let orderType = OrderType.PHYSICAL;
        if (hasService) orderType = OrderType.SERVICE;
        else if (hasDigital) orderType = OrderType.DIGITAL;

        // 5. Determine initial status
        const initialStatus = this._determineInitialStatus(orderType);

        // 5b. Handle Inventory Reservation
        if (orderType === OrderType.PHYSICAL) {
          await this._reserveInventory(client, items);
        }

        // 5c. Set Reservation Expiry (10 minutes)
        const reservationExpiresAt = (orderType === OrderType.PHYSICAL || orderType === OrderType.SERVICE)
          ? new Date(Date.now() + 10 * 60 * 1000)
          : null;

        // 5d. Calculate Total Quantity
        const totalQuantity = items.reduce((sum, item) => sum + (Number.parseInt(item.quantity, 10) || 1), 0);

        // 5e. Generate unique order number
        const orderNumber = await this._generateOrderNumber(client);

        // 5f. Prepare Order Record
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
          payment_status: 'pending',
          service_requirements: metadata.service_requirements || null,
          fulfillment_type: fulfillmentType,
          delivery_location: fulfillmentType === FulfillmentType.SELLER_TO_BUYER ? normalizedLocation : null,
          order_type: orderType,
          total_quantity: totalQuantity,
          reservation_expires_at: reservationExpiresAt
        };

        // 6. Insert Order
        const order = await Order.insert(client, orderRecord);

        // 7. Insert Order Items
        if (items.length > 0) {
          await Order.insertItems(client, order.id, items);
        }

        // 7b. ATOMIC SLOT LOCKING (For Services)
        if (orderType === OrderType.SERVICE && metadata.booking_date && metadata.booking_time) {
          await this._reserveServiceSlot(client, order.id, metadata);
        }

        await client.query('COMMIT');
        logger.info(`OrderService: Order ${order.id} created successfully`);

        return order;
      } catch (dbError) {
        await client.query('ROLLBACK').catch(err => logger.error('Rollback failed:', err));
        throw dbError;
      }
    } catch (error) {
      logger.error('OrderService: Error creating order:', error);
      throw error;
    } finally {
      client.release();
      // Always release the lock
      await cacheService.redis.del(lockKey).catch(err => logger.error('Failed to release order lock:', err));
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
        [OrderStatus.PENDING]: [OrderStatus.RESERVED, OrderStatus.PROCESSING, OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.PAID, OrderStatus.CANCELLED],
        [OrderStatus.RESERVED]: [OrderStatus.PAID, OrderStatus.EXPIRED, OrderStatus.CANCELLED, OrderStatus.FAILED],
        [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.CANCELLED, OrderStatus.COMPLETED],
        [OrderStatus.PROCESSING]: [OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.DELIVERY_COMPLETE, OrderStatus.CONFIRMED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.SERVICE_PENDING]: [OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.COMPLETED],
        [OrderStatus.DELIVERY_PENDING]: [OrderStatus.PROCESSING, OrderStatus.DELIVERY_COMPLETE, OrderStatus.CANCELLED],
        [OrderStatus.COLLECTION_PENDING]: [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Buyer picks up -> Complete
        [OrderStatus.DELIVERY_COMPLETE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        [OrderStatus.CLIENT_PAYMENT_PENDING]: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Client orders can only complete or cancel
        [OrderStatus.DEBT_PENDING]: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Debt orders can only complete or cancel
        [OrderStatus.EXPIRED]: [OrderStatus.RESERVED, OrderStatus.CANCELLED], // Can potentially be re-reserved if user retries
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.FAILED]: [OrderStatus.PENDING, OrderStatus.RESERVED]
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
            whatsapp_number: fullOrder.seller_phone,
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
                items: items
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
          'SELECT id, user_id, physical_address, latitude, longitude, city, location, status FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
          [sellerId, 'active']
        );
      } catch (schemaError) {
        logger.warn('Seller schema issue, trying minimal query:', schemaError);
        sellerCheck = await client.query(
          'SELECT id, user_id, latitude, longitude FROM sellers WHERE id = $1 FOR UPDATE',
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
      'SELECT id, price, product_type::text as product_type, is_digital, service_options, track_inventory, quantity, reserved_quantity FROM products WHERE id = ANY($1)',
      [productIds]
    );
    const productsMap = new Map(productsResult.rows.map(p => [p.id, p]));

    items.forEach(item => {
      const prod = productsMap.get(Number.parseInt(item.productId, 10));
      if (prod) {
        item.dbPrice = prod.price;
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

  /**
   * PIN-03: ATOMIC INVENTORY RESERVATION
   * Decrements quantity and increments reserved_quantity
   */
  static async _reserveInventory(client, items) {
    for (const item of items) {
      if (item.trackInventory === true) {
        const requestedQty = Number.parseInt(item.quantity, 10) || 1;
        const productId = Number.parseInt(item.productId, 10);

        const query = `
          UPDATE products 
          SET 
            quantity = quantity - $1,
            reserved_quantity = reserved_quantity + $1,
            updated_at = NOW()
          WHERE id = $2 AND quantity >= $1
          RETURNING id, quantity, reserved_quantity
        `;

        const { rows } = await client.query(query, [requestedQty, productId]);

        if (rows.length === 0) {
          throw new Error(`Inventory reservation failed for product ${productId}. It may have just sold out.`);
        }

        logger.info(`[RESERVATION] Reserved ${requestedQty} units for product ${productId}. New qty: ${rows[0].quantity}, Reserved: ${rows[0].reserved_quantity}`);
      }
    }
  }

  /**
   * PIN-04: RELEASE RESERVATION
   * Restores quantity and decrements reserved_quantity (used for cancellation/timeout)
   */
  static async _releaseInventory(client, items) {
    for (const item of items) {
      if (item.trackInventory === true) {
        const qty = Number.parseInt(item.quantity, 10) || 1;
        const productId = Number.parseInt(item.productId, 10);

        const query = `
          UPDATE products 
          SET 
            quantity = quantity + $1,
            reserved_quantity = GREATEST(0, reserved_quantity - $1),
            updated_at = NOW()
          WHERE id = $2
          RETURNING id, quantity, reserved_quantity
        `;

        const { rows } = await client.query(query, [qty, productId]);
        logger.info(`[RESERVATION-RELEASE] Released ${qty} units for product ${productId}. New qty: ${rows[0].quantity}, Reserved: ${rows[0].reserved_quantity}`);
      }
    }
  }

  /**
   * PIN-07: ATOMIC SERVICE SLOT RESERVATION
   * Ensures no two buyers can book the same slot
   */
  static async _reserveServiceSlot(client, orderId, metadata) {
    if (!metadata.booking_date || !metadata.booking_time) {
      throw new Error('Booking date and time are required for service reservations');
    }

    const productId = Number.parseInt(metadata.product_id, 10);
    const timeSlot = new Date(`${metadata.booking_date}T${metadata.booking_time}`);

    if (isNaN(timeSlot.getTime())) {
      throw new Error('Invalid booking date or time format');
    }

    // Try to insert the reservation
    const query = `
      INSERT INTO service_slots (service_id, time_slot, status, reserved_by_order_id, expires_at)
      VALUES ($1, $2, 'RESERVED', $3, NOW() + INTERVAL '10 minutes')
      ON CONFLICT (service_id, time_slot) DO UPDATE
      SET 
        status = 'RESERVED',
        reserved_by_order_id = $3,
        expires_at = NOW() + INTERVAL '10 minutes',
        updated_at = NOW()
      WHERE service_slots.status = 'AVAILABLE' OR service_slots.expires_at < NOW()
      RETURNING id
    `;

    const { rows } = await client.query(query, [productId, timeSlot, orderId]);

    if (rows.length === 0) {
      throw new Error('This time slot is no longer available. Please select another slot.');
    }

    logger.info(`[SLOT-RESERVATION] Reserved slot ${timeSlot.toISOString()} for service ${productId} (Order ${orderId})`);
  }

  /**
   * PIN-05: FINALIZE RESERVATION
   * Simply decrements reserved_quantity (used after successful payment)
   */
  static async _finalizeInventory(client, items) {
    for (const item of items) {
      if (item.trackInventory === true) {
        const qty = Number.parseInt(item.quantity, 10) || 1;
        const productId = Number.parseInt(item.productId, 10);

        const query = `
          UPDATE products 
          SET 
            reserved_quantity = GREATEST(0, reserved_quantity - $1),
            updated_at = NOW()
          WHERE id = $2
          RETURNING id, reserved_quantity
        `;

        await client.query(query, [qty, productId]);
        logger.info(`[RESERVATION-FINALIZED] Finalized ${qty} units for product ${productId}.`);
      }
    }
  }

  /**
   * PIN-09: GRANT DIGITAL ACCESS
   * Records digital entitlement after payment
   */
  static async _grantDigitalAccess(client, orderId, buyerId, items) {
    for (const item of items) {
      if (item.isDigital) {
        const productId = Number.parseInt(item.productId, 10);

        const query = `
          INSERT INTO user_digital_access (user_id, product_id, order_id, access_status)
          VALUES ($1, $2, $3, 'ACTIVE')
          ON CONFLICT (user_id, product_id) DO UPDATE
          SET 
            access_status = 'ACTIVE',
            updated_at = NOW()
          RETURNING id
        `;

        await client.query(query, [buyerId, productId, orderId]);
        logger.info(`[DIGITAL-ACCESS] Granted access for product ${productId} to user ${buyerId} (Order ${orderId})`);
      }
    }
  }

  /**
   * PIN-10: FINALIZE SERVICE SLOT
   * Transitions slot from RESERVED to BOOKED
   */
  static async _finalizeServiceSlot(client, orderId) {
    const query = `
      UPDATE service_slots 
      SET 
        status = 'BOOKED',
        updated_at = NOW()
      WHERE reserved_by_order_id = $1 AND status = 'RESERVED'
      RETURNING id
    `;

    const { rows } = await client.query(query, [orderId]);
    if (rows.length > 0) {
      logger.info(`[SLOT-FINALIZED] Finalized booking for Order ${orderId}`);
    }
  }

  static async _handleLocationUpdate(buyerId, buyerLocation, metadata) {
    if (buyerId && buyerLocation) {
      try {
        const Buyer = (await import('../models/buyer.model.js')).default;
        // Map frontend lat/lng to backend latitude/longitude (Task BUG-GUEST-04)
        const updateData = {
          latitude: buyerLocation.latitude || buyerLocation.lat,
          longitude: buyerLocation.longitude || buyerLocation.lng,
          fullAddress: buyerLocation.fullAddress || buyerLocation.address
        };

        if (updateData.latitude && updateData.longitude) {
          await Buyer.updateLocation(buyerId, updateData);
          logger.info(`Updated buyer ${buyerId} location coordinates`);
          metadata.buyer_location = {
            ...buyerLocation,
            ...updateData // Ensure both formats are in internal metadata
          };
        }
      } catch (locError) {
        logger.error('Error updating buyer location during order creation:', locError);
      }
    }
  }

  static _validateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    items.forEach((item, index) => {
      if (typeof item.price !== 'number' || Number.isNaN(item.price) || item.price <= 0) {
        throw new Error(`Invalid price for item at index ${index}`);
      }
      if (typeof item.quantity !== 'number' || Number.isNaN(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.productId || index}`);
      }

      // PIN-02: STRICT PRICE VERIFICATION
      if (item.dbPrice) {
        const expectedSubtotal = Math.round((Number(item.dbPrice) * Number(item.quantity)) * 100) / 100;
        const clientSubtotal = Math.round((Number(item.price) * Number(item.quantity)) * 100) / 100;

        if (Math.abs(expectedSubtotal - clientSubtotal) > 0.01) {
          logger.error(`[PRICE-VERIFICATION] Price mismatch for product ${item.productId}. Expected: ${expectedSubtotal}, Received: ${clientSubtotal}`);
          throw new Error(`Price verification failed for product ${item.productId}. Possible price change or manipulation detected.`);
        }
      }
    });
  }

  static _calculateTotals(items) {
    const totalAmount = items.reduce((sum, item) => {
      // Ensure we use 2 decimal precision for subtotals to prevent drift
      const subtotal = Math.round((item.subtotal || (item.price * item.quantity)) * 100) / 100;
      return sum + subtotal;
    }, 0);

    const platformFee = Math.round(totalAmount * Fees.PLATFORM_COMMISSION_RATE * 100) / 100;
    const sellerPayout = Math.round((totalAmount - platformFee) * 100) / 100;

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      platformFee,
      sellerPayout
    };
  }

  static _determineInitialStatus(orderType) {
    if (orderType === OrderType.PHYSICAL || orderType === OrderType.SERVICE) {
      return OrderStatus.RESERVED;
    }
    return OrderStatus.PENDING;
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

      // 2. Atomic idempotency check
      if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(order.status) ||
        order.payment_status === 'completed') {
        if (shouldManageTransaction) await client.query('ROLLBACK');
        logger.info(`[ORDER] Order ${orderId} already in terminal state (${order.status}). Skipping.`);
        return { success: true, message: 'Order already processed' };
      }

      // 3. Fetch Items
      const itemsQuery = `
        SELECT oi.*, p.product_type::text as product_type, p.is_digital, p.service_options, p.track_inventory, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [orderId]);
      const items = itemsResult.rows;

      // 4. DISPATCH BY ORDER TYPE (PHASE 5: ISOLATION)
      let result;
      const orderType = order.order_type || metadata.product_type?.toUpperCase() || OrderType.PHYSICAL;

      if (orderType === OrderType.PHYSICAL) {
        result = await this._completePhysicalOrder(client, order, items, payment);
      } else if (orderType === OrderType.SERVICE) {
        result = await this._completeServiceOrder(client, order, items, payment);
      } else if (orderType === OrderType.DIGITAL) {
        result = await this._completeDigitalOrder(client, order, items, payment);
      } else {
        throw new Error(`Unknown order type: ${orderType}`);
      }

      // 5. Shared Side Effects (Metadata update)
      await client.query(
        `UPDATE payments 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{order_completed_at}', to_jsonb(NOW()))
         WHERE id = $1`,
        [payment.id]
      );

      if (shouldManageTransaction) await client.query('COMMIT');

      // Async Side Effects
      this._handleOrderCompletionSideEffects(result.updatedOrder, items, payment).catch(err =>
        logger.error('[ORDER-SIDE-EFFECTS] Error:', err)
      );

      return { success: true, orderId, newStatus: result.updatedOrder.status };

    } catch (error) {
      if (shouldManageTransaction) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (shouldManageTransaction) client.release();
    }
  }

  static async _completePhysicalOrder(client, order, items, payment) {
    logger.info(`[_completePhysicalOrder] Finalizing Order #${order.order_number}`);

    // 1. Finalize Inventory (Convert Reserved to Sold)
    await this._finalizeInventory(client, items);

    // 2. Determine and Update Status (Standardized Check)
    const s_lat = Number(order.latitude || order.seller_latitude || 0);
    const s_lng = Number(order.longitude || order.seller_longitude || 0);
    const s_has_shop = sellerHasPhysicalShop({ latitude: s_lat, longitude: s_lng });
    const sellerHasShop = s_has_shop && !!(order.physical_address || order.seller_address);

    const newStatus = this._determineCompletionStatus(items, sellerHasShop, order, payment.metadata);

    const updatedOrder = await Order.updateStatusWithSideEffects(client, order.id, newStatus, 'completed', payment.provider_reference);

    // 3. Process Payout if immediately completed (e.g. self-collection with no further steps)
    if (newStatus === OrderStatus.COMPLETED) {
      await this._processSellerPayout(client, updatedOrder);
    }

    return { updatedOrder };
  }

  static async _completeServiceOrder(client, order, items, payment) {
    logger.info(`[_completeServiceOrder] Finalizing Order #${order.order_number}`);

    // 1. Finalize Service Slot (Convert Reserved to Booked)
    await this._finalizeServiceSlot(client, order.id);

    // 2. Determine and Update Status
    const newStatus = OrderStatus.CONFIRMED; // Services go to CONFIRMED after payment
    const updatedOrder = await Order.updateStatusWithSideEffects(client, order.id, newStatus, 'completed', payment.provider_reference);

    return { updatedOrder };
  }

  static async _completeDigitalOrder(client, order, items, payment) {
    logger.info(`[_completeDigitalOrder] Finalizing Order #${order.order_number}`);

    // 1. Grant Digital Entitlement (The core change)
    await this._grantDigitalAccess(client, order.id, order.buyer_id, items);

    // 2. Finalize Inventory (If any limited digital stock)
    await this._finalizeInventory(client, items);

    // 3. Digital orders are COMPLETED immediately
    const updatedOrder = await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.COMPLETED, 'completed', payment.provider_reference);

    // 4. Process Payout immediately
    await this._processSellerPayout(client, updatedOrder);

    return { updatedOrder };
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
            whatsapp_number: fullOrder.seller_phone,
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
            whatsapp_number: fullOrder.seller_phone,
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
      await this._enrichItemsWithProductData(client, items);

      // 4b. INVENTORY CHECK: Verify stock availability for tracked products
      // Only skip if explicitly requested (e.g. for debt payments)
      if (!skipInventoryDecrement) {
        this._checkInventory(items);
      }

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
        // FIXED (FIX-13): Ensure alert fires if threshold is reached OR crossed
        // Use COALESCE or default to 0 for threshold
        const threshold = row.low_stock_threshold || 0;
        if (threshold > 0 && row.quantity <= threshold && row.quantity > 0) {
          this._sendLowStockAlert(sellerId, row.name, row.quantity, threshold).catch(e => logger.error('[INVENTORY] Low stock alert failed:', e));
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
                s.physical_address AS seller_address, s.shop_name, s.city AS seller_city, s.location AS seller_location,
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
        name: fullOrder.seller_name,
        whatsapp_number: fullOrder.seller_phone,
        phone: fullOrder.seller_phone,
        email: fullOrder.seller_email,
        physicalAddress: fullOrder.seller_address,
        shopName: fullOrder.shop_name,
        city: fullOrder.seller_city,
        location: fullOrder.seller_location,
        latitude: fullOrder.seller_latitude,
        longitude: fullOrder.seller_longitude,
        instagram_link: fullOrder.instagram_link,
        tiktok_link: fullOrder.tiktok_link,
        facebook_link: fullOrder.facebook_link
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

        // REMOVED (FIX-17): sendPaymentReceiptEmail is redundant with sendNewOrderNotificationEmail
        // which already contains the order details and amount.
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

      // 4. Logistics / Courier Notification (If Physical and no Shop Coordinates/Address)
      const hasPhysical = items.some(i => i.product_type === 'physical' || i.productType === 'physical');
      const s_lat = Number(sellerData.latitude || sellerData.lat);
      const s_lng = Number(sellerData.longitude || sellerData.lng);
      const sHasShop = sellerHasPhysicalShop({ latitude: s_lat, longitude: s_lng });
      const sellerHasShop = sHasShop && !!fullOrder.seller_address;

      if (hasPhysical && !sellerHasShop) {
        whatsappService.sendLogisticsNotification(payload.order, payload.buyer, payload.seller, items)
          .catch(e => logger.error('[ORDER] Courier notification failed:', e));
      }

      // Notify Buyer via Email if not seller-initiated
      if (buyerData.email) {
        sendProductOrderConfirmationEmail(buyerData.email, {
          ...fullOrder,
          items
        }).catch(e => logger.error('[ORDER] Buyer confirmation email failed:', e));

        // REMOVED (FIX-17): sendPaymentReceiptEmail is redundant with sendProductOrderConfirmationEmail
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

      // IMPORTANT: Records created within the rolled-back transaction (Order/Payment)
      // do not exist in the database after ROLLBACK. Attempting to update them is invalid.
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
