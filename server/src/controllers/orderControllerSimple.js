// Simplified buyer orders controller
export const getBuyerOrdersSimple = async (req, res) => {
  console.log('🚀 SIMPLE BUYER ORDERS CONTROLLER CALLED');
  console.log('Request method:', req.method);
  console.log('Request path:', req.path);
  console.log('Request headers:', {
    authorization: req.headers.authorization ? 'Bearer token present' : 'No token',
    'content-type': req.headers['content-type']
  });
  console.log('Request query:', req.query);

  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.log('❌ No authenticated user found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    console.log('✅ Authenticated user:', req.user.id);

    // Simple query to get orders
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔍 Querying orders for buyer:', req.user.id);

    // Use the database query function
    const { query } = await import('../db/index.js');

    const countQuery = 'SELECT COUNT(*) as total FROM orders WHERE buyer_id = $1';
    const countResult = await query(countQuery, [req.user.id]);
    const total = parseInt(countResult.rows[0]?.total || 0);

    console.log('📊 Total orders found:', total);

    if (total === 0) {
      return res.json({
        success: true,
        message: 'No orders found',
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: 0
        }
      });
    }

    const ordersQuery = `
      SELECT
        id,
        buyer_id,
        merchant_reference as order_number,
        total_amount,
        status,
        payment_status,
        created_at,
        updated_at
      FROM orders
      WHERE buyer_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const ordersResult = await query(ordersQuery, [req.user.id, parseInt(limit), offset]);

    console.log('📦 Orders retrieved:', ordersResult.rows.length);

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
    console.error('❌ Error in simple orders controller:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0
      }
    });
  }
};
