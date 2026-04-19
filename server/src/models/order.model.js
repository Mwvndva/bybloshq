import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { OrderStatus, PaymentStatus, ProductType } from '../constants/enums.js';
import { safeJson, toJsonb } from '../utils/order.utils.js';

/**
 * PIN-02: UNIFIED SCHEMA MAPPING GUARD
 * Throws if mandatory fields are missing or if JSONB fields contain raw objects.
 */
export function validateOrderRecord(record) {
  const mandatory = ['order_number', 'seller_id', 'buyer_email'];
  for (const field of mandatory) {
    if (!record[field]) {
      throw new Error(`Order Record Failure: Missing mandatory field "${field}"`);
    }
  }

  // Ensure JSONB destined fields are stringified if present
  const jsonbFields = ['metadata', 'delivery_location', 'service_requirements', 'mpesa_receipt'];
  for (const field of jsonbFields) {
    if (record[field] && typeof record[field] === 'object') {
      throw new Error(`Order Record Integrity Violation: Raw object detected in JSONB position "${field}". Use toJsonb() or stringify before binding.`);
    }
  }
}

class Order {
  /**
   * Pure DAO method to insert an order record.
   * Static SQL query with 29 columns in fixed order.
   */
  static async insert(client, data) {
    validateOrderRecord(data);

    const query = `
      INSERT INTO product_orders (
        order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
        payment_method, buyer_name, buyer_email, buyer_mobile_payment, buyer_whatsapp_number,
        notes, metadata, status, payment_status, service_requirements, is_debt, client_id,
        is_seller_initiated, fulfillment_type, delivery_location, order_type, total_quantity,
        reservation_expires_at, location_address, location_lat, location_lng, service_title,
        notification_sent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
        $12, $13::jsonb, $14, $15, $16::jsonb, $17, $18, $19, 
        $20, $21::jsonb, $22, $23, $24, $25, $26, $27, $28, $29
      )
      RETURNING *
    `;

    const values = [
      data.order_number,                                     // $1
      data.buyer_id ?? null,                                 // $2
      data.seller_id,                                        // $3
      data.total_amount ?? 0,                                // $4
      data.platform_fee_amount ?? 0,                         // $5
      data.seller_payout_amount ?? 0,                        // $6
      data.payment_method ?? 'payd',                         // $7
      data.buyer_name ?? null,                               // $8
      data.buyer_email ?? null,                              // $9
      data.buyer_mobile_payment ?? null,                     // $10
      data.buyer_whatsapp_number ?? null,                    // $11
      data.notes ?? null,                                    // $12
      data.metadata ?? null,                                 // $13 (JSONB)
      data.status ?? 'PENDING',                              // $14
      data.payment_status ?? 'pending',                      // $15
      data.service_requirements ?? null,                     // $16 (JSONB)
      data.is_debt ?? false,                                 // $17
      data.client_id ?? null,                                // $18
      data.is_seller_initiated ?? false,                    // $19
      data.fulfillment_type ?? null,                         // $20
      data.delivery_location ?? null,                        // $21 (JSONB)
      data.order_type ?? 'PHYSICAL',                         // $22
      data.total_quantity ?? 1,                              // $23
      data.reservation_expires_at ? new Date(data.reservation_expires_at) : null, // $24
      data.location_address ?? null,                         // $25
      data.location_lat ?? null,                             // $26
      data.location_lng ?? null,                             // $27
      data.service_title ?? null,                            // $28
      data.notification_sent ?? false                       // $29
    ];

    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  static async insertItems(client, orderId, items) {
    const itemValues = items.map(item => {
      const subtotal = item.subtotal ?? (item.price * item.quantity);
      return [
        orderId,
        item.productId,
        item.name ?? `Product ${item.productId}`,
        parseFloat(item.price).toFixed(2),
        parseInt(item.quantity, 10),
        parseFloat(subtotal).toFixed(2),
        toJsonb(item.metadata || {})
      ];
    });

    const placeholders = itemValues.map((_, i) =>
      `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}::numeric, $${i * 7 + 5}, $${i * 7 + 6}::numeric, $${i * 7 + 7}::jsonb)`
    ).join(', ');

    const query = `
      INSERT INTO order_items (
        order_id, product_id, product_name, product_price, quantity, subtotal, metadata
      ) VALUES ${placeholders}
      RETURNING *
    `;

    const executor = client || pool;
    const { rows } = await executor.query(query, itemValues.flat());
    return rows;
  }

  static async updateOrderStatus(orderId, status) {
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
    const query = `
      UPDATE product_orders 
      SET 
        payment_status = $1,
        payment_reference = $2,
        paid_at = CASE WHEN $1 IN ('success', 'completed') AND paid_at IS NULL THEN NOW() ELSE paid_at END,
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
        o.id, o.order_number as "orderNumber", o.buyer_id as "buyerId", o.seller_id as "sellerId",
        o.total_amount as "totalAmount", o.platform_fee_amount as "platformFeeAmount",
        o.seller_payout_amount as "sellerPayoutAmount", o.payment_method as "paymentMethod",
        o.buyer_name as "buyerName", o.buyer_email as "buyerEmail",
        o.buyer_mobile_payment as "buyerMobilePayment", o.buyer_whatsapp_number as "buyerWhatsappNumber",
        o.notes, o.metadata, o.status, o.payment_status as "paymentStatus",
        o.payment_reference as "paymentReference", o.service_requirements as "serviceRequirements",
        o.created_at as "createdAt", o.updated_at as "updatedAt", o.paid_at as "paidAt",
        o.completed_at as "completedAt", o.cancelled_at as "cancelledAt",
        o.total_quantity as "totalQuantity", o.reservation_expires_at as "reservationExpiresAt",
        o.location_address as "locationAddress", o.location_lat as "locationLat",
        o.location_lng as "locationLng", o.service_title as "serviceTitle",
        o.notification_sent as "notificationSent",
        json_build_object(
          'id', s.id, 'name', s.full_name, 'shopName', s.shop_name, 'theme', s.theme
        ) as seller,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id, 'productId', oi.product_id, 'name', oi.product_name,
              'price', oi.product_price, 'quantity', oi.quantity, 'subtotal', oi.subtotal,
              'metadata', oi.metadata
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE o.id = $1
      GROUP BY o.id, s.id
    `;
    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async findByReference(reference) {
    const query = `
      SELECT *, order_number as "orderNumber", buyer_id as "buyerId", seller_id as "sellerId"
      FROM product_orders 
      WHERE order_number = $1 OR payment_reference = $1
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
      SELECT o.*, o.order_number as "orderNumber", s.shop_name as "shopName"
      FROM product_orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const { rows } = await pool.query(query, params);
    return { data: rows };
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
      SELECT o.*, o.order_number as "orderNumber"
      FROM product_orders o
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const { rows } = await pool.query(query, params);
    return { data: rows };
  }

  static async markAsShipped(orderId, trackingNumber = null) {
    const query = `
      UPDATE product_orders 
      SET 
        status = 'shipped',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tracking}', $1::jsonb, true),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const trackingData = trackingNumber ? { number: trackingNumber, date: new Date().toISOString() } : null;
    const { rows } = await pool.query(query, [toJsonb(trackingData), orderId]);
    return rows[0];
  }

  static async markAsDelivered(orderId) {
    const query = `UPDATE product_orders SET status = 'delivered', updated_at = NOW() WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async updateStatusWithSideEffects(client, orderId, status, paymentStatus, paymentReference = null) {
    const query = `
      UPDATE product_orders 
      SET 
        status = $1::order_status,
        payment_status = $2::payment_status,
        payment_reference = COALESCE($3, payment_reference),
        updated_at = NOW(),
        paid_at = CASE WHEN $2::payment_status = 'completed'::payment_status AND paid_at IS NULL THEN NOW() ELSE paid_at END,
        completed_at = CASE WHEN $1::text = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
        cancelled_at = CASE WHEN $1::text = 'cancelled' AND cancelled_at IS NULL THEN NOW() ELSE cancelled_at END
      WHERE id = $4
      RETURNING *
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [status, paymentStatus, paymentReference, orderId]);
    return rows[0];
  }

