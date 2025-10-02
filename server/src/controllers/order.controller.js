import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { calculatePlatformFee } from '../utils/calculateFees.js';
import Order from '../models/order.model.js';

/**
 * Create a new order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, sellerId } = req.body;
    const userId = req.user.id;

    // Verify seller exists and is active
    console.log(`[Order] Verifying seller ID: ${sellerId}`);
    const sellerCheck = await pool.query('SELECT id, email, status FROM sellers WHERE id = $1', [sellerId]);
    
    if (sellerCheck.rows.length === 0) {
      console.error(`[Order] Seller not found: ID ${sellerId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid seller. The specified seller does not exist.'
      });
    }
    
    if (sellerCheck.rows[0].status !== 'active') {
      console.error(`[Order] Seller is not active:`, sellerCheck.rows[0]);
      return res.status(400).json({
        success: false,
        message: 'This seller account is not active. Please contact support for assistance.'
      });
    }
    
    console.log(`[Order] Verified seller:`, sellerCheck.rows[0].email);

    // Prepare order data for the model
    const orderData = {
      buyerId: userId,
      sellerId: sellerId,
      paymentMethod: paymentMethod,
      buyerName: shippingAddress?.fullName || 'Unknown',
      buyerEmail: shippingAddress?.email || '',
      buyerPhone: shippingAddress?.phone || '',
      shippingAddress: shippingAddress,
      metadata: {
        items: []
      }
    };

    // Get current product prices and validate items
    const productIds = items.map(item => item.productId);
    const productsResult = await pool.query(
      'SELECT id, price, name FROM products WHERE id = ANY($1::int[])',
      [productIds]
    );

    const productMap = new Map();
    for (const product of productsResult.rows) {
      productMap.set(product.id.toString(), product);
    }

    // Prepare order items with proper structure
    orderData.metadata.items = items.map(item => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      const price = parseFloat(product.price);
      const quantity = parseInt(item.quantity);
      const subtotal = price * quantity;

      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for product ${product.id}`);
      }

      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for product ${product.id}`);
      }

      return {
        productId: item.productId,
        name: product.name,
        price: price,
        quantity: quantity,
        subtotal: subtotal,
        metadata: {
          image_url: item.product_image || null
        }
      };
    });

    // Fees will be calculated in the model

    // Log the complete order data before sending to model
    console.log('Sending order data to model:', JSON.stringify(orderData, null, 2));
    
    try {
      // Create the order using the model
      const order = await Order.createOrder(orderData);
      
      // Log the returned order data
      console.log('Order created successfully:', JSON.stringify(order, null, 2));

      res.status(201).json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Error in Order.createOrder:', error);
      throw error; // Let the outer catch handle the response
    }
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

/**
 * Get orders for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserOrders = async (req, res) => {
  try {
    console.log('Received request to get user orders');
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('No user ID found in request');
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    console.log(`Fetching orders for user ${userId} with status: ${status || 'all'}`);
    
    // Ensure userId is a number
    const numericUserId = parseInt(userId, 10);
    if (isNaN(numericUserId)) {
      throw new Error('Invalid user ID format');
    }

    let query = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id::text,
                   'productId', oi.product_id::text,
                   'name', oi.product_name,
                   'price', oi.product_price,
                   'quantity', oi.quantity,
                   'imageUrl', (
                     SELECT p.image_url 
                     FROM products p 
                     WHERE p.id::text = oi.product_id::text
                     LIMIT 1
                   ),
                   'subtotal', oi.quantity * oi.product_price
                 )
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM product_orders o
      LEFT JOIN order_items oi ON o.id::text = oi.order_id::text
      WHERE o.buyer_id = $1::integer
    `;
    
    const queryParams = [numericUserId];
    
    if (status) {
      query += ' AND o.status = $2::order_status';
      queryParams.push(status);
    }
    
    query += `
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(parseInt(limit), offset);
    
    console.log('Executing query:', query);
    console.log('Query parameters:', queryParams);
    
    const result = await pool.query(query, queryParams);
    console.log(`Found ${result.rows.length} orders`);
    
    // Get subtotal count for pagination with proper type casting
    let countQuery = 'SELECT COUNT(*) FROM product_orders WHERE buyer_id = $1::integer';
    const countParams = [numericUserId];
    
    if (status) {
      countQuery += ' AND status = $2::order_status';
      countParams.push(status);
    }
    
    console.log('Executing count query:', countQuery, 'with params:', countParams);
    const countResult = await pool.query(countQuery, countParams);
    const subtotal = parseInt(countResult.rows[0].count);
    
    console.log(`Returning ${result.rows.length} of ${subtotal} total orders`);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        subtotal,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(subtotal / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

/**
 * Get orders for the authenticated seller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSellerOrders = async (req, res) => {
  try {
    console.log('getSellerOrders called with query:', req.query);
    console.log('Authenticated user:', req.user);
    
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const sellerId = req.user?.id; // Using optional chaining in case user is not defined
    
    if (!sellerId) {
      console.error('No seller ID found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required: No seller ID found'
      });
    }
    
    // First, get the orders with basic information
    const queryParams = [sellerId];
    let query = `
      WITH order_with_items AS (
        SELECT 
          o.id,
          o.order_number as "orderNumber",
          o.status,
          o.payment_status as "paymentStatus",
          o.total_amount as "totalAmount",
          o.platform_fee_amount as "platformFeeAmount",
          o.seller_payout_amount as "sellerPayoutAmount",
          o.shipping_address as "shippingAddress",
          o.payment_method as "paymentMethod",
          o.payment_reference as "paymentReference",
          o.buyer_name as "buyerName",
          o.buyer_email as "buyerEmail",
          o.buyer_phone as "buyerPhone",
          o.notes,
          o.metadata,
          o.created_at as "createdAt",
          o.updated_at as "updatedAt",
          o.paid_at as "paidAt",
          o.completed_at as "completedAt",
          o.cancelled_at as "cancelledAt",
          (
            SELECT json_agg(
              json_build_object(
                'id', oi.id,
                'productId', oi.product_id,
                'name', oi.product_name,
                'price', oi.product_price,
                'quantity', oi.quantity,
                'imageUrl', p.image_url,
                'subtotal', oi.subtotal,
                'metadata', COALESCE(oi.metadata, '{}'::jsonb)
              )
            )
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = o.id
          ) as items,
          (
            SELECT json_build_object(
              'id', b.id,
              'name', b.full_name,
              'email', b.email,
              'phone', b.phone,
              'city', b.city,
              'location', b.location
            )
            FROM buyers b
            WHERE b.id = o.buyer_id
          ) as customer
        FROM product_orders o
        WHERE o.seller_id = $1
    `;
    
    // Ensure sellerId is a number
    const numericSellerId = parseInt(sellerId, 10);
    if (isNaN(numericSellerId)) {
      throw new Error('Invalid seller ID format');
    }
    
    // Build the base query with proper type casting
    query = `
      WITH order_with_items AS (
        SELECT 
          o.id,
          o.order_number as "orderNumber",
          o.status,
          o.payment_status as "paymentStatus",
          o.total_amount as "totalAmount",
          o.platform_fee_amount as "platformFeeAmount",
          o.seller_payout_amount as "sellerPayoutAmount",
          o.shipping_address as "shippingAddress",
          o.payment_method as "paymentMethod",
          o.payment_reference as "paymentReference",
          o.buyer_name as "buyerName",
          o.buyer_email as "buyerEmail",
          o.buyer_phone as "buyerPhone",
          o.notes,
          o.metadata,
          o.created_at as "createdAt",
          o.updated_at as "updatedAt",
          o.paid_at as "paidAt",
          o.completed_at as "completedAt",
          o.cancelled_at as "cancelledAt",
          (
            SELECT json_agg(
              json_build_object(
                'id', oi.id::text,
                'productId', oi.product_id::text,
                'name', oi.product_name,
                'price', oi.product_price,
                'quantity', oi.quantity,
                'imageUrl', p.image_url,
                'subtotal', oi.subtotal,
                'metadata', COALESCE(oi.metadata, '{}'::jsonb)
              )
            )
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id::text = p.id::text
            WHERE oi.order_id::text = o.id::text
          ) as items,
          (
            SELECT json_build_object(
              'id', b.id::text,
              'name', b.full_name,
              'email', b.email,
              'phone', b.phone,
              'city', b.city,
              'location', b.location
            )
            FROM buyers b
            WHERE b.id::text = o.buyer_id::text
          ) as customer
        FROM product_orders o
        WHERE o.seller_id = $1::integer
        ${status ? 'AND o.status = $2::order_status' : ''}
      )
      SELECT * FROM order_with_items
      ORDER BY "createdAt" DESC
      LIMIT $${status ? 3 : 2} OFFSET $${status ? 4 : 3}
    `;
    
    // Update queryParams with the parsed numeric sellerId
    queryParams[0] = numericSellerId;
    
    // Add status to params if provided
    if (status) {
      queryParams.push(status);
    }
    
    // Add pagination parameters
    queryParams.push(parseInt(limit), offset);
    
    // Debug: Log the final query and parameters
    console.log('Final query:', query);
    console.log('Query parameters:', queryParams);
    
    let result;
    try {
      result = await pool.query(query, queryParams);
      console.log('Query successful, rows returned:', result.rowCount);
    } catch (queryError) {
      console.error('Database query error:', {
        error: queryError,
        query: query,
        params: queryParams,
        status: status || 'not provided',
        statusType: typeof status
      });
      throw queryError;
    }
    
    // Get subtotal count for pagination with proper type casting
    let countQuery = 'SELECT COUNT(DISTINCT o.id) FROM product_orders o WHERE o.seller_id = $1::integer';
    const countParams = [numericSellerId];
    
    if (status) {
      countQuery += ' AND o.status = $2::order_status';
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const subtotal = parseInt(countResult.rows[0].count);
    
    // Transform the data to match the frontend expectations
    const transformedOrders = result.rows.map(row => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      paymentStatus: row.paymentStatus,
      totalAmount: parseFloat(row.totalAmount || 0),
      platformFeeAmount: parseFloat(row.platformFeeAmount || 0),
      sellerPayoutAmount: parseFloat(row.sellerPayoutAmount || 0),
      shippingAddress: row.shippingAddress || {},
      paymentMethod: row.paymentMethod,
      buyerName: row.buyerName,
      buyerEmail: row.buyerEmail,
      buyerPhone: row.buyerPhone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      paidAt: row.paidAt,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      paymentReference: row.paymentReference,
      notes: row.notes || '',
      items: row.items.filter(item => item.id !== null).map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity),
        imageUrl: item.imageUrl,
        subtotal: parseFloat(item.subtotal),
        metadata: item.metadata || {}
      })),
      customer: row.customer || {},
      currency: 'KSH' // Default currency
    }));
    
    res.json({
      success: true,
      data: transformedOrders,
      pagination: {
        subtotal,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(subtotal / limit)
      }
    });
    
  } catch (error) {
    console.error('Error in getSellerOrders:', {
      error: error,
      message: error.message,
      stack: error.stack,
      status: status || 'not provided',
      statusType: typeof status,
      sellerId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // More specific error messages based on the error type
    let errorMessage = 'Failed to fetch seller orders';
    if (error.code === '22P02') { // Invalid text representation error
      errorMessage = 'Invalid status value provided. Please check the order status and try again.';
    } else if (error.code === '23505') { // Unique violation
      errorMessage = 'A database constraint was violated. Please try again.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get order by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get order with items
    const orderResult = await pool.query(
      `SELECT o.*, 
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'productId', oi.product_id,
                  'name', oi.product_name,
                  'price', oi.product_price,
                  'quantity', oi.quantity,
                  'imageUrl', p.image_url,
                  'subtotal', oi.subtotal,
                  'metadata', COALESCE(oi.metadata, '{}'::jsonb)
                )
              ) as items,
              (
                SELECT json_agg(
                  json_build_object(
                    'id', osh.id,
                    'status', osh.status,
                    'notes', osh.notes,
                    'createdAt', osh.created_at
                  )
                  ORDER BY osh.created_at DESC
                )
                FROM order_status_history osh
                WHERE osh.order_id = o.id
              ) as status_history
       FROM product_orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orderResult.rows[0];
    
    // Check if user has permission to view this order
    if (order.buyer_id !== userId && order.seller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this order'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

/**
 * Update order status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateOrderStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status, notes = '' } = req.body;
    const userId = req.user.id;
    
    await client.query('BEGIN');
    
    // First, lock the order to prevent concurrent updates
    const lockResult = await client.query(
      `SELECT id FROM product_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    
    if (lockResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Now get the full order details with buyer information
    const orderResult = await client.query(
      `SELECT o.*, 
              json_build_object(
                'id', b.id,
                'name', b.full_name,
                'email', b.email,
                'phone', b.phone
              ) as buyer
       FROM product_orders o
       LEFT JOIN buyers b ON o.buyer_id = b.id
       WHERE o.id = $1`,
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orderResult.rows[0];
    
    // Check if user has permission to update this order
    if (order.seller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this order'
      });
    }
    
    // Log the current and new status for debugging
    console.log('Current order status:', order.status);
    console.log('Requested new status:', status);
    
    // Validate status transition
    const validTransitions = {
      'pending': ['ready_for_pickup', 'cancelled'],
      'ready_for_pickup': ['completed', 'cancelled'],
      'processing': ['shipped', 'cancelled', 'completed'],
      'shipped': ['delivered', 'completed'],
      'delivered': ['completed'],
      'completed': [],
      'cancelled': [],
      'refunded': []
    };
    
    // Log the valid transitions for debugging
    console.log('Valid transitions:', JSON.stringify(validTransitions, null, 2));
    
    // Ensure order.status is defined and exists in validTransitions
    const currentStatus = order.status ? order.status.toLowerCase() : null;
    const newStatus = status ? status.toLowerCase() : null;
    
    console.log('Current status (lowercase):', currentStatus);
    console.log('New status (lowercase):', newStatus);
    console.log('Valid transition keys:', Object.keys(validTransitions));
    
    if (!currentStatus || !(currentStatus in validTransitions)) {
      const errorMsg = `Invalid current order status: ${order.status}. Valid statuses: ${Object.keys(validTransitions).join(', ')}`;
      console.error(errorMsg);
      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }
    
    // Check if the transition is valid
    if (!validTransitions[currentStatus].includes(newStatus)) {
      const errorMsg = `Cannot transition order from ${currentStatus} to ${newStatus}. ` +
                     `Valid transitions from ${currentStatus}: ${validTransitions[currentStatus].join(', ') || 'none'}`;
      console.error(errorMsg);
      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }
    
    // Determine payment status based on order status
    let paymentStatus = order.payment_status; // Default to current payment status
    
    // Update payment status based on order status
    if (status === 'completed') {
      // If order is marked as completed, ensure payment is marked as completed if it was pending
      if (order.payment_status === 'pending') {
        paymentStatus = 'completed';
      }
    } else if (status === 'cancelled') {
      // If order is cancelled, update payment status accordingly
      if (order.payment_status === 'pending') {
        paymentStatus = 'cancelled';
      }
    }
    
    // Update order status and set appropriate timestamps
    let updateQuery = 'UPDATE product_orders SET status = $1, updated_at = NOW(), payment_status = $3';
    const queryParams = [status, id, paymentStatus];
    
    // Set appropriate timestamps based on status
    if (status === 'paid') {
      updateQuery += ', paid_at = NOW()';
    } else if (status === 'completed') {
      updateQuery += ', completed_at = NOW()';
      // If payment was pending and we're marking as completed, set payment completed_at
      if (order.payment_status === 'pending') {
        updateQuery += ', payment_completed_at = NOW()';
      }
    } else if (status === 'cancelled') {
      updateQuery += ', cancelled_at = NOW()';
    }
    
    updateQuery += ' WHERE id = $2 RETURNING *';
    
    const updateResult = await client.query(updateQuery, queryParams);
    
    const updatedOrder = updateResult.rows[0];
    
    // Add status history
    await client.query(
      'INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)',
      [id, status, notes || `Order status updated to ${status}`]
    );
    
    // If order is delivered, schedule payout after 24 hours
    if (status === 'delivered') {
      const payoutDate = new Date();
      payoutDate.setHours(payoutDate.getHours() + 24); // 24 hours from now
      
      await client.query(
        `INSERT INTO payouts (
          order_id, seller_id, amount, status, scheduled_date
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (order_id) DO UPDATE
        SET status = EXCLUDED.status,
            scheduled_date = EXCLUDED.scheduled_date`,
        [
          id,
          order.seller_id,
          order.seller_payout,
          'scheduled',
          payoutDate
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // In a real app, you would send notifications here
    
    res.json({
      success: true,
      data: updatedOrder
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  } finally {
    client.release();
  }
};


/**
 * Confirm order receipt
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const confirmReceipt = async (req, res) => {
  console.log('=== START confirmReceipt ===');
  console.log('Order ID:', req.params.id);
  console.log('Authenticated user ID:', req.user?.id);
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await client.query('BEGIN');
    
    // Lock the order for update
    const orderResult = await client.query(
      `SELECT * FROM product_orders 
       WHERE id = $1 AND buyer_id = $2 
       FOR UPDATE`,
      [id, userId]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or you do not have permission to update this order'
      });
    }
    
    const order = orderResult.rows[0];
    
    // Only allow confirming receipt for orders that are READY_FOR_PICKUP
    if (order.status !== 'READY_FOR_PICKUP') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm receipt for order with status: ${order.status}`
      });
    }
    
    // Calculate platform fee (9%) and seller payout (91%)
    const platformFeePercentage = 0.09; // 9% platform fee
    const platformFee = order.total_amount * platformFeePercentage;
    const sellerPayout = order.total_amount - platformFee;

    // 1. First, check if payment_completed_at column exists
    console.log('Checking for payment_completed_at column...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='product_orders' AND column_name='payment_completed_at'
    `);
    
    const hasPaymentCompletedAt = columnCheck.rows.length > 0;
    console.log('hasPaymentCompletedAt:', hasPaymentCompletedAt);
    
    // 2. Update order status to COMPLETED and payment_status to completed
    const updateQuery = `
      UPDATE product_orders 
      SET status = 'COMPLETED', 
          payment_status = 'completed',
          platform_fee_amount = $1,
          seller_payout_amount = $2,
          completed_at = NOW(),
          ${hasPaymentCompletedAt ? 'payment_completed_at = NOW(),' : ''}
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    
    console.log('Executing update query:', updateQuery.replace(/\s+/g, ' ').trim());
    console.log('With parameters:', [platformFee, sellerPayout, id]);
    
    const updateResult = await client.query(updateQuery, [platformFee, sellerPayout, id]);

    const updatedOrder = updateResult.rows[0];

    // Update seller's total_sales, net_revenue and balance
    await client.query(`
      UPDATE sellers 
      SET 
        total_sales = COALESCE(total_sales, 0) + $1,
        net_revenue = COALESCE(net_revenue, 0) + $2,
        balance = COALESCE(balance, 0) + $2,
        updated_at = NOW()
      WHERE id = $3
    `, [order.total_amount, sellerPayout, order.seller_id]);
    
    // Create payout record in a simple, reliable way
    let payoutCreated = false;
    
    try {
      // First check if payouts table exists
      console.log('Checking if payouts table exists...');
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'payouts'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('Payouts table exists, creating payout record...');
        // First, check which columns exist in the payouts table
        const columnsCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'payouts'
        `);
        
        const existingColumns = columnsCheck.rows.map(row => row.column_name);
        console.log('Existing columns in payouts table:', existingColumns);
        
        // Prepare the payout data
        const payoutData = {
          seller_id: order.seller_id,
          order_id: order.id,
          amount: sellerPayout,
          platform_fee: platformFee,
          status: 'completed',
          payment_method: 'bank_transfer',
          reference_number: `order_${order.id}_${Date.now()}`,
          notes: 'Payout for completed order'
        };
        
        // Filter out columns that don't exist in the database
        const validColumns = Object.keys(payoutData).filter(col => existingColumns.includes(col));
        const values = validColumns.map(col => payoutData[col]);
        const placeholders = values.map((_, i) => `$${i + 1}`);
        
        // Add timestamps if columns exist
        if (existingColumns.includes('created_at')) {
          validColumns.push('created_at');
          placeholders.push('NOW()');
        }
        if (existingColumns.includes('updated_at')) {
          validColumns.push('updated_at');
          placeholders.push('NOW()');
        }
        
        // Build the final query
        const queryText = `
          INSERT INTO payouts (
            ${validColumns.join(', ')}
          ) VALUES (
            ${placeholders.join(', ')}
          )
          RETURNING id
        `;
        
        console.log('Executing payout query:', queryText.replace(/\s+/g, ' ').trim());
        console.log('With parameters:', values);
        
        // Execute the query
        const result = await client.query(queryText, values);
        console.log('Payout created successfully:', result.rows[0]);
        payoutCreated = true;
      } else {
        console.log('Payouts table does not exist, skipping payout creation');
      }
    } catch (payoutError) {
      console.error('Error creating payout record:', payoutError);
      // Don't fail the whole operation if payout creation fails
      // The main order confirmation is more important
    }
    
    // Commit the transaction
    try {
      await client.query('COMMIT');
      console.log('Transaction committed successfully');
    } catch (commitError) {
      console.error('Error committing transaction:', commitError);
      throw new Error('Failed to commit transaction');
    }
    
    const response = {
      success: true,
      data: updatedOrder,
      message: 'Order completed and seller payment released successfully',
      payout: {
        seller_id: order.seller_id,
        amount: sellerPayout,
        platform_fee: platformFee
      }
    };
    
    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.status(200).json(response);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirming order receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm order receipt',
      error: error.message
    });
  } finally {
    client.release();
  }
};

export {
  createOrder,
  getUserOrders,
  getSellerOrders,
  getOrderById,
  updateOrderStatus,
  confirmReceipt
};
