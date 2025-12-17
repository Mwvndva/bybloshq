import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

class Order {
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

      logger.info('Starting order creation with data:', JSON.stringify(orderData, null, 2));
      await client.query('BEGIN');

      // Verify seller exists and is active (double-check)
      const sellerCheck = await client.query(
        'SELECT id FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
        [sellerId, 'active']
      );
      
      if (sellerCheck.rows.length === 0) {
        throw new Error(`Seller with ID ${sellerId} not found or inactive`);
      }

      // Process and validate order items
      const items = metadata.items || [];
      logger.info('Processing order items:', JSON.stringify(items, null, 2));
      
      // Validate each item
      items.forEach((item, index) => {
        if (typeof item.price !== 'number' || isNaN(item.price) || item.price <= 0) {
          throw new Error(`Invalid price for item at index ${index}: ${item.price}`);
        }
        if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
          throw new Error(`Invalid quantity for item ${item.productId}: ${item.quantity}`);
        }
        if (typeof item.subtotal !== 'number' || isNaN(item.subtotal) || item.subtotal <= 0) {
          throw new Error(`Invalid subtotal for item ${item.productId}: ${item.subtotal}`);
        }
        
        // Log item details for debugging
        logger.info(`Item ${index + 1}:`, {
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal
        });
      });
      
      // Calculate total amount from items
      const totalAmount = items.reduce((sum, item) => {
        const calculatedSubtotal = item.price * item.quantity;
        // Verify the calculated subtotal matches the provided subtotal
        if (Math.abs(calculatedSubtotal - item.subtotal) > 0.01) {
          logger.warn(`Subtotal mismatch for item ${item.productId}: calculated=${calculatedSubtotal}, provided=${item.subtotal}`);
        }
        return sum + item.subtotal;
      }, 0);
      
      const platformFee = parseFloat((totalAmount * 0.09).toFixed(2));
      const sellerPayout = parseFloat((totalAmount - platformFee).toFixed(2));
      
      logger.info(`Calculated totals - Total: ${totalAmount}, Platform Fee: ${platformFee}, Seller Payout: ${sellerPayout}`);

      // Insert order
      const orderQuery = `
        INSERT INTO product_orders (
          buyer_id, seller_id, total_amount, platform_fee_amount, seller_payout_amount,
          payment_method, buyer_name, buyer_email, buyer_phone, shipping_address,
          notes, metadata, status, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', 'pending')
        RETURNING *
      `;

      const orderValues = [
        buyerId,
        sellerId,
        totalAmount,
        platformFee,
        sellerPayout,
        paymentMethod,
        buyerName,
        buyerEmail,
        buyerPhone,
        shippingAddress ? JSON.stringify(shippingAddress) : null,
        notes,
        JSON.stringify(metadata)
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // Insert order items with transaction
      if (items.length > 0) {
        const itemValues = items.map(item => {
          // Ensure all required fields are present and valid
          const subtotal = item.subtotal || (item.price * item.quantity);
          
          return [
            order.id,
            parseInt(item.productId, 10), // Ensure productId is an integer
            item.name || `Product ${item.productId}`,
            parseFloat(item.price).toFixed(2),
            parseInt(item.quantity, 10),
            parseFloat(subtotal).toFixed(2),
            JSON.stringify({
              ...(item.metadata || {}),
              original_price: item.price,
              original_quantity: item.quantity
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
        logger.info('Executing order items insert query:', itemQuery);
        logger.info('With values:', JSON.stringify(flattenedValues, null, 2));
        
        try {
          const result = await client.query(itemQuery, flattenedValues);
          logger.info('Order items inserted successfully:', JSON.stringify(result.rows, null, 2));
          
          // Verify the inserted items
          const insertedItems = result.rows;
          if (insertedItems.length !== items.length) {
            throw new Error(`Expected to insert ${items.length} items but only inserted ${insertedItems.length}`);
          }
          
          // Log the inserted items for verification
          insertedItems.forEach((item, index) => {
            logger.info(`Inserted item ${index + 1}:`, {
              id: item.id,
              order_id: item.order_id,
              product_id: item.product_id,
              product_name: item.product_name,
              product_price: item.product_price,
              quantity: item.quantity,
              subtotal: item.subtotal
            });
          });
          
        } catch (error) {
          logger.error('Error inserting order items:', error);
          throw new Error(`Failed to insert order items: ${error.message}`);
        }
      }

      await client.query('COMMIT');
      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating order:', error);
      throw error;
    } finally {
      client.release();
    }
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

  static async cancelOrder(orderId, reason = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update order status
      const updateOrderQuery = `
        UPDATE product_orders 
        SET 
          status = 'cancelled',
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{cancellation_reason}', 
            $1::jsonb,
            true
          ),
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const orderResult = await client.query(updateOrderQuery, [JSON.stringify(reason), orderId]);
      
      // Update inventory if needed (restock products)
      const order = orderResult.rows[0];
      if (order) {
        const itemsQuery = 'SELECT product_id, quantity FROM order_items WHERE order_id = $1';
        const itemsResult = await client.query(itemsQuery, [orderId]);
        
        for (const item of itemsResult.rows) {
          await client.query(
            'UPDATE products SET quantity = quantity + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }
      
      await client.query('COMMIT');
      return orderResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
