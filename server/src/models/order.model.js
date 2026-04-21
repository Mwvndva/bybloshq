import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, PaymentStatus, ProductType } from '../constants/enums.js';
import { safeJson } from '../utils/order.utils.js';

class Order {
  /**
   * Pure DAO method to insert an order record
   * Expects client to be passed for transaction support
   */
  static async insert(client, data) {
    // 1. Pre-insertion Validation
    if (!data.order_number) throw new Error('Order number is required');
    if (!data.seller_id) throw new Error('Seller ID is required');
    if (!data.buyer_email) throw new Error('buyer_email is required for DB insert');

    // 2. Static SQL Query (EXPLICIT CASTING - PIN-12: UNBREAKABLE)
    const query = `
      INSERT INTO product_orders (
        order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
        payment_method, buyer_name, buyer_email, buyer_mobile_payment, buyer_whatsapp_number,
        notes, metadata, status, payment_status, service_requirements, is_debt, client_id, is_seller_initiated,
        fulfillment_type, delivery_location, order_type, total_quantity, reservation_expires_at,
        location_address, location_lat, location_lng, service_title, notification_sent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
        $12, $13::jsonb, $14, $15, $16::jsonb, $17, $18, $19, 
        $20, $21::jsonb, $22, $23, $24, $25, $26, $27, $28, $29
      )
      RETURNING *
    `;

    /**
     * TRIPLE-LOCK SERIALIZATION (PIN-13: ABSOLUTE CERTAINTY)
     * 1. Manual stringification (safe for driver)
     * 2. Double-serialization protection
     * 3. Explicit SQL Casting (safe for Postgres)
     */
    const toStrictJson = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
        try {
          JSON.parse(val);
          return val; // Trust already-json string
        } catch (e) {
          return JSON.stringify(val); // Wrap raw string
        }
      }
      return JSON.stringify(val); // Object to string
    };

    // 4. Strict Value Mapping (Fixed Indices)
    const values = [
      data.order_number,                                     // $1
      data.buyer_id || null,                                 // $2
      data.seller_id,                                        // $3
      data.total_amount || 0,                                // $4
      data.platform_fee_amount || 0,                         // $5
      data.seller_payout_amount || 0,                        // $6
      data.payment_method || 'payd',                         // $7
      data.buyer_name || null,                               // $8
      data.buyer_email || null,                              // $9
      data.buyer_mobile_payment || null,                     // $10
      data.buyer_whatsapp_number || null,                    // $11
      data.notes || null,                                    // $12
      toStrictJson(data.metadata),                           // $13 (Forced String -> SQL Cast)
      data.status || 'PENDING',                              // $14
      data.payment_status || 'pending',                      // $15
      toStrictJson(data.service_requirements),               // $16 (Hardened Fallback)
      data.is_debt || false,                                 // $17
      data.client_id || null,                                // $18
      data.is_seller_initiated || false,                    // $19
      data.fulfillment_type || null,                         // $20
      toStrictJson(data.delivery_location),                  // $21 (Forced String -> SQL Cast)
      data.order_type || 'PHYSICAL',                         // $22
      data.total_quantity || 1,                              // $23
      data.reservation_expires_at instanceof Date            // $24
        ? data.reservation_expires_at
        : (data.reservation_expires_at ? new Date(data.reservation_expires_at) : null),
      data.location_address || null,                         // $25
      data.location_lat || null,                             // $26
      data.location_lng || null,                             // $27
      data.service_title || null,                            // $28
      data.notification_sent || false                       // $29
    ];

    // 5. DEFENSIVE AUDITING (FINAL)
    // Only strings or null should reach JSON columns now ($13, $16, $21)
    const jsonIndices = [12, 15, 20]; // index: $13, $16, $21
    values.forEach((val, i) => {
      const colNum = i + 1;
      if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        logger.error(`[CRITICAL] Unexpected object detected at $${colNum}:`, val);
        throw new Error(`Architectural Violation: Raw object passed to $${colNum}. Every JSON field must be stringified before insert.`);
      }
    });

    const executor = client || pool;

    try {
      const result = await executor.query(query, values);
      return result.rows[0];
    } catch (error) {
      const valueSummary = JSON.stringify(values, (key, value) => {
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2);
      logger.error(`--- DATABASE INSERT ERROR (TRIPLE-LOCK) ---\nMessage: ${error.message}\nValues: ${valueSummary}`);
      throw error;
    }
  }

  /**
   * Pure DAO method to insert order items
   */
  static async insertItems(client, orderId, items) {
    // ... items logic ...
    const itemsMissingDetails = items.filter(item => !item.productType && item.isDigital === undefined);
    const productIds = itemsMissingDetails.map(item => Number.parseInt(item.productId, 10));

    let productsMap = new Map();
    if (productIds.length > 0) {
      const productsQuery = `
        SELECT id, product_type::text as product_type, is_digital, image_url, digital_file_name
        FROM products
        WHERE id = ANY($1)
      `;
      const executor = client || pool;
      const productsResult = await executor.query(productsQuery, [productIds]);
      productsMap = new Map(productsResult.rows.map(p => [p.id, p]));
    }

    const itemValues = items.map(item => {
      const subtotal = item.subtotal || (item.price * item.quantity);
      const productId = Number.parseInt(item.productId, 10);
      const productDetails = productsMap.get(productId);

      return [
        orderId,
        productId,
        item.name || `Product ${item.productId}`,
        parseFloat(item.price).toFixed(2),
        Number.parseInt(item.quantity, 10),
        parseFloat(subtotal).toFixed(2),
        {
          ...(item.metadata || {}),
          original_price: item.price,
          original_quantity: item.quantity,
          productType: productDetails?.product_type || item.productType || 'physical',
          isDigital: productDetails?.is_digital || item.isDigital || false,
          imageUrl: productDetails?.image_url || item.imageUrl,
          digitalFileName: productDetails?.digital_file_name || item.digitalFileName
        }
      ];
    });

    const itemQuery = `
      INSERT INTO order_items (
        order_id, product_id, product_name, product_price, quantity, subtotal, metadata
      ) VALUES ${itemValues.map((_, i) =>
      `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}::numeric, $${i * 7 + 5}, $${i * 7 + 6}::numeric, $${i * 7 + 7})`
    ).join(', ')}
      RETURNING *
    `;

    const executor = client || pool;
    const flattenedValues = itemValues.flat();
    const result = await executor.query(itemQuery, flattenedValues);
    return result.rows;
  }

  static async updateOrderStatus(orderId, status, notes = null) {
    const query = `
      UPDATE product_orders 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;


    const { rows } = await pool.query(query, [status, orderId]);
    return rows[0];
  }

  static async updatePaymentStatus(orderId, status, paymentReference = null) {
    // First, get current order to check if paid_at should be set
    const currentOrderQuery = 'SELECT paid_at FROM product_orders WHERE id = $1';
    const currentOrderResult = await pool.query(currentOrderQuery, [orderId]);
    const currentOrder = currentOrderResult.rows[0];

    const shouldSetPaidAt = (status === 'success' || status === 'completed') && !currentOrder.paid_at;

    const query = `
      UPDATE product_orders 
      SET 
        payment_status = $1,
        payment_reference = $2,
        paid_at = ${shouldSetPaidAt ? 'NOW()' : 'paid_at'},
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;


    const { rows } = await pool.query(query, [status, paymentReference, orderId]);
    return rows[0];
  }

  static async findById(orderId) {
    const query = `
      SELECT 
        o.id,
        o.order_number as "orderNumber",
        o.buyer_id as "buyerId",
        o.seller_id as "sellerId",
        o.total_amount as "totalAmount",
        o.platform_fee_amount as "platformFeeAmount",
        o.seller_payout_amount as "sellerPayoutAmount",
        o.payment_method as "paymentMethod",
        o.buyer_name as "buyerName",
        o.buyer_email as "buyerEmail",
        o.buyer_mobile_payment as "buyerMobilePayment",
        o.buyer_whatsapp_number as "buyerWhatsappNumber",
        o.notes,
        o.metadata,
        o.status,
        o.payment_status as "paymentStatus",
        o.payment_reference as "paymentReference",
        o.service_requirements as "serviceRequirements",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        o.paid_at as "paidAt",
        o.completed_at as "completedAt",
        o.cancelled_at as "cancelledAt",
        o.total_quantity as "totalQuantity",
        o.reservation_expires_at as "reservationExpiresAt",
        o.location_address as "locationAddress",
        o.location_lat as "locationLat",
        o.location_lng as "locationLng",
        o.service_title as "serviceTitle",
        o.notification_sent as "notificationSent",
        json_build_object(
          'id', s.id,
          'name', s.full_name,
          'shopName', s.shop_name,
          'theme', s.theme,
          'clientCount', s.client_count
        ) as seller,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'productId', oi.product_id,
              'name', oi.product_name,
              'price', oi.product_price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'productType', COALESCE(oi.metadata->>'productType', 'physical'),
              'isDigital', COALESCE(p.is_digital, (oi.metadata->>'isDigital')::boolean, false),
              'digitalFileName', COALESCE(p.digital_file_name, oi.metadata->>'digitalFileName'),
              'metadata', oi.metadata,
              'imageUrl', COALESCE(p.image_url, oi.metadata->>'imageUrl')
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE o.id = $1
      GROUP BY o.id, s.id
    `;

    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async findByReference(reference) {
    const query = `
      SELECT 
        o.id,
        o.order_number as "orderNumber",
        o.buyer_id as "buyerId",
        o.seller_id as "sellerId",
        o.total_amount as "totalAmount",
        o.platform_fee_amount as "platformFeeAmount",
        o.seller_payout_amount as "sellerPayoutAmount",
        o.payment_method as "paymentMethod",
        o.buyer_name as "buyerName",
        o.buyer_email as "buyerEmail",
        o.buyer_mobile_payment as "buyerMobilePayment",
        o.buyer_whatsapp_number as "buyerWhatsappNumber",
        o.notes,
        o.metadata,
        o.status,
        o.payment_status as "paymentStatus",
        o.payment_reference as "paymentReference",
        o.service_requirements as "serviceRequirements",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        o.paid_at as "paidAt",
        o.completed_at as "completedAt",
        o.cancelled_at as "cancelledAt",
        o.fulfillment_type as "fulfillmentType",
        o.delivery_location as "deliveryLocation",
        o.order_type as "orderType",
        o.total_quantity as "totalQuantity",
        o.reservation_expires_at as "reservationExpiresAt",
        o.location_address as "locationAddress",
        o.location_lat as "locationLat",
        o.location_lng as "locationLng",
        o.service_title as "serviceTitle",
        o.notification_sent as "notificationSent",
        json_build_object(
          'id', s.id,
          'name', s.full_name,
          'shopName', s.shop_name,
          'theme', s.theme,
          'clientCount', s.client_count
        ) as seller,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'productId', oi.product_id,
              'name', oi.product_name,
              'price', oi.product_price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'productType', COALESCE(oi.metadata->>'productType', 'physical'),
              'isDigital', COALESCE(p.is_digital, (oi.metadata->>'isDigital')::boolean, false),
              'digitalFileName', COALESCE(p.digital_file_name, oi.metadata->>'digitalFileName'),
              'metadata', oi.metadata,
              'imageUrl', COALESCE(p.image_url, oi.metadata->>'imageUrl')
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE o.order_number = $1 OR o.payment_reference = $1
      GROUP BY o.id, s.id
    `;

    const { rows } = await pool.query(query, [reference]);
    return rows[0];
  }

  static async findByBuyerId(buyerId, { page = 1, limit = 10, status } = {}) {
    const offset = (page - 1) * limit;
    const params = [buyerId];

    let whereClause = 'WHERE o.buyer_id = $1';

    if (status) {
      params.push(status);
      whereClause += ` AND o.status = $${params.length}`;
    }

    const query = `

      SELECT 
        o.id,
        o.order_number as "orderNumber",
        o.buyer_id as "buyerId",
        o.seller_id as "sellerId",
        o.total_amount as "totalAmount",
        o.payment_method as "paymentMethod",
        o.buyer_name as "buyerName",
        o.notes,
        o.metadata,
        o.status,
        o.payment_status as "paymentStatus",
        o.payment_reference as "paymentReference",
        o.service_requirements as "serviceRequirements",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        o.paid_at as "paidAt",
        o.completed_at as "completedAt",
        o.cancelled_at as "cancelledAt",
        o.fulfillment_type as "fulfillmentType",
        o.delivery_location as "deliveryLocation",
        o.order_type as "orderType",
        o.total_quantity as "totalQuantity",
        o.reservation_expires_at as "reservationExpiresAt",
        o.location_address as "locationAddress",
        o.location_lat as "locationLat",
        o.location_lng as "locationLng",
        o.service_title as "serviceTitle",
        o.notification_sent as "notificationSent",
        json_build_object(
          'id', s.id,
          'name', s.full_name,
          'shopName', s.shop_name,
          'theme', s.theme,
          'clientCount', s.client_count,
          'isClient', (sc.user_id IS NOT NULL)
        ) as seller,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'productId', oi.product_id,
              'name', oi.product_name,
              'price', oi.product_price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'productType', COALESCE(oi.metadata->>'productType', 'physical'),
              'isDigital', COALESCE(p.is_digital, (oi.metadata->>'isDigital')::boolean, false),
              'digitalFileName', COALESCE(p.digital_file_name, oi.metadata->>'digitalFileName'),
              'metadata', oi.metadata,
              'imageUrl', COALESCE(p.image_url, oi.metadata->>'imageUrl')
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN buyers b ON o.buyer_id = b.id
      LEFT JOIN seller_clients sc ON s.id = sc.seller_id AND sc.user_id = b.user_id
      ${whereClause}
      GROUP BY o.id, s.id, sc.user_id
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;


    const countQuery = `
      SELECT COUNT(*) 
      FROM product_orders o
      ${whereClause}
    `;

    params.push(limit, offset);

    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    return {
      data: ordersResult.rows,
      pagination: {
        total: Number.parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  static async findBySellerId(sellerId, { page = 1, limit = 10, status } = {}) {
    const offset = (page - 1) * limit;
    const params = [sellerId];

    let whereClause = 'WHERE o.seller_id = $1';

    if (status) {
      params.push(status);
      whereClause += ` AND o.status = $${params.length}`;
    }

    const query = `
      SELECT 
        o.id,
        o.order_number as "orderNumber",
        o.buyer_id as "buyerId",
        o.seller_id as "sellerId",
        o.total_amount as "totalAmount",
        o.platform_fee_amount as "platformFeeAmount",
        o.seller_payout_amount as "sellerPayoutAmount",
        o.payment_method as "paymentMethod",
        o.buyer_name as "buyerName",
        o.buyer_email as "buyerEmail",
        o.buyer_mobile_payment as "buyerMobilePayment",
        o.buyer_whatsapp_number as "buyerWhatsappNumber",
        o.notes,
        o.metadata,
        o.status,
        o.payment_status as "paymentStatus",
        o.payment_reference as "paymentReference",
        o.service_requirements as "serviceRequirements",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        o.paid_at as "paidAt",
        o.completed_at as "completedAt",
        o.cancelled_at as "cancelledAt",
        o.fulfillment_type as "fulfillmentType",
        o.delivery_location as "deliveryLocation",
        o.order_type as "orderType",
        o.total_quantity as "totalQuantity",
        o.reservation_expires_at as "reservationExpiresAt",
        o.location_address as "locationAddress",
        o.location_lat as "locationLat",
        o.location_lng as "locationLng",
        o.service_title as "serviceTitle",
        o.notification_sent as "notificationSent",
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'productId', oi.product_id,
              'name', oi.product_name,
              'price', oi.product_price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'metadata', oi.metadata,
              'productType', COALESCE(oi.metadata->>'productType', 'physical'),
              'isDigital', COALESCE(p.is_digital, (oi.metadata->>'isDigital')::boolean, false),
              'digitalFileName', COALESCE(p.digital_file_name, oi.metadata->>'digitalFileName'),
              'imageUrl', COALESCE(p.image_url, oi.metadata->>'imageUrl')
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM product_orders o
      ${whereClause}
    `;

    params.push(limit, offset);

    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    return {
      data: ordersResult.rows,
      pagination: {
        total: Number.parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  static async markAsShipped(orderId, trackingNumber = null) {
    const query = `
      UPDATE product_orders 
      SET 
        status = 'shipped',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb), 
          '{tracking}', 
          $1::jsonb,
          true
        ),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const trackingData = trackingNumber ? { number: trackingNumber, date: new Date().toISOString() } : null;
    const { rows } = await pool.query(query, [JSON.stringify(trackingData), orderId]);
    return rows[0];
  }

  static async markAsDelivered(orderId) {
    const query = `
      UPDATE product_orders 
      SET 
        status = 'delivered',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async updateStatusWithSideEffects(client, orderId, status, paymentStatus, paymentReference = null, metadataOverride = null) {
    const query = `
      UPDATE product_orders 
      SET 
        status = $1::order_status,
        payment_status = $2::payment_status,
        payment_reference = COALESCE($3, payment_reference),
        metadata = CASE WHEN $5::jsonb IS NOT NULL THEN COALESCE(metadata, '{}'::jsonb) || $5::jsonb ELSE metadata END,
        updated_at = NOW(),
        paid_at = CASE WHEN $2::payment_status = 'completed'::payment_status AND paid_at IS NULL THEN NOW() ELSE paid_at END,
        completed_at = CASE WHEN $1::text = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
        cancelled_at = CASE WHEN $1::text = 'cancelled' AND cancelled_at IS NULL THEN NOW() ELSE cancelled_at END
      WHERE id = $4
      RETURNING *
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [status, paymentStatus, paymentReference, orderId, metadataOverride ? JSON.stringify(metadataOverride) : null]);
    return rows[0];
  }

  static async updateStatusWithReason(client, orderId, status, reason) {
    const updateOrderQuery = `
      UPDATE product_orders 
      SET 
        status = $1,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb), 
          '{cancellation_reason}', 
          $2::jsonb,
          true
        ),
        cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const executor = client || pool;
    const { rows } = await executor.query(updateOrderQuery, [status, JSON.stringify(reason), orderId]);
    return rows[0];
  }

  static async getOrderStats(sellerId = null) {
    const params = [];
    let whereClause = '';

    if (sellerId) {
      params.push(sellerId);
      whereClause = 'WHERE seller_id = $1';
    }

    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_orders,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_orders,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(platform_fee_amount), 0) as total_platform_fee,
        COALESCE(SUM(seller_payout_amount), 0) as total_seller_payout
      FROM product_orders
      ${whereClause}
    `;

    const { rows } = await pool.query(query, params);
    return rows[0];
  }
}

export default Order;
