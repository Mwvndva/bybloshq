import { BaseRepository } from './BaseRepository.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class OrderRepository extends BaseRepository {
  constructor(db) {
    super('orders', db);
  }

  async insert(data, client = this.db) {
    const query = `
      INSERT INTO product_orders (
        order_number, buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
        payment_method, buyer_name, buyer_email, buyer_mobile_payment, buyer_whatsapp_number, shipping_address,
        notes, metadata, status, payment_status, service_requirements, is_debt, client_id, is_seller_initiated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const values = [
      data.order_number,
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
      data.service_requirements,
      data.is_debt || false,
      data.client_id || null,
      data.is_seller_initiated || false
    ];

    const result = await client.query(query, values);
    return toCamelCase(result.rows[0]);
  }

  async insertItems(orderId, items, client = this.db) {
    const itemValues = items.map(item => {
      const subtotal = item.subtotal || (item.price * item.quantity);
      return [
        orderId,
        Number.parseInt(item.productId, 10),
        item.name || `Product ${item.productId}`,
        parseFloat(item.price).toFixed(2),
        Number.parseInt(item.quantity, 10),
        parseFloat(subtotal).toFixed(2),
        JSON.stringify({
          ...(item.metadata || {}),
          original_price: item.price,
          original_quantity: item.quantity,
          productType: item.productType || 'physical',
          isDigital: item.isDigital || false,
          imageUrl: item.imageUrl,
          digitalFileName: item.digitalFileName
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

  async findById(orderId, client = this.db) {
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
        o.shipping_address as "shippingAddress",
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
        o.client_id as "clientId",
        o.is_seller_initiated as "isSellerInitiated",
        json_build_object(
          'id', s.id,
          'name', s.full_name,
          'shopName', s.shop_name,
          'theme', s.theme,
          'location', s.location,
          'city', s.city,
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

    const result = await client.query(query, [orderId]);
    return toCamelCase(result.rows[0]);
  }

  async findByOrderNumber(orderNumber, client = this.db) {
    const query = `
      SELECT o.*, s.full_name as seller_name, s.whatsapp_number as seller_phone
      FROM product_orders o
      JOIN sellers s ON o.seller_id = s.id
      WHERE o.order_number = $1
    `;
    const result = await client.query(query, [orderNumber]);
    return toCamelCase(result.rows[0]);
  }

  async updateStatus(orderId, status, client = this.db) {
    const query = `
      UPDATE product_orders 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await client.query(query, [status, orderId]);
    return toCamelCase(result.rows[0]);
  }

  async updateStatusWithSideEffects(orderId, status, paymentStatus, paymentReference = null, client = this.db) {
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
    const result = await client.query(query, [status, paymentStatus, paymentReference, orderId]);
    return result.rows[0];
  }

  async updateStatusWithReason(orderId, status, reason, client = this.db) {
    const query = `
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
    const result = await client.query(query, [status, JSON.stringify(reason), orderId]);
    return toCamelCase(result.rows[0]);
  }

  async updateMetadata(orderId, metadata, client = this.db) {
    const query = `
      UPDATE product_orders
      SET metadata = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await client.query(query, [JSON.stringify(metadata), orderId]);
    return toCamelCase(result.rows[0]);
  }

  async findByBuyerId(buyerId, { page = 1, limit = 10, status } = {}, client = this.db) {
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
        o.shipping_address as "shippingAddress",
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
        json_build_object(
          'id', s.id,
          'name', s.full_name,
          'shopName', s.shop_name,
          'theme', s.theme,
          'location', s.location,
          'city', s.city,
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

    const countQuery = `SELECT COUNT(*) FROM product_orders o ${whereClause}`;

    const queryParams = [...params, limit, offset];
    const [ordersResult, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, params)
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

  async findBySellerId(sellerId, { page = 1, limit = 10, status } = {}, client = this.db) {
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
        o.shipping_address as "shippingAddress",
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

    const countQuery = `SELECT COUNT(*) FROM product_orders o ${whereClause}`;

    const queryParams = [...params, limit, offset];
    const [ordersResult, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, params)
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

  async getOrderStats(sellerId = null, client = this.db) {
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

    const result = await client.query(query, params);
    return result.rows[0];
  }

  async findByDebtId(debtId, client = this.db) {
    const query = `
      SELECT order_number, status 
      FROM product_orders 
      WHERE (metadata->>'debt_id')::int = $1 AND status != 'FAILED' AND status != 'CANCELLED'
    `;
    const result = await client.query(query, [debtId]);
    return result.rows;
  }

  async findExpiredOrders(hours = 48) {
    const { rows } = await this.db.query(
      `SELECT id FROM product_orders 
       WHERE status = 'pending' 
       AND created_at < NOW() - ($1 * INTERVAL '1 hour')`,
      [hours]
    );
    return rows;
  }
}
