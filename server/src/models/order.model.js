import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { OrderStatus, PaymentStatus, ProductType } from '../constants/enums.js';

class Order {
  /**
   * Pure DAO method to insert an order record
   * Expects client to be passed for transaction support
   */
  static async insert(client, data) {
    const query = `
      INSERT INTO product_orders (
        buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
        payment_method, buyer_name, buyer_email, buyer_mobile_payment, buyer_whatsapp_number, shipping_address,
        notes, metadata, status, payment_status, service_requirements
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      data.buyer_id,
      data.seller_id,
      data.total_amount,
      data.platform_fee_amount,
      data.seller_payout_amount,
      data.payment_method,
      data.buyer_name,
      data.buyer_email,
      data.buyer_mobile_payment,
      data.buyer_whatsapp_number,
      data.shipping_address,
      data.notes,
      data.metadata,
      data.status,
      data.payment_status || 'pending',
      data.service_requirements
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  /**
   * Pure DAO method to insert order items
   */
  static async insertItems(client, orderId, items) {
    // Fetch product details for type info - only for items that don't already have them
    const itemsMissingDetails = items.filter(item => !item.productType && item.isDigital === undefined);
    const productIds = itemsMissingDetails.map(item => parseInt(item.productId, 10));

    let productsMap = new Map();
    if (productIds.length > 0) {
      const productsQuery = `
        SELECT id, product_type::text as product_type, is_digital
        FROM products
        WHERE id = ANY($1)
      `;
      const productsResult = await client.query(productsQuery, [productIds]);
      productsMap = new Map(productsResult.rows.map(p => [p.id, p]));
    }

    const itemValues = items.map(item => {
      const subtotal = item.subtotal || (item.price * item.quantity);
      const productId = parseInt(item.productId, 10);
      const productDetails = productsMap.get(productId);

      return [
        orderId,
        productId,
        item.name || `Product ${item.productId}`,
        parseFloat(item.price).toFixed(2),
        parseInt(item.quantity, 10),
        parseFloat(subtotal).toFixed(2),
        JSON.stringify({
          ...(item.metadata || {}),
          original_price: item.price,
          original_quantity: item.quantity,
          productType: productDetails?.product_type || item.productType || 'physical',
          isDigital: productDetails?.is_digital || item.isDigital || false
        })
      ];
    });

    const itemQuery = `
      INSERT INTO order_items (
        order_id, product_id, product_name, product_price, quantity, subtotal, metadata
      ) VALUES ${itemValues.map((_, i) =>
      `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}::numeric, $${i * 7 + 5}, $${i * 7 + 6}::numeric, $${i * 7 + 7}::jsonb)`
    ).join(', ')}
      RETURNING *
    `;

    const flattenedValues = itemValues.flat();
    const result = await client.query(itemQuery, flattenedValues);
    return result.rows;
  }

  static async updateOrderStatus(orderId, status, notes = null) {
    const query = `
      UPDATE product_orders 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    console.log('updateOrderStatus query params:', [status, orderId]);
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

    console.log('updatePaymentStatus query params:', [status, paymentReference, orderId]);
    console.log('shouldSetPaidAt:', shouldSetPaidAt);
    const { rows } = await pool.query(query, [status, paymentReference, orderId]);
    return rows[0];
  }

  static async findById(orderId) {
    const query = `
      SELECT o.*,
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'productId', oi.product_id,
                 'name', oi.product_name,
                 'price', oi.product_price,
                 'quantity', oi.quantity,
                 'subtotal', oi.subtotal,
                 'metadata', oi.metadata
               )
             ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `;

    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async findByReference(reference) {
    const query = `
      SELECT o.*,
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'productId', oi.product_id,
                 'name', oi.product_name,
                 'price', oi.product_price,
                 'quantity', oi.quantity,
                 'subtotal', oi.subtotal,
                 'metadata', oi.metadata
               )
             ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = $1 OR o.payment_reference = $1
      GROUP BY o.id
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
      SELECT o.*,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
             (SELECT SUM(oi.subtotal) FROM order_items oi WHERE oi.order_id = o.id) as total_amount
      FROM product_orders o
      ${whereClause}
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
        total: parseInt(countResult.rows[0].count, 10),
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
      SELECT o.*,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
             (SELECT SUM(oi.subtotal) FROM order_items oi WHERE oi.order_id = o.id) as total_amount
      FROM product_orders o
      ${whereClause}
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
        total: parseInt(countResult.rows[0].count, 10),
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

  static async updateStatusWithSideEffects(client, orderId, status, paymentStatus, paymentReference = null) {
    const query = `
      UPDATE product_orders 
      SET 
        status = $1::order_status,
        payment_status = $2::payment_status,
        payment_reference = COALESCE($3, payment_reference),
        updated_at = NOW(),
        paid_at = CASE WHEN $2::text = 'completed' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
        completed_at = CASE WHEN $1::text = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
        cancelled_at = CASE WHEN $1::text = 'cancelled' AND cancelled_at IS NULL THEN NOW() ELSE cancelled_at END
      WHERE id = $4
      RETURNING *
    `;
    const { rows } = await client.query(query, [status, paymentStatus, paymentReference, orderId]);
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
    const { rows } = await client.query(updateOrderQuery, [status, JSON.stringify(reason), orderId]);
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
