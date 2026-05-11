import crypto from 'node:crypto';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, ProductType, OrderType } from '../shared/constants/enums.js';
import Order from '../models/order.model.js';
import Buyer from '../models/buyer.model.js';
import escrowManager from './EscrowManager.js';
import { sellerHasPhysicalShop } from '../shared/utils/sellerUtils.js';
import ReferralService from './referral.service.js';
import { sendProductOrderConfirmationEmail, sendNewOrderNotificationEmail } from '../shared/utils/email.js';
import cacheService from './cache.service.js';
import { resolveFulfillmentType, validateFulfillmentPayload, FulfillmentType } from '../shared/utils/fulfillment.js';
import { assertValidTransition } from '../shared/utils/OrderStatusGuard.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import InventoryReservationService from './inventoryReservation.service.js';
import OrderFulfillmentTransitionService from './orderFulfillmentTransition.service.js';
import OrderCancellationService from './orderCancellation.service.js';
import OrderReadService from './orderRead.service.js';
import OrderNotificationPayloadService from './orderNotificationPayload.service.js';
import LogisticsRequestService from './logisticsRequest.service.js';

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
  static async createOrder(orderData, externalClient = null) {
    const {
      buyer,      // Unified Buyer Object { id, name, phone, email }
      service,    // Unified Service Object { id, title, quantity, price, total }
      location,   // Unified Location Object { address, lat, lng }
      payment,    // Unified Payment Object { method, status, reference }
      metadata: rawMetadata = {},
      idempotencyKey = null
    } = orderData;

    const checkoutToken = idempotencyKey || rawMetadata.client_checkout_token;
    if (typeof checkoutToken !== 'string' || !checkoutToken.trim()) {
      throw new Error('Checkout idempotency token is required');
    }
    const normalizedCheckoutToken = checkoutToken.trim().slice(0, 160);

    // --- PIN-01: DISTRIBUTED LOCK FOR ATOMIC ORDER CREATION ---
    const lockKey = `lock:order_create:${normalizedCheckoutToken}`;

    const isManaged = !externalClient;
    const client = externalClient || await pool.connect();
    let createdEventId = null;
    try {
      // 1. Acquire Lock (P1-7 FIX: Redis outage must NOT crash order creation)
      let acquired;
      try {
        acquired = await cacheService.redis.set(lockKey, 'locked', 'EX', 60, 'NX');
      } catch (redisErr) {
        logger.warn('[OrderService] Redis lock unavailable — continuing without distributed lock. Reason:', redisErr.message);
        acquired = true; // pessimistic allow: DB FOR UPDATE guards will still protect against duplicates
      }
      if (!acquired) {
        const error = new Error('Order creation already in progress. Please wait.');
        error.code = 'CONCURRENT_REQUEST';
        throw error;
      }

      // 2. Transaction Start
      try {
        const metadata = { ...rawMetadata }; // Local clone to avoid mutation
        const sellerId = orderData.sellerId;

        if (!buyer?.email) {
          throw new Error('Buyer email is required for order creation.');
        }

        logger.info('OrderService: Starting order creation', { buyerId: buyer.id, sellerId });
        if (isManaged) await client.query('BEGIN');

        const { rows: existingOrders } = await client.query(
          `SELECT * FROM product_orders WHERE client_checkout_token = $1 FOR UPDATE`,
          [normalizedCheckoutToken]
        );
        if (existingOrders.length > 0) {
          if (isManaged) await client.query('COMMIT');
          logger.info('[OrderService] Returning existing order for checkout token', {
            token: normalizedCheckoutToken,
            orderId: existingOrders[0].id
          });
          return existingOrders[0];
        }

        // 1. Verify seller exists and is active
        const sellerInfo = await this._getSellerDetails(client, sellerId);

        // 2. Process and validate order items
        const items = metadata.items || [];
        metadata.items = items;
        this._validateItems(items);

        // 3. Calculate totals and fees
        const { totalAmount, platformFee, sellerPayout } = this._calculateTotals(items);
        logger.info(`Calculated totals - Total: ${totalAmount}, Fee: ${platformFee}, Payout: ${sellerPayout}`);

        // 4. Enrich items with product data and verify inventory
        await InventoryReservationService.enrichItemsWithProductData(client, items);
        InventoryReservationService.checkInventory(items);

        // 4d. ENRICH PRODUCT TYPE & VIRTUAL STATUS
        const primaryProductType = items[0]?.productType || metadata.product_type || 'physical';
        const isShopless = !sellerHasPhysicalShop(sellerInfo) && !sellerInfo.physical_address;
        const reflectsService = (primaryProductType === ProductType.SERVICE || primaryProductType === 'service');

        // 4e. RESOLVE & VALIDATE FULFILLMENT (STRICT ENFORCEMENT)
        const fulfillmentType = resolveFulfillmentType(sellerInfo, primaryProductType, metadata);

        // ── COORDINATE RESOLUTION ────────────────────────────────────────────────
        // Physical shop seller (has coords): use seller location for everything.
        // Online shop seller (no coords):
        //   - Courier: no coords needed (logistics handles delivery address).
        //   - Mobile service: use buyer-provided coords from booking form.
        // ─────────────────────────────────────────────────────────────────────────
        let finalLocationAddress = null;
        let finalLat = null;
        let finalLng = null;

        if (fulfillmentType === FulfillmentType.BUYER_TO_SELLER) {
          // Physical shop: buyer comes to seller. Use seller's shop coordinates.
          finalLocationAddress = sellerInfo.physical_address || null;
          finalLat = sellerInfo.latitude ? Number.parseFloat(sellerInfo.latitude) : null;
          finalLng = sellerInfo.longitude ? Number.parseFloat(sellerInfo.longitude) : null;
          logger.info(`[ORDER] Fulfillment: BUYER_TO_SELLER. Seller shop: ${finalLocationAddress}`);

        } else if (fulfillmentType === FulfillmentType.SELLER_TO_BUYER) {
          // Mobile service: seller visits buyer. Use buyer-provided location.
          finalLocationAddress = location.address || null;
          finalLat = location.lat || null;
          finalLng = location.lng || null;
          logger.info(`[ORDER] Fulfillment: SELLER_TO_BUYER. Buyer location: lat=${finalLat}, lng=${finalLng}, addr=${finalLocationAddress}`);

          // Persist buyer location immediately if buyer profile exists.
          // For guest checkouts buyer.id may be null — that is fine, the location
          // is still stored on the order row (location_lat, location_lng columns).
          if (buyer.id && finalLat && finalLng) {
            Buyer.updateLocation(buyer.id, {
              latitude: finalLat,
              longitude: finalLng,
              fullAddress: finalLocationAddress,
            }).catch(err =>
              logger.warn('[ORDER] Non-fatal: could not persist buyer location to profile:', err.message)
            );
          }

        } else {
          // COURIER: online seller, physical product. No specific coords needed here.
          // Delivery address is stored in buyer_mobile_payment / shipping metadata.
          logger.info(`[ORDER] Fulfillment: COURIER. Platform logistics handles delivery.`);
        }

        if (metadata.delivery?.door_delivery === true || metadata.delivery?.doorDelivery === true) {
          const buyerDeliveryLocation = metadata.delivery?.quote?.destination
            || metadata.delivery?.buyerDeliveryLocation
            || metadata.delivery?.buyer_delivery_location
            || metadata.delivery?.buyerLocation
            || metadata.delivery?.buyer_location
            || metadata.delivery?.location
            || location;

          finalLocationAddress = buyerDeliveryLocation.address
            || buyerDeliveryLocation.fullAddress
            || buyerDeliveryLocation.full_address
            || location.address
            || finalLocationAddress;
          finalLat = buyerDeliveryLocation.latitude ?? buyerDeliveryLocation.lat ?? location.lat ?? finalLat;
          finalLng = buyerDeliveryLocation.longitude ?? buyerDeliveryLocation.lng ?? location.lng ?? finalLng;

          if (buyer.id && finalLat && finalLng) {
            Buyer.updateLocation(buyer.id, {
              latitude: finalLat,
              longitude: finalLng,
              fullAddress: finalLocationAddress,
            }).catch(err =>
              logger.warn('[ORDER] Non-fatal: could not persist door delivery location to buyer profile:', err.message)
            );
          }
        }

        // VALIDATION: Fail fast if coordinates are required but missing
        validateFulfillmentPayload(fulfillmentType, { lat: finalLat, lng: finalLng }, metadata);

        logger.info(`[ORDER-DEBUG] Final Resolve: type=${fulfillmentType}, lat=${finalLat}, lng=${finalLng}, addr=${finalLocationAddress}`);

        // 4f. RESOLVE ORDER TYPE
        const hasDigital = items.every(i => i.isDigital === true);
        let orderType = OrderType.PHYSICAL;
        if (reflectsService) orderType = OrderType.SERVICE;
        else if (hasDigital) orderType = OrderType.DIGITAL;

        // Phase 1: Lock slot at order creation (Double Booking Prevention)
        if (orderType === OrderType.SERVICE && metadata.booking_date && metadata.booking_time) {
          const startTime = metadata.booking_time.split(' ')[0].trim();
          const timeSlot = new Date(`${metadata.booking_date}T${startTime}`);
          const productId = Number.parseInt(service.id, 10);

          const slotCheck = await client.query(
            `SELECT id, status, reserved_by_order_id, expires_at 
             FROM service_slots 
             WHERE service_id = $1 AND time_slot = $2
             FOR UPDATE`,
            [productId, timeSlot]
          );

          if (slotCheck.rows.length > 0) {
            const slot = slotCheck.rows[0];
            const isExpired = slot.expires_at && new Date(slot.expires_at) < new Date();

            if (slot.status === 'BOOKED') {
              throw new Error('This time slot has already been booked. Please select a different time.');
            }

            if (slot.status === 'RESERVED' && !isExpired) {
              throw new Error('This time slot is currently being reserved by another customer. Please try again in a few minutes or select a different time.');
            }
          }
        }

        // 5. Determine initial status and handle inventory reservation
        const initialStatus = OrderStatus.CREATED;

        // ... insertion of order happens later with initialStatus ...

        // 5c. Set Reservation Expiry
        const reservationExpiresAt = (orderType === OrderType.PHYSICAL || orderType === OrderType.SERVICE)
          ? new Date(Date.now() + 10 * 60 * 1000)
          : null;

        const totalQuantity = items.reduce((sum, item) => sum + (Number.parseInt(item.quantity, 10) || 1), 0);
        const orderNumber = await this._generateOrderNumber(client);

        // 5f. Prepare Order Record (PIN-02: UNIFIED SCHEMA MAPPING)
        const orderRecord = {
          order_number: orderNumber,
          buyer_id: buyer.id,
          seller_id: sellerId,
          total_amount: service.total || totalAmount,
          platform_fee_amount: platformFee,
          seller_payout_amount: sellerPayout,
          payment_method: payment.method,
          buyer_name: buyer.name,
          buyer_email: buyer.email,
          buyer_mobile_payment: buyer.phone,
          buyer_whatsapp_number: buyer.phone,
          // Unified Flat Columns (New Schema)
          location_address: finalLocationAddress ?? null,
          location_lat: finalLat ?? null,
          location_lng: finalLng ?? null,
          service_title: service.title || items[0]?.name || 'Service',
          client_checkout_token: normalizedCheckoutToken,

          notes: orderData.notes || null,
          metadata: metadata,
          status: initialStatus,
          payment_status: 'pending',
          service_requirements: metadata.service_requirements || null,
          fulfillment_type: fulfillmentType,
          delivery_location: fulfillmentType === FulfillmentType.SELLER_TO_BUYER ? location : null,
          order_type: orderType,
          total_quantity: service.quantity || totalQuantity,
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

        // 8. STRICT TRANSITION FROM CREATED
        let targetStatus = OrderStatus.PAYMENT_PENDING;
        if (orderType === OrderType.PHYSICAL) targetStatus = OrderStatus.RESERVED;
        else if (orderType === OrderType.SERVICE) targetStatus = OrderStatus.HELD;

        assertValidTransition(order.status, targetStatus, order.id);

        // Perform the actual transition (idempotent resource lock)
        if (orderType === OrderType.PHYSICAL) {
          await InventoryReservationService.reserveInventory(client, items);
        }

        await Order.updateStatusWithSideEffects(client, order.id, targetStatus, 'pending');

        const createdEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.CREATED, {
          eventId: `order.created:${order.id}`,
          order,
          items,
          buyer,
          sellerId
        });
        createdEventId = createdEvent.eventId;

        if (isManaged) await client.query('COMMIT');
        if (isManaged) eventBus.dispatchAfterCommit(createdEventId, 'OrderService.createOrder');
        logger.info(`OrderService: Order ${order.id} created successfully`);

        return order;
      } catch (dbError) {
        if (isManaged) await client.query('ROLLBACK').catch(err => logger.error('Rollback failed:', err));
        throw dbError;
      }
    } catch (error) {
      logger.error('OrderService: Error creating order:', error);
      throw error;
    } finally {
      if (isManaged) client.release();
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
        [OrderStatus.PAID]: [OrderStatus.AWAITING_SELLER_ACTION, OrderStatus.FULFILLING, OrderStatus.READY_FOR_BUYER, OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.CANCELLED],
        [OrderStatus.AWAITING_SELLER_ACTION]: [OrderStatus.FULFILLING, OrderStatus.READY_FOR_BUYER, OrderStatus.CANCELLED],
        [OrderStatus.FULFILLING]: [OrderStatus.READY_FOR_BUYER, OrderStatus.CANCELLED],
        [OrderStatus.READY_FOR_BUYER]: [OrderStatus.CANCELLED],
        [OrderStatus.PROCESSING]: [OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.DELIVERY_COMPLETE, OrderStatus.CONFIRMED, OrderStatus.FULFILLING, OrderStatus.READY_FOR_BUYER, OrderStatus.CANCELLED],
        [OrderStatus.SERVICE_PENDING]: [OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.FULFILLING, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERY_PENDING]: [OrderStatus.PROCESSING, OrderStatus.DELIVERY_COMPLETE, OrderStatus.FULFILLING, OrderStatus.READY_FOR_BUYER, OrderStatus.CANCELLED],
        [OrderStatus.COLLECTION_PENDING]: [OrderStatus.PROCESSING, OrderStatus.READY_FOR_BUYER, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERY_COMPLETE]: [OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.READY_FOR_BUYER, OrderStatus.CANCELLED],
        [OrderStatus.EXPIRED]: [OrderStatus.RESERVED, OrderStatus.CANCELLED], // Can potentially be re-reserved if user retries
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.FAILED]: [OrderStatus.PENDING, OrderStatus.RESERVED]
      };

      const currentStatus = order.status || OrderStatus.PENDING;
      const newStatus = status;

      logger.info(`[OrderService] Status transition requested: ${currentStatus} -> ${newStatus} for Order #${order.order_number}`);

      if (newStatus === OrderStatus.COMPLETED) {
        throw new Error('Buyer confirmation is required to complete an order and release seller funds');
      }

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        logger.error(`[OrderService] Invalid status transition blocked: ${currentStatus} -> ${newStatus}`);
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }

      logger.info(`[OrderService] Status transition validated: ${currentStatus} -> ${newStatus}`);

      // 4. Determine side-effects (payment status updates)
      let paymentStatus = order.payment_status;
      if (newStatus === OrderStatus.CANCELLED && order.payment_status === 'pending') {
        paymentStatus = 'cancelled';
      }

      // 5. Update Order
      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, newStatus, paymentStatus);

      await client.query('COMMIT');

      // 6. Send Notification
      try {
        const details = await OrderReadService.getStatusNotificationDetails(orderId);

        if (details) {
          const { fullOrder, items } = details;
          const normalizedOrder = this._prepareNormalizedNotificationPayload(fullOrder, items);

          const notificationPayload = {
            buyer: normalizedOrder.buyer,
            seller: normalizedOrder.seller,
            order: normalizedOrder,
            location: normalizedOrder.location,
            oldStatus: currentStatus,
            newStatus: newStatus,
            notes: 'Status updated by seller'
          };

          await eventBus.enqueueAndDispatch(AppEvents.ORDER.UPDATED, {
            eventId: `order.updated:${orderId}:${newStatus}`,
            payload: notificationPayload
          }, 'OrderService.updateOrderStatus');
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

  static _parseMetadata(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  static _isPaidOrder(order) {
    return ['completed', 'success', 'paid'].includes(String(order.payment_status || order.paymentStatus || '').toLowerCase());
  }

  static _isPhysicalOnlineOrder(order) {
    const metadata = this._parseMetadata(order.metadata);
    const orderType = String(order.order_type || order.orderType || '').toUpperCase();
    const productType = String(metadata.product_type || '').toLowerCase();
    const fulfillmentType = String(order.fulfillment_type || order.fulfillmentType || '').toUpperCase();

    return (orderType === OrderType.PHYSICAL || productType === ProductType.PHYSICAL)
      && fulfillmentType === FulfillmentType.COURIER;
  }

  static _hasBuyerDoorDelivery(order) {
    const metadata = this._parseMetadata(order.metadata);
    const delivery = metadata.delivery || {};
    return delivery.doorDelivery === true
      || delivery.door_delivery === true
      || delivery.deliveryMode === 'DOOR_DELIVERY'
      || delivery.delivery_mode === 'DOOR_DELIVERY';
  }

  static _hasActivePickup(order) {
    const pickupStatus = order.pickup_leg_status || order.pickupLegStatus || order.logistics?.pickupLeg?.status;
    return pickupStatus && !['failed', 'cancelled'].includes(String(pickupStatus).toLowerCase());
  }

  static async _ensureSellerDropoffRequest(client, order, deadlineAt, status = 'active') {
    const partner = await LogisticsRequestService.getMzigoEgoPartner(client);
    const packageCode = `BYB-LOG-${order.id}`;
    const requestMetadata = {
      source: 'seller_hub_dropoff',
      seller_handoff_method: 'seller_dropoff',
      seller_handoff_status: status === 'completed' ? 'dropped_at_hub' : 'dropoff_selected',
      hub_dropoff_deadline_at: deadlineAt.toISOString()
    };

    const { rows } = await client.query(
      `INSERT INTO logistics_requests
          (order_id, partner_id, package_code, status, service_level, deadline_at, metadata)
       VALUES ($1, $2, $3, $4, 'standard', $5, $6::jsonb)
       ON CONFLICT (order_id) DO UPDATE
       SET package_code = COALESCE(logistics_requests.package_code, EXCLUDED.package_code),
           status = CASE
             WHEN logistics_requests.status IN ('pending', 'awaiting_seller_choice', 'payment_pending') THEN EXCLUDED.status
             ELSE logistics_requests.status
           END,
           deadline_at = COALESCE(logistics_requests.deadline_at, EXCLUDED.deadline_at),
           metadata = logistics_requests.metadata || EXCLUDED.metadata,
           updated_at = NOW()
       RETURNING *`,
      [
        order.id,
        partner.id,
        packageCode,
        status,
        deadlineAt,
        JSON.stringify(requestMetadata)
      ]
    );

    return rows[0];
  }

  static async _emitOrderUpdate(orderId, oldStatus, newStatus, notes, source) {
    try {
      const details = await OrderReadService.getStatusNotificationDetails(orderId);
      if (!details) return;

      const { fullOrder, items } = details;
      const normalizedOrder = this._prepareNormalizedNotificationPayload(fullOrder, items);

      await eventBus.enqueueAndDispatch(AppEvents.ORDER.UPDATED, {
        eventId: `order.updated:${orderId}:${newStatus}:${source}`,
        payload: {
          id: normalizedOrder.id || orderId,
          order_id: orderId,
          buyer: normalizedOrder.buyer,
          seller: normalizedOrder.seller,
          order: normalizedOrder,
          location: normalizedOrder.location,
          oldStatus,
          newStatus,
          notes
        }
      }, source);
    } catch (error) {
      logger.error(`[OrderService] Failed to send ${source} notification:`, error);
    }
  }

  static async selectHubDropoff(orderId, sellerId) {
    const client = await pool.connect();
    let oldStatus = null;
    let newStatus = OrderStatus.FULFILLING;
    let newOrderNotificationEvent = null;

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT o.*,
                lr.id AS logistics_request_id,
                pl.id AS pickup_leg_id,
                pl.status AS pickup_leg_status
         FROM product_orders o
         LEFT JOIN logistics_requests lr ON lr.order_id = o.id
         LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                                  AND pl.leg_type = 'pickup'
         WHERE o.id = $1
           AND o.seller_id = $2
         FOR UPDATE OF o`,
        [orderId, sellerId]
      );
      const order = rows[0];

      if (!order) {
        throw new Error('Order not found or unauthorized');
      }
      if (!this._isPaidOrder(order)) {
        throw new Error('Seller handoff can only be selected after buyer payment succeeds');
      }
      if (!this._isPhysicalOnlineOrder(order)) {
        throw new Error('Hub drop-off is only available for paid physical orders from online shops');
      }
      if (this._hasActivePickup(order)) {
        throw new Error('Hub drop-off cannot be selected while Mzigo pickup is active or payment is pending');
      }

      oldStatus = order.status;
      const metadata = this._parseMetadata(order.metadata);
      const existingHandoff = metadata.seller_handoff || {};
      const deadlineAt = existingHandoff.deadline_at
        ? new Date(existingHandoff.deadline_at)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const request = await this._ensureSellerDropoffRequest(client, order, deadlineAt, 'active');

      const handoff = {
        method: 'seller_dropoff',
        status: 'dropoff_selected',
        deadline_at: deadlineAt.toISOString(),
        selected_at: existingHandoff.selected_at || new Date().toISOString(),
        logistics_request_id: request.id
      };

      const { rows: updatedRows } = await client.query(
        `UPDATE product_orders
         SET status = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          order.id,
          newStatus,
          JSON.stringify({ seller_handoff: handoff })
        ]
      );

      await client.query(
        `INSERT INTO logistics_tracking_events
            (logistics_request_id, event_key, event_type, status, message, source, actor_user_id, metadata)
         VALUES ($1, $2, 'seller_handoff.dropoff_selected', 'dropoff_selected', $3, 'seller', $4, $5::jsonb)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          request.id,
          `logistics.seller_dropoff.selected:${order.id}`,
          'Seller selected hub drop-off. Package must be dropped at the hub within 24 hours.',
          null,
          JSON.stringify({ order_id: order.id, seller_id: sellerId, deadline_at: deadlineAt.toISOString() })
        ]
      );

      newOrderNotificationEvent = await LogisticsRequestService.enqueueNewOrderNotification(client, {
        requestId: request.id,
        orderId: order.id,
        source: 'seller_hub_dropoff'
      });

      await client.query('COMMIT');
      eventBus.dispatchAfterCommit(newOrderNotificationEvent?.eventId, 'HubDropoffNewOrderNotification');
      await this._emitOrderUpdate(order.id, oldStatus, newStatus, 'Seller selected hub drop-off. Hub deadline is 24 hours.', 'OrderService.selectHubDropoff');
      return updatedRows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async markDroppedAtHub(orderId, sellerId) {
    const client = await pool.connect();
    let oldStatus = null;
    let newStatus = OrderStatus.READY_FOR_BUYER;

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT o.*,
                lr.id AS logistics_request_id,
                lr.status AS logistics_request_status,
                dl.id AS delivery_leg_id,
                dl.status AS delivery_leg_status,
                pl.id AS pickup_leg_id,
                pl.status AS pickup_leg_status
         FROM product_orders o
         LEFT JOIN logistics_requests lr ON lr.order_id = o.id
         LEFT JOIN logistics_legs dl ON dl.logistics_request_id = lr.id
                                  AND dl.leg_type = 'delivery'
         LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                                  AND pl.leg_type = 'pickup'
         WHERE o.id = $1
           AND o.seller_id = $2
         FOR UPDATE OF o`,
        [orderId, sellerId]
      );
      const order = rows[0];

      if (!order) {
        throw new Error('Order not found or unauthorized');
      }
      if (!this._isPaidOrder(order)) {
        throw new Error('Package can only be marked dropped at hub after buyer payment succeeds');
      }
      if (!this._isPhysicalOnlineOrder(order)) {
        throw new Error('Hub drop-off is only available for paid physical orders from online shops');
      }
      if (this._hasActivePickup(order)) {
        throw new Error('Package cannot be marked as seller dropped off while Mzigo pickup is active');
      }

      oldStatus = order.status;
      const metadata = this._parseMetadata(order.metadata);
      const existingHandoff = metadata.seller_handoff || {};
      const deadlineAt = existingHandoff.deadline_at
        ? new Date(existingHandoff.deadline_at)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const request = order.logistics_request_id
        ? { id: order.logistics_request_id }
        : await this._ensureSellerDropoffRequest(client, order, deadlineAt, 'active');

      const hasDoorDelivery = this._hasBuyerDoorDelivery(order) || !!order.delivery_leg_id;
      newStatus = hasDoorDelivery ? OrderStatus.FULFILLING : OrderStatus.READY_FOR_BUYER;
      const handoff = {
        method: 'seller_dropoff',
        status: 'dropped_at_hub',
        deadline_at: deadlineAt.toISOString(),
        selected_at: existingHandoff.selected_at || new Date().toISOString(),
        dropped_at_hub_at: new Date().toISOString(),
        logistics_request_id: request.id
      };

      const { rows: updatedRows } = await client.query(
        `UPDATE product_orders
         SET status = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          order.id,
          newStatus,
          JSON.stringify({ seller_handoff: handoff })
        ]
      );

      await client.query(
        `UPDATE logistics_requests
         SET status = CASE
               WHEN status IN ('pending', 'awaiting_seller_choice', 'payment_pending') THEN 'active'
               ELSE status
             END,
             metadata = metadata || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          request.id,
          JSON.stringify({
            seller_handoff_method: 'seller_dropoff',
            seller_handoff_status: 'dropped_at_hub',
            seller_dropped_at_hub_at: handoff.dropped_at_hub_at
          })
        ]
      );

      await client.query(
        `INSERT INTO logistics_tracking_events
            (logistics_request_id, event_key, event_type, status, message, source, actor_user_id, metadata)
         VALUES ($1, $2, 'seller_handoff.dropped_at_hub', 'dropped_at_hub', $3, 'seller', $4, $5::jsonb)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          request.id,
          `logistics.seller_dropoff.dropped_at_hub:${order.id}`,
          hasDoorDelivery
            ? 'Seller dropped the package at the hub. Door delivery can proceed.'
            : 'Seller dropped the package at the hub. Buyer can collect from the hub.',
          null,
          JSON.stringify({ order_id: order.id, seller_id: sellerId, has_door_delivery: hasDoorDelivery })
        ]
      );

      await client.query('COMMIT');
      await this._emitOrderUpdate(
        order.id,
        oldStatus,
        newStatus,
        hasDoorDelivery ? 'Package dropped at hub. Door delivery will proceed.' : 'Package dropped at hub. Buyer can collect from the hub.',
        'OrderService.markDroppedAtHub'
      );
      return updatedRows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async confirmBooking(orderId, sellerId) {
    const client = await pool.connect();
    let oldStatus = null;
    const newStatus = OrderStatus.FULFILLING;

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT *
         FROM product_orders
         WHERE id = $1
           AND seller_id = $2
         FOR UPDATE`,
        [orderId, sellerId]
      );
      const order = rows[0];

      if (!order) {
        throw new Error('Order not found or unauthorized');
      }
      if (!this._isPaidOrder(order)) {
        throw new Error('Booking can only be confirmed after buyer payment succeeds');
      }
      if (String(order.order_type || '').toUpperCase() !== OrderType.SERVICE) {
        throw new Error('Confirm Booking is only available for service orders');
      }

      oldStatus = order.status;
      if (![OrderStatus.AWAITING_SELLER_ACTION, OrderStatus.SERVICE_PENDING, OrderStatus.BOOKED, OrderStatus.CONFIRMED, OrderStatus.PAID].includes(order.status)) {
        throw new Error(`Cannot confirm booking for order in ${order.status} status`);
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE product_orders
         SET status = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          order.id,
          newStatus,
          JSON.stringify({
            service_confirmation: {
              status: 'confirmed',
              confirmed_at: new Date().toISOString()
            }
          })
        ]
      );

      await client.query('COMMIT');
      await this._emitOrderUpdate(order.id, oldStatus, newStatus, 'Seller confirmed the service booking.', 'OrderService.confirmBooking');
      return updatedRows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel an order and handle inventory restoration and buyer refund tracking
   */
  static async cancelOrder(orderId, reason = null) {
    return OrderCancellationService.cancelOrder(orderId, reason);
  }

  static async _getSellerDetails(client, sellerId) {
    return OrderReadService.getSellerDetails(client, sellerId);
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

    // Fix: Robustly extract the start time if booking_time is a range (e.g. "10:00 - 11:00")
    // Use the first 5 characters (HH:mm) or split by space
    const startTime = metadata.booking_time.split(' ')[0].trim();
    const timeSlot = new Date(`${metadata.booking_date}T${startTime}`);

    if (isNaN(timeSlot.getTime())) {
      logger.error(`[RESERVATION-ERROR] Failed to parse slot: date=${metadata.booking_date}, time=${metadata.booking_time}, attempted=${startTime}`);
      throw new Error('Invalid booking date or time format');
    }

    // Try to insert with explicit conflict handling
    const result = await client.query(
      `INSERT INTO service_slots (service_id, time_slot, status, reserved_by_order_id, expires_at)
       VALUES ($1, $2, 'RESERVED', $3, NOW() + INTERVAL '15 minutes')
       ON CONFLICT (service_id, time_slot) DO UPDATE
         SET 
           status = 'RESERVED',
           reserved_by_order_id = $3,
           expires_at = NOW() + INTERVAL '15 minutes',
           updated_at = NOW()
         WHERE 
           service_slots.status = 'AVAILABLE' 
           OR (service_slots.status = 'RESERVED' AND service_slots.expires_at < NOW())
           OR (service_slots.reserved_by_order_id = $3)
       RETURNING id, status`,
      [productId, timeSlot, orderId]
    );

    if (result.rows.length === 0) {
      const currentSlot = await client.query(
        `SELECT status, expires_at, reserved_by_order_id FROM service_slots 
         WHERE service_id = $1 AND time_slot = $2`,
        [productId, timeSlot]
      );

      if (currentSlot.rows[0]?.status === 'BOOKED') {
        throw new Error('This time slot has already been booked. Please select a different time.');
      }

      throw new Error('This time slot is no longer available. Please select another slot.');
    }

    logger.info(`[SLOT-RESERVATION] Reserved slot ${timeSlot.toISOString()} for service ${productId} (Order ${orderId})`);
    return result.rows[0];
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
  /**
   * Complete an order after successful payment.
   * LEGACY WRAPPER: Now delegates to the state machine via executeFulfillment.
   */
  static async completeOrder(payment, externalClient = null) {
    const client = externalClient || await pool.connect();
    const shouldManageTransaction = !externalClient;
    let paidEventId = null;

    try {
      const { metadata = {} } = payment;
      const orderId = metadata.order_id;
      if (!orderId) throw new Error('No order_id found in payment metadata');

      if (shouldManageTransaction) await client.query('BEGIN');

      const { rows } = await client.query('SELECT * FROM product_orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (rows.length === 0) throw new Error('Order not found');
      const order = rows[0];

      await OrderFulfillmentTransitionService.executeFulfillment(client, order);
      const paidEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.PAID, {
        eventId: `order.paid:${order.id}:${payment.id}`,
        order,
        paymentId: payment.id
      });
      paidEventId = paidEvent.eventId;

      if (shouldManageTransaction) await client.query('COMMIT');
      if (shouldManageTransaction) eventBus.dispatchAfterCommit(paidEventId, 'OrderService.completeOrder');
      return { success: true };
    } catch (err) {
      if (shouldManageTransaction) await client.query('ROLLBACK');
      logger.error('[FULFILLMENT] completeOrder failed:', err);
      throw err;
    } finally {
      if (shouldManageTransaction) client.release();
    }
  }

  static async executeFulfillment(client, order) {
    return OrderFulfillmentTransitionService.executeFulfillment(client, order);
  }

  static async _processSellerPayout(client, order) {
    const releaseResult = await escrowManager.releaseFunds(client, order, 'OrderService');
    if (!releaseResult.success && !releaseResult.alreadyReleased) {
      throw new Error(`Escrow release blocked: ${releaseResult.reason || 'unknown_reason'}`);
    }
    return releaseResult;
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
        const details = await OrderReadService.getStatusNotificationDetails(orderId);

        if (details) {
          const { fullOrder, items } = details;
          const normalizedOrder = this._prepareNormalizedNotificationPayload(fullOrder, items);

          await eventBus.enqueueAndDispatch(AppEvents.ORDER.UPDATED, {
            eventId: `order.updated:${orderId}:${OrderStatus.COMPLETED}`,
            payload: {
              buyer: normalizedOrder.buyer,
              seller: normalizedOrder.seller,
              order: normalizedOrder,
              newStatus: OrderStatus.COMPLETED,
              oldStatus: OrderStatus.COLLECTION_PENDING,
              notes: 'Status updated via dashboard'
            }
          }, 'OrderService.markAsCollected');
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

      const metadata = typeof order.metadata === 'string'
        ? JSON.parse(order.metadata || '{}')
        : (order.metadata || {});
      const orderType = String(order.order_type || metadata.product_type || metadata.order_type || '').toLowerCase();
      const isServiceOrder = orderType === 'service';
      const buyerConfirmStatuses = [
        OrderStatus.DELIVERY_COMPLETE,
        OrderStatus.COLLECTION_PENDING,
        OrderStatus.READY_FOR_BUYER
      ];

      let canConfirmReceipt = buyerConfirmStatuses.includes(order.status);
      if (!canConfirmReceipt && isServiceOrder) {
        canConfirmReceipt = [OrderStatus.CONFIRMED, OrderStatus.FULFILLING].includes(order.status);
      }
      if (!canConfirmReceipt && order.status === OrderStatus.FULFILLING) {
        const deliveryLegResult = await client.query(
          `SELECT ll.status
           FROM logistics_requests lr
           JOIN logistics_legs ll
             ON ll.logistics_request_id = lr.id
            AND ll.leg_type = 'delivery'
           WHERE lr.order_id = $1
           ORDER BY ll.created_at DESC
           LIMIT 1`,
          [orderId]
        );
        const deliveryStatus = String(deliveryLegResult.rows[0]?.status || '').toLowerCase();
        canConfirmReceipt = deliveryStatus === 'delivered' || deliveryStatus === 'completed';
      }

      if (!canConfirmReceipt) {
        throw new Error(`Cannot confirm receipt for order in ${order.status} status`);
      }

      const updatedOrder = await Order.updateStatusWithSideEffects(client, orderId, OrderStatus.COMPLETED, 'completed');
      await this._processSellerPayout(client, updatedOrder);

      await client.query('COMMIT');

      // 6. Send Notifications
      try {
        const fullOrder = await OrderReadService.getReceiptNotificationDetails(orderId);

        if (fullOrder) {
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

          await eventBus.enqueueAndDispatch(AppEvents.ORDER.UPDATED, {
            eventId: `order.updated:${orderId}:${OrderStatus.COMPLETED}:receipt`,
            payload: notificationPayload
          }, 'OrderService.confirmOrderReceipt');
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

      eventBus.emit(AppEvents.INVENTORY.LOW_STOCK, {
        eventId: `inventory.low_stock:${sellerId}:${productName}:${currentQuantity}`,
        sellerPhone,
        productName,
        currentQuantity,
        threshold
      });
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

      eventBus.emit(AppEvents.INVENTORY.OUT_OF_STOCK, {
        eventId: `inventory.out_of_stock:${sellerId}:${productName}`,
        sellerPhone,
        productName
      });
      logger.info(`[INVENTORY] Out of stock alert sent to seller ${sellerId} for product ${productName}`);
    } catch (error) {
      logger.error('[INVENTORY] Error sending out of stock alert:', error);
      throw error;
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

  static _determineCompletionStatus(items, fulfillmentType, order, metadata) {

    // 1. DIGITAL FLOW
    if (fulfillmentType === FulfillmentType.DIGITAL ||
      items.every(i => (i.product_type || i.productType || '').toLowerCase() === 'digital')) {
      return OrderStatus.COMPLETED;
    }

    // 2. SERVICE FLOW
    const isService = order.order_type === OrderType.SERVICE ||
      fulfillmentType === FulfillmentType.SELLER_TO_BUYER ||
      items.some(i => (i.product_type || i.productType || '').toLowerCase() === 'service');

    if (isService) {
      return OrderStatus.SERVICE_PENDING;
    }

    // 3. PHYSICAL FLOW
    if (fulfillmentType === FulfillmentType.BUYER_TO_SELLER) {
      return OrderStatus.COLLECTION_PENDING; // Pickup at shop
    }

    // Default physical products to DELIVERY_PENDING if specifically COURIER or fulfillment indeterminate
    return OrderStatus.DELIVERY_PENDING;
  }

  static _buildBuyerNotificationData(fullOrder) {
    return OrderNotificationPayloadService.buildBuyerNotificationData(fullOrder);
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

    // 3. Notifications (FIX 7: Explicit Column Aliases & Robust Fetch)
    try {
      let fullOrder = await OrderReadService.getFulfillmentNotificationDetails(orderId);
      if (!fullOrder) return;

      // 1. Idempotency Guard (Payment Status)
      // If the webhook is a retry and we already processed this, skip.
      if (payment && payment.status === 'success' && fullOrder.payment_status === 'paid' && fullOrder.notification_sent) {
        return logger.info(`[ORDER] Side effects already processed for order ${orderId}. Skipping.`);
      }

      // 2. Legacy Fallback (Apply extracting only if flat columns are missing)
      fullOrder = this.extractFromLegacy(fullOrder);

      // 3. BUILD NORMALIZED PAYLOAD (Single Source of Truth)
      const normalizedOrder = this._prepareNormalizedNotificationPayload(fullOrder, items);

      const isSellerInitiated = fullOrder.metadata?.seller_initiated === true;

      // Always notify Seller via Email
      if (fullOrder.seller_email) {
        sendNewOrderNotificationEmail(fullOrder.seller_email, {
          ...fullOrder,
          seller_name: fullOrder.seller_name,
          items
        }).catch(e => logger.error('[ORDER] Seller notification email failed:', e));
      }

      if (isSellerInitiated) return logger.info(`[ORDER] Skipping buyer notifications for legacy seller-originated order #${fullOrder.order_number}`);

      // Persist buyer location for mobile service orders
      // FIX 7: Robust parsing of metadata if it arrives as string
      const ordMeta = typeof fullOrder.metadata === 'string'
        ? JSON.parse(fullOrder.metadata)
        : (fullOrder.metadata || {});

      const isServiceOrder = fullOrder.order_type === 'SERVICE' || ordMeta.product_type === 'service';

      // Fix: Relax check to allow lat=0
      const hasBuyerCoords = (fullOrder.location_lat !== null && fullOrder.location_lat !== undefined) &&
        (fullOrder.location_lng !== null && fullOrder.location_lng !== undefined);

      if (isServiceOrder && hasBuyerCoords && fullOrder.buyer_id) {
        Buyer.updateLocation(fullOrder.buyer_id, {
          latitude: fullOrder.location_lat,
          longitude: fullOrder.location_lng,
          fullAddress: fullOrder.location_address || null
        }).catch(err => logger.warn('[ORDER] Failed to persist buyer location in side-effects:', err.message));
      }

      // WHATSAPP NOTIFICATIONS (Once-only for Buyer/Seller)
      if (!fullOrder.notification_sent) {
        // Enforce re-parsing for digital properties if missing in normalized payload
        if (fullOrder.order_type === 'DIGITAL') {
          const freshMeta = typeof fullOrder.metadata === 'string' ? JSON.parse(fullOrder.metadata) : (fullOrder.metadata || {});
          normalizedOrder.downloadUrl = freshMeta.download_url || freshMeta.downloadUrl || null;
          normalizedOrder.downloadUrls = freshMeta.download_urls || freshMeta.downloadUrls || [];
        }

        await eventBus.enqueueAndDispatch(AppEvents.ORDER.FULFILLED, {
          eventId: `order.fulfilled:${orderId}`,
          order: normalizedOrder,
          items
        }, 'OrderService._handleOrderCompletionSideEffects');

        // Mark as sent
        await pool.query('UPDATE product_orders SET notification_sent = true WHERE id = $1', [orderId]);
      }

      // 4. Logistics / Courier Notification (Always attempt for Physical and no Shop)
      const hasPhysical = items.some(i => (i.product_type || i.productType || '').toLowerCase() === 'physical');
      const isCourier = fullOrder.fulfillment_type === 'COURIER';

      logger.info(`[COURIER-CHECK] Order #${fullOrder.order_number}: hasPhysical=${hasPhysical}, isCourier=${isCourier}, type=${fullOrder.fulfillment_type}`);

      if (hasPhysical && isCourier) {
        logger.info(`[COURIER-NOTIFY] Logistics notification is handled by ORDER.FULFILLED for order #${fullOrder.order_number}`);
      }

      // Notify Buyer via Email for buyer checkout orders.
      if (normalizedOrder.buyer.email) {
        sendProductOrderConfirmationEmail(normalizedOrder.buyer.email, {
          ...fullOrder,
          items
        }).catch(e => logger.error('[ORDER] Buyer confirmation email failed:', e));
      }

    } catch (e) {
      logger.error('[ORDER] Error triggering completion notifications:', e);
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

  /**
   * Constructs a single source of truth object for notifications
   * This is M-R-1 / M-R-4 pattern from User Request
   */
  static _prepareNormalizedNotificationPayload(fullOrder, items) {
    return OrderNotificationPayloadService.prepareNormalizedNotificationPayload(fullOrder, items);
  }

  /**
   * Safe fallback for legacy orders missing new flat columns.
   * This ensures backward compatibility for reads only.
   */
  static extractFromLegacy(order) {
    return OrderNotificationPayloadService.extractFromLegacy(order);
  }
}

export default OrderService;




