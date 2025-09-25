import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

// Test endpoint to check database connection and order items
router.get('/orders', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await pool.query('SELECT NOW() as time');
    
    // Get count of orders and order items
    const ordersCount = await pool.query('SELECT COUNT(*) FROM orders');
    const orderItemsCount = await pool.query('SELECT COUNT(*) FROM order_items');
    
    // Get the latest order with its items
    const latestOrder = await pool.query(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
              (SELECT json_agg(oi.* ORDER BY oi.created_at DESC)
               FROM (
                 SELECT * 
                 FROM order_items 
                 WHERE order_id = o.id 
                 ORDER BY created_at DESC 
                 LIMIT 5
               ) oi) as items
       FROM orders o
       ORDER BY o.created_at DESC
       LIMIT 1`
    );
    
    res.json({
      success: true,
      dbTime: dbResult.rows[0].time,
      counts: {
        orders: parseInt(ordersCount.rows[0].count, 10),
        orderItems: parseInt(orderItemsCount.rows[0].count, 10)
      },
      latestOrder: latestOrder.rows[0] || null
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// Test endpoint to create a sample order with items
router.post('/orders', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create a test order
    const orderResult = await client.query(
      `INSERT INTO orders (
        merchant_reference, amount, currency, status, payment_status,
        customer_email, customer_phone, customer_first_name, customer_last_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *`,
      [
        `TEST-${Date.now()}`,
        100.00,
        'KES',
        'PENDING',
        'PENDING',
        'test@example.com',
        '+254700000000',
        'Test',
        'User'
      ]
    );
    
    const order = orderResult.rows[0];
    
    // Add test order items
    const items = [
      { productId: 'test-product-1', name: 'Test Product 1', price: 50.00, quantity: 2 },
      { productId: 'test-product-2', name: 'Test Product 2', price: 25.00, quantity: 1 }
    ];
    
    for (const item of items) {
      const subtotal = item.price * item.quantity;
      
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_price, 
          quantity, subtotal, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          order.id,
          item.productId,
          item.name,
          item.price,
          item.quantity,
          subtotal
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Get the created order with items
    const result = await client.query(
      `SELECT o.*, 
              (SELECT json_agg(oi.*) 
               FROM order_items oi 
               WHERE oi.order_id = o.id) as items
       FROM orders o
       WHERE o.id = $1`,
      [order.id]
    );
    
    res.status(201).json({
      success: true,
      message: 'Test order created successfully',
      data: result.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Test order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
