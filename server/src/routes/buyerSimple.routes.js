import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { query } from '../db/index.js';

const router = express.Router();

// Simple test route to verify routing is working
router.get('/test', (req, res) => {
  console.log('🧪 BUYER TEST ROUTE HIT!');
  res.json({
    success: true,
    message: 'Buyer routes are working',
    timestamp: new Date().toISOString()
  });
});

// Simple orders endpoint - bypass all complex logic
router.get('/orders-simple', protect(['buyer']), async (req, res) => {
  console.log('🚀 SIMPLE ORDERS ENDPOINT HIT!');
  console.log('Request headers:', req.headers);
  console.log('Request query:', req.query);
  console.log('Authenticated user:', req.user);

  try {
    // Check authentication
    if (!req.user || !req.user.id) {
      console.log('❌ No authenticated user');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    console.log('✅ User authenticated:', req.user.id);

    // Simple query
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) as total FROM orders WHERE buyer_id = $1';
    const countResult = await query(countQuery, [req.user.id]);
    const total = parseInt(countResult.rows[0]?.total || 0);

    console.log('📊 Found', total, 'orders');

    if (total === 0) {
      return res.json({
        success: true,
        message: 'No orders found',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, total_pages: 0 }
      });
    }

    const ordersQuery = `
      SELECT id, buyer_id, merchant_reference as order_number,
             total_amount, status, payment_status, created_at, updated_at
      FROM orders
      WHERE buyer_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const ordersResult = await query(ordersQuery, [req.user.id, parseInt(limit), offset]);

    const orders = ordersResult.rows.map(row => ({
      id: row.id,
      buyer_id: row.buyer_id,
      order_number: row.order_number,
      total_amount: parseFloat(row.total_amount),
      status: row.status,
      payment_status: row.payment_status,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error in simple orders endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

export default router;