  static async updateStatusWithReason(client, orderId, status, reason) {
    const query = `
      UPDATE product_orders 
      SET 
        status = $1,
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cancellation_reason}', $2::jsonb, true),
        cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [status, toJsonb(reason), orderId]);
    return rows[0];
  }

  static async linkBuyerByEmail(client, buyerId, email) {
    const query = 'UPDATE product_orders SET buyer_id = $1 WHERE LOWER(buyer_email) = $2 AND buyer_id IS NULL';
    const executor = client || pool;
    const result = await executor.query(query, [buyerId, email.toLowerCase()]);
    if (result.rowCount > 0) {
      logger.info(`[Order] Linked ${result.rowCount} previous guest orders for buyer: ${email}`);
    }
    return result.rowCount;
  }

  static async calculateGmv(client, sellerId, month, year) {
    const query = `
      SELECT COALESCE(SUM(seller_payout_amount), 0) AS gmv
      FROM product_orders
      WHERE seller_id = $1
        AND payment_status = 'completed'
        AND EXTRACT(MONTH FROM paid_at AT TIME ZONE 'Africa/Nairobi') = $2
        AND EXTRACT(YEAR FROM paid_at AT TIME ZONE 'Africa/Nairobi') = $3
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [sellerId, month, year]);
    return Number.parseFloat(rows[0].gmv);
  }

  static async markPayoutProcessed(client, orderId) {
    const query = `
      UPDATE product_orders 
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{payout_processed}', 'true'::jsonb),
          updated_at = NOW()
      WHERE id = $1
    `;
    const executor = client || pool;
    await executor.query(query, [orderId]);
  }

  static async findFullDetailsForNotification(orderId) {
    const query = `
      SELECT o.id, o.order_number, o.total_amount, o.status, o.order_type, o.fulfillment_type, 
             o.metadata, o.buyer_id, o.seller_id, o.location_address, o.location_lat, o.location_lng,
             o.service_title, o.service_requirements, o.payment_status, o.payment_method, o.payment_reference,
             o.notification_sent, o.total_quantity,
             b.full_name AS buyer_name, b.mobile_payment AS buyer_mobile_payment,
             b.email AS buyer_email,
             s.full_name AS seller_name, s.shop_name, s.whatsapp_number AS seller_phone, 
             s.email AS seller_email, s.physical_address AS seller_address,
             s.latitude AS seller_latitude, s.longitude AS seller_longitude,
             s.instagram_link, s.tiktok_link, s.facebook_link
      FROM product_orders o
      LEFT JOIN buyers b ON o.buyer_id = b.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE o.id = $1
    `;
    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async updateNotificationSent(client, orderId) {
    const query = 'UPDATE product_orders SET notification_sent = true WHERE id = $1';
    const executor = client || pool;
    await executor.query(query, [orderId]);
  }

  static async findActiveByDebtId(client, debtId) {
    const query = `
      SELECT id, order_number as "orderNumber", status 
      FROM product_orders 
      WHERE (metadata->>'debt_id')::int = $1 
        AND status NOT IN ('FAILED', 'CANCELLED')
      LIMIT 1
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [debtId]);
    return rows[0];
  }

  static async checkOrderNumberExists(client, orderNumber) {
    const query = 'SELECT id FROM product_orders WHERE order_number = $1';
    const executor = client || pool;
    const { rows } = await executor.query(query, [orderNumber]);
    return rows.length > 0;
  }

  static async updateDeadline(client, orderId, options = {}) {
    const { sellerDropoff = null, buyerPickup = null, readyForPickupAt = null } = options;
    const query = `
      UPDATE product_orders 
      SET seller_dropoff_deadline = COALESCE($1, seller_dropoff_deadline),
          buyer_pickup_deadline = COALESCE($2, buyer_pickup_deadline),
          ready_for_pickup_at = COALESCE($3, ready_for_pickup_at),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const executor = client || pool;
    const { rows } = await executor.query(query, [sellerDropoff, buyerPickup, readyForPickupAt, orderId]);
    return rows[0];
  }

  static async deleteItemsByOrderId(client, orderId) {
    const query = 'DELETE FROM order_items WHERE order_id = $1';
    const executor = client || pool;
    await executor.query(query, [orderId]);
  }

  static async deleteItemsByOrderIds(client, orderIds) {
    const query = 'DELETE FROM order_items WHERE order_id = ANY($1)';
    const executor = client || pool;
    await executor.query(query, [orderIds]);
  }

  static async deleteBySellerId(client, sellerId) {
    const query = 'DELETE FROM product_orders WHERE seller_id = $1 RETURNING id';
    const executor = client || pool;
    const { rows } = await executor.query(query, [sellerId]);
    return rows.map(r => r.id);
  }

  static async deleteByBuyerId(client, buyerId) {
    const query = 'DELETE FROM product_orders WHERE buyer_id = $1 RETURNING id';
    const executor = client || pool;
    const { rows } = await executor.query(query, [buyerId]);
    return rows.map(r => r.id);
  }

  static async findExpiredSellerDeadlines() {
    const query = `
      SELECT po.*, 
             b.whatsapp_number as buyer_phone, b.full_name as buyer_name, b.email as buyer_email,
             s.whatsapp_number as seller_phone, s.full_name as seller_name, s.physical_address as physical_address
      FROM product_orders po
      LEFT JOIN buyers b ON po.buyer_id = b.id
      LEFT JOIN sellers s ON po.seller_id = s.id
      WHERE po.seller_dropoff_deadline < NOW()
        AND po.status = 'DELIVERY_PENDING'
        AND po.auto_cancelled_reason IS NULL
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async findExpiredBuyerDeadlines() {
    const query = `
      SELECT po.*, 
             b.whatsapp_number as buyer_phone, b.full_name as buyer_name, b.email as buyer_email,
             s.whatsapp_number as seller_phone, s.full_name as seller_name, s.physical_address as physical_address
      FROM product_orders po
      LEFT JOIN buyers b ON po.buyer_id = b.id
      LEFT JOIN sellers s ON po.seller_id = s.id
      WHERE po.buyer_pickup_deadline < NOW()
        AND po.status = 'DELIVERY_COMPLETE'
        AND po.auto_cancelled_reason IS NULL
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async findServiceOrdersForPaymentRelease() {
    const query = `
      SELECT po.*, 
             b.whatsapp_number as buyer_phone, b.full_name as buyer_name, b.email as buyer_email,
             s.whatsapp_number as seller_phone, s.full_name as seller_name, s.balance as seller_balance, s.physical_address as physical_address
      FROM product_orders po
      LEFT JOIN buyers b ON po.buyer_id = b.id
      LEFT JOIN sellers s ON po.seller_id = s.id
      WHERE po.status = 'DELIVERY_COMPLETE'
        AND po.payment_status != 'completed'
        AND po.metadata->>'product_type' = 'service'
        AND (po.metadata->>'booking_date')::timestamp < NOW() - INTERVAL '24 hours'
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async findExpiredReservations() {
    const query = `
      SELECT po.id, po.order_number, po.status, po.order_type,
             json_agg(json_build_object('productId', oi.product_id, 'quantity', oi.quantity, 'trackInventory', (p.track_inventory = true))) as items
      FROM product_orders po
      JOIN order_items oi ON po.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE po.status = 'RESERVED'
        AND po.reservation_expires_at < NOW()
      GROUP BY po.id
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async updateStatusWithExpiry(client, orderId) {
    const query = `
      UPDATE product_orders 
      SET status = 'EXPIRED',
          metadata = COALESCE(metadata, '{}'::jsonb) || '{"expiry_reason": "Payment window (10 min) exceeded"}'::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `;
    const executor = client || pool;
    await executor.query(query, [orderId]);
  }
}

export default Order;

