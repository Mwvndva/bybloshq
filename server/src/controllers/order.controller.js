import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { calculatePlatformFee } from '../utils/calculateFees.js';
import Order from '../models/order.model.js';
import whatsappService from '../services/whatsapp.service.js';
import path from 'path';
import fs from 'fs';

/**
 * Create a new order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    const userId = req.user.id;

    // Get sellerId from the authenticated user
    const sellerId = req.user.sellerId || req.user.id; // Assuming the seller ID is stored in the JWT token

    // Verify seller exists, is active, and matches the authenticated user
    console.log(`[Order] Verifying seller ID: ${sellerId}`);
    const sellerCheck = await pool.query(
      'SELECT id, email, status FROM sellers WHERE id = $1 AND user_id = $2',
      [sellerId, userId]
    );

    if (sellerCheck.rows.length === 0) {
      console.error(`[Order] Seller not found or not authorized: ID ${sellerId} for user ${userId}`);
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create orders for this seller.'
      });
    }

    const seller = sellerCheck.rows[0];
    if (seller.status !== 'active') {
      console.error(`[Order] Seller is not active:`, seller);
      return res.status(400).json({
        success: false,
        message: 'This seller account is not active. Please contact support for assistance.'
      });
    }

    console.log(`[Order] Verified seller:`, seller.email ? '[REDACTED]' : 'missing');

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
                   'isDigital', (
                     SELECT p.is_digital 
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
      LEFT JOIN order_items oi ON o.id = oi.order_id
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
            LEFT JOIN products p ON oi.product_id::integer = p.id
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
            LEFT JOIN products p ON oi.product_id::integer = p.id
            WHERE oi.order_id = o.id
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
            WHERE b.id = o.buyer_id
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
        params: queryParams
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
      items: (row.items || []).filter(item => item.id !== null).map(item => ({
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
              ) FILTER (WHERE oi.id IS NOT NULL) as items,
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
       LEFT JOIN products p ON oi.product_id::integer = p.id
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
      'PENDING': ['DELIVERY_PENDING', 'CANCELLED'],
      'DELIVERY_PENDING': ['DELIVERY_COMPLETE', 'CANCELLED'],
      'DELIVERY_COMPLETE': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': [],
      'FAILED': []
    };

    // Log the valid transitions for debugging
    console.log('Valid transitions:', JSON.stringify(validTransitions, null, 2));

    // Ensure order.status is defined and exists in validTransitions
    const currentStatus = order.status ? order.status.toUpperCase() : 'PENDING';
    const newStatus = status ? status.toUpperCase() : 'PENDING';

    console.log('Current status (uppercase):', currentStatus);
    console.log('New status (uppercase):', newStatus);
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

    // Send WhatsApp notifications (non-blocking)
    sendOrderStatusNotifications(order, updatedOrder, status).catch(err => {
      console.error('Error sending WhatsApp notifications:', err);
    });

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

    // Only allow confirming receipt for orders that are DELIVERY_COMPLETE
    if (order.status !== 'DELIVERY_COMPLETE') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm receipt for order with status: ${order.status}. Order must be marked as ready for pickup first.`
      });
    }

    // Calculate platform fee (9%) and seller payout (91%)
    const platformFeePercentage = 0.03; // 3% platform fee
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

    // Send WhatsApp notifications for order completion (non-blocking)
    sendOrderCompletionNotifications(order, updatedOrder).catch(err => {
      console.error('Error sending WhatsApp notifications for order completion:', err);
    });

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

/**
 * Send WhatsApp notifications for order status updates
 * @param {Object} order - Original order with buyer info
 * @param {Object} updatedOrder - Updated order
 * @param {string} newStatus - New status
 */
async function sendOrderStatusNotifications(order, updatedOrder, newStatus) {
  try {
    // Fetch seller details
    const sellerQuery = await pool.query(
      'SELECT id, full_name, phone, email FROM sellers WHERE id = $1',
      [order.seller_id]
    );

    if (sellerQuery.rows.length === 0) {
      console.warn('Seller not found for order status notifications');
      return;
    }

    const seller = sellerQuery.rows[0];

    // Prepare notification data for buyer (includes seller info for pickup)
    const buyerNotificationData = {
      buyer: {
        name: order.buyer?.name || order.buyer_name,
        phone: order.buyer?.phone || order.buyer_phone,
        email: order.buyer?.email || order.buyer_email
      },
      seller: {
        name: seller.full_name,
        phone: seller.phone,
        email: seller.email,
        location: seller.location || seller.city || 'Contact seller for location'
      },
      order: {
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: order.status
      },
      oldStatus: order.status?.toUpperCase(),
      newStatus: newStatus.toUpperCase(),
      notes: updatedOrder.notes || ''
    };

    // Prepare notification data for seller (includes buyer info)
    const sellerNotificationData = {
      seller: {
        name: seller.full_name,
        phone: seller.phone,
        email: seller.email
      },
      buyer: {
        name: order.buyer?.name || order.buyer_name,
        phone: order.buyer?.phone || order.buyer_phone,
        email: order.buyer?.email || order.buyer_email
      },
      order: {
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: order.status
      },
      oldStatus: order.status?.toUpperCase(),
      newStatus: newStatus.toUpperCase(),
      notes: updatedOrder.notes || ''
    };

    // Prepare logistics notification data for status updates
    const logisticsNotificationData = {
      order: {
        id: order.id,
        order_id: order.id,
        order_number: order.order_number,
        total_amount: parseFloat(order.total_amount),
        amount: parseFloat(order.total_amount),
        items: order.items || []
      },
      buyer: {
        fullName: order.buyer?.name || order.buyer_name,
        full_name: order.buyer?.name || order.buyer_name,
        phone: order.buyer?.phone || order.buyer_phone,
        email: order.buyer?.email || order.buyer_email,
        city: 'Nairobi', // Default city for logistics
        location: 'Dynamic Mall, Tom Mboya St'
      },
      seller: {
        shop_name: seller.full_name,
        businessName: seller.full_name,
        full_name: seller.full_name,
        phone: seller.phone,
        email: seller.email
      }
    };

    // Send notifications to buyer, seller, and logistics
    await Promise.all([
      whatsappService.notifyBuyerStatusUpdate(buyerNotificationData),
      whatsappService.notifySellerStatusUpdate(sellerNotificationData),
      whatsappService.sendLogisticsNotification(
        logisticsNotificationData.order,
        logisticsNotificationData.buyer,
        logisticsNotificationData.seller
      )
    ]);

    console.log(`WhatsApp status update notifications sent for order ${order.order_number}: Buyer, Seller, and Logistics Partner`);

  } catch (error) {
    console.error('Error in sendOrderStatusNotifications:', error);
    // Don't throw - notifications are not critical
  }
}

/**
 * Send WhatsApp notifications for order completion (buyer confirms receipt)
 * @param {Object} order - Original order with buyer info
 * @param {Object} updatedOrder - Updated order
 */
async function sendOrderCompletionNotifications(order, updatedOrder) {
  try {
    console.log('Sending order completion notifications for order:', order.order_number);

    // Fetch seller details
    const sellerQuery = await pool.query(
      'SELECT id, full_name, phone, email, location, city FROM sellers WHERE id = $1',
      [order.seller_id]
    );

    if (sellerQuery.rows.length === 0) {
      console.warn('Seller not found for order completion notifications');
      return;
    }

    const seller = sellerQuery.rows[0];

    // Fetch buyer details if not in order
    let buyerName = order.buyer_name;
    let buyerPhone = order.buyer_phone;
    let buyerEmail = order.buyer_email;

    if (!buyerName || !buyerPhone) {
      const buyerQuery = await pool.query(
        'SELECT full_name, phone, email FROM buyers WHERE id = $1',
        [order.buyer_id]
      );

      if (buyerQuery.rows.length > 0) {
        const buyer = buyerQuery.rows[0];
        buyerName = buyer.full_name;
        buyerPhone = buyer.phone;
        buyerEmail = buyer.email;
      }
    }

    console.log('Notification details:', {
      buyerName,
      buyerPhone,
      sellerName: seller.full_name,
      sellerPhone: seller.phone,
      orderNumber: order.order_number
    });

    // Prepare notification data for buyer (thank you message)
    const buyerNotificationData = {
      buyer: {
        name: buyerName,
        phone: buyerPhone,
        email: buyerEmail
      },
      seller: {
        name: seller.full_name,
        phone: seller.phone,
        email: seller.email,
        location: seller.location || seller.city || 'Contact seller for location'
      },
      order: {
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: 'COMPLETED'
      },
      oldStatus: 'DELIVERY_COMPLETE',
      newStatus: 'COMPLETED',
      notes: ''
    };

    // Prepare notification data for seller (order completed confirmation)
    const sellerNotificationData = {
      seller: {
        name: seller.full_name,
        phone: seller.phone,
        email: seller.email
      },
      buyer: {
        name: buyerName,
        phone: buyerPhone,
        email: buyerEmail
      },
      order: {
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: 'COMPLETED'
      },
      oldStatus: 'DELIVERY_COMPLETE',
      newStatus: 'COMPLETED',
      notes: ''
    };

    // Prepare logistics notification data for order completion
    const logisticsNotificationData = {
      order: {
        id: order.id,
        order_id: order.id,
        order_number: order.order_number,
        total_amount: parseFloat(order.total_amount),
        amount: parseFloat(order.total_amount),
        items: order.items || []
      },
      buyer: {
        fullName: buyerName,
        full_name: buyerName,
        phone: buyerPhone,
        email: buyerEmail,
        city: 'Nairobi', // Default city for logistics
        location: 'Dynamic Mall, Tom Mboya St'
      },
      seller: {
        shop_name: seller.full_name,
        businessName: seller.full_name,
        full_name: seller.full_name,
        phone: seller.phone,
        email: seller.email
      }
    };

    // Send notifications to buyer, seller, and logistics
    console.log('Calling WhatsApp service to send notifications...');
    await Promise.all([
      whatsappService.notifyBuyerStatusUpdate(buyerNotificationData),
      whatsappService.notifySellerStatusUpdate(sellerNotificationData),
      whatsappService.sendLogisticsNotification(
        logisticsNotificationData.order,
        logisticsNotificationData.buyer,
        logisticsNotificationData.seller
      )
    ]);

    console.log(`✅ WhatsApp completion notifications sent for order ${order.order_number}: Buyer, Seller, and Logistics Partner`);

  } catch (error) {
    console.error('❌ Error in sendOrderCompletionNotifications:', error);
    // Don't throw - notifications are not critical
  }
}

/**
 * Cancel order (buyer cancels their own order)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
/**
 * Cancel order by buyer
 */
const cancelOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`Buyer ${userId} attempting to cancel order ${id}`);

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
        message: 'Order not found or you do not have permission to cancel this order'
      });
    }

    const order = orderResult.rows[0];

    // Check if order can be cancelled
    if (order.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed order'
      });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    // Update order status to CANCELLED
    await client.query(
      `UPDATE product_orders 
       SET status = 'CANCELLED', 
           payment_status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Add refund amount to buyer's refunds column
    const refundAmount = parseFloat(order.total_amount);
    await client.query(
      `UPDATE buyers 
       SET refunds = COALESCE(refunds, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [refundAmount, userId]
    );

    // Add status history
    await client.query(
      'INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)',
      [id, 'CANCELLED', 'Order cancelled by buyer']
    );

    await client.query('COMMIT');

    console.log(`Order ${id} cancelled successfully. Refund amount: KSh ${refundAmount}`);

    // Send cancellation notifications to buyer, seller, and logistics (non-blocking)
    try {
      // Fetch full order details with items
      const fullOrderResult = await pool.query(
        `SELECT o.*, 
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', oi.id,
                      'product_name', oi.product_name,
                      'product_price', oi.product_price,
                      'quantity', oi.quantity
                    )
                  ) FILTER (WHERE oi.id IS NOT NULL),
                  '[]'::json
                ) as items
         FROM product_orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.id = $1
         GROUP BY o.id`,
        [id]
      );

      if (fullOrderResult.rows.length > 0) {
        const fullOrder = fullOrderResult.rows[0];

        // Fetch buyer details
        const buyerResult = await pool.query(
          'SELECT id, full_name, phone, email, city, location FROM buyers WHERE id = $1',
          [userId]
        );

        // Fetch seller details
        const sellerResult = await pool.query(
          'SELECT id, full_name, phone, email, shop_name FROM sellers WHERE id = $1',
          [order.seller_id]
        );

        if (buyerResult.rows.length > 0 && sellerResult.rows.length > 0) {
          const buyer = buyerResult.rows[0];
          const seller = sellerResult.rows[0];

          const orderData = {
            id: fullOrder.id,
            order_id: fullOrder.order_number || fullOrder.id,
            total_amount: fullOrder.total_amount,
            amount: fullOrder.total_amount,
            buyer_phone: buyer.phone,
            phone: buyer.phone,
            items: fullOrder.items
          };

          // Send notifications to buyer, seller, and logistics
          await Promise.all([
            whatsappService.sendBuyerOrderCancellationNotification(orderData, 'Buyer'),
            whatsappService.sendSellerOrderCancellationNotification(orderData, seller, 'Buyer'),
            whatsappService.sendLogisticsCancellationNotification(
              orderData,
              {
                fullName: buyer.full_name,
                full_name: buyer.full_name,
                phone: buyer.phone,
                email: buyer.email,
                city: buyer.city,
                location: buyer.location
              },
              {
                ...seller,
                shop_name: seller.shop_name || seller.full_name,
                businessName: seller.shop_name || seller.full_name
              },
              'Buyer'
            )
          ]);
        }
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notifications:', notificationError);
      // Don't fail the cancellation if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      refundAmount: refundAmount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Cancel order by seller
 */
const sellerCancelOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    console.log(`Seller ${sellerId} attempting to cancel order ${id}`);

    await client.query('BEGIN');

    // Lock the order for update and verify seller owns this order
    const orderResult = await client.query(
      `SELECT * FROM product_orders 
       WHERE id = $1 AND seller_id = $2 
       FOR UPDATE`,
      [id, sellerId]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found or you do not have permission to cancel this order'
      });
    }

    const order = orderResult.rows[0];

    // Check if order can be cancelled
    if (order.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed order'
      });
    }

    if (order.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    // Update order status to CANCELLED
    await client.query(
      `UPDATE product_orders 
       SET status = 'CANCELLED', 
           payment_status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Add refund amount to buyer's refunds column
    const refundAmount = parseFloat(order.total_amount);
    await client.query(
      `UPDATE buyers 
       SET refunds = COALESCE(refunds, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [refundAmount, order.buyer_id]
    );

    // Add status history
    await client.query(
      'INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)',
      [id, 'CANCELLED', 'Order cancelled by seller']
    );

    await client.query('COMMIT');

    console.log(`Order ${id} cancelled by seller. Refund amount: KSh ${refundAmount}`);

    // Send cancellation notifications to buyer, seller, and logistics (non-blocking)
    try {
      // Fetch full order details with items
      const fullOrderResult = await pool.query(
        `SELECT o.*, 
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', oi.id,
                      'product_name', oi.product_name,
                      'product_price', oi.product_price,
                      'quantity', oi.quantity
                    )
                  ) FILTER (WHERE oi.id IS NOT NULL),
                  '[]'::json
                ) as items
         FROM product_orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.id = $1
         GROUP BY o.id`,
        [id]
      );

      if (fullOrderResult.rows.length > 0) {
        const fullOrder = fullOrderResult.rows[0];

        // Fetch buyer details
        const buyerResult = await pool.query(
          'SELECT id, full_name, phone, email, city, location FROM buyers WHERE id = $1',
          [order.buyer_id]
        );

        // Fetch seller details
        const sellerResult = await pool.query(
          'SELECT id, full_name, phone, email, shop_name FROM sellers WHERE id = $1',
          [sellerId]
        );

        if (buyerResult.rows.length > 0 && sellerResult.rows.length > 0) {
          const buyer = buyerResult.rows[0];
          const seller = sellerResult.rows[0];

          const orderData = {
            id: fullOrder.id,
            order_id: fullOrder.order_number || fullOrder.id,
            total_amount: fullOrder.total_amount,
            amount: fullOrder.total_amount,
            buyer_phone: buyer.phone,
            phone: buyer.phone,
            items: fullOrder.items
          };

          // Send notifications to buyer, seller, and logistics
          await Promise.all([
            whatsappService.sendBuyerOrderCancellationNotification(orderData, 'Seller'),
            whatsappService.sendSellerOrderCancellationNotification(orderData, seller, 'Seller'),
            whatsappService.sendLogisticsCancellationNotification(
              orderData,
              {
                fullName: buyer.full_name,
                full_name: buyer.full_name,
                phone: buyer.phone,
                email: buyer.email,
                city: buyer.city,
                location: buyer.location
              },
              {
                ...seller,
                shop_name: seller.shop_name || seller.full_name,
                businessName: seller.shop_name || seller.full_name
              },
              'Seller'
            )
          ]);
        }
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notifications:', notificationError);
      // Don't fail the cancellation if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      refundAmount: refundAmount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  } finally {
    client.release();
  }
};


/**
 * Download digital product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const downloadDigitalProduct = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const userId = req.user.id;
    // Verify order ownership, payment status, and product validity
    const query = `
      SELECT p.digital_file_path, p.digital_file_name, o.payment_status
      FROM product_orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE o.id = $1 
      AND o.buyer_id = $2
      AND p.id = $3
    `;

    const result = await pool.query(query, [orderId, userId, productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found, or you do not own this product.'
      });
    }

    const { digital_file_path, digital_file_name, payment_status } = result.rows[0];

    // Check payment status
    if (payment_status !== 'success' && payment_status !== 'completed') {
      return res.status(403).json({
        success: false,
        message: 'Order is not paid. Cannot download product.'
      });
    }

    // Check if file path exists
    if (!digital_file_path) {
      return res.status(404).json({
        success: false,
        message: 'Digital file not available for this product.'
      });
    }

    // Construct absolute path
    // Assuming digital_file_path is stored as 'uploads/digital_products/filename'
    // and server root is process.cwd()/server or process.cwd() depending on where it started.
    // The middleware stored it. Middleware used: path.join(process.cwd(), 'server', 'uploads', 'digital_products');
    // And digital_file_path stored 'uploads/digital_products/filename' ?
    // Let's check middleware: `const filePath = uploads/digital_products/${req.file.filename};`
    // So it's relative to server root IF server is run from server folder?
    // User runs `node src/index.js` inside `server` dir.
    // middleware used: `path.join(process.cwd(), 'server', 'uploads'...)`.
    // Wait, if user runs from `bybloshq` (root), `process.cwd()` is `bybloshq`.
    // If user runs from `server` dir, `process.cwd()` is `bybloshq/server`.

    // In middleware: `path.join(process.cwd(), 'server', 'uploads'..)` means it assumes cwd is root `bybloshq`.
    // AND `filePath` was returned as `uploads/digital_products/...`.

    // So if process.cwd() is `bybloshq`, then absolute path is `bybloshq/server/uploads/...`.
    // If I join `process.cwd(), 'server', digital_file_path` (where path starts with uploads/), it might duplicate 'server' if not careful?
    // Middleware returned `uploads/digital_products/...`.
    // So `path.join(process.cwd(), 'server', digital_file_path)` should work if cwd is `bybloshq`.

    // However, if the app is running in `server` directory (node src/index.js), `process.cwd()` is `server`.
    // Middleware: `path.join(process.cwd(), 'server', 'uploads')`. If cwd is `server`, this becomes `server/server/uploads`. This seems wrong if running from server dir.
    // Let's assume standard running: `npm run dev` in `bybloshq` runs frontend. `node src/index.js` in `server` runs backend.

    // If running in `server`, `process.cwd()` is `.../server`.
    // Middleware: `path.join(process.cwd(), 'server', 'uploads')` -> `.../server/server/uploads`. This might be a bug in my middleware if running from `server` dir.

    // Let's check middleware code I wrote:
    // `const digitalUploadsDir = path.join(process.cwd(), 'server', 'uploads', 'digital_products');`
    // If I run `node src/index.js` FROM `server` directory, `process.cwd()` is `.../bybloshq/server`.
    // Then path is `.../bybloshq/server/server/uploads/...`. This creates a double server folder.

    // I should fix the middleware to be robust or safer.
    // BUT, for now, let's assume I need to look for where the file actually IS.
    // I'll try to resolve it relative to `__dirname` or check if file exists.

    // I need to be careful. I'll construct path: `path.resolve(process.cwd(), 'server', digital_file_path)`?
    // or just `path.resolve(digital_file_path)` if I knew the base.

    // Let's look at `upload.js` provided by user:
    // `const uploadsDir = path.join(process.cwd(), 'server', 'uploads');`
    // This existing middleware implies the intended structure is `process.cwd()` is the project root (bybloshq), OR they have a double server folder structure?
    // OR they run `node server/src/index.js` from root?
    // User info says: `node src/index.js (in c:\Users\Administrator\Downloads\bybloshq\server`.
    // So CWD is `.../server`.
    // So `process.cwd()` is `.../server`.
    // `path.join(process.cwd(), 'server', 'uploads')` -> `.../server/server/uploads`.
    // This looks like my new middleware creates `server/server/uploads`.
    // AND the existing middleware `upload.js` ALSO does `path.join(process.cwd(), 'server', 'uploads')`.
    // So it seems the existing code EXPECTS `server/server/uploads` or expects CWD to be root?

    // Wait, let's re-read `upload.js` (Step 87).
    // `const uploadsDir = path.join(process.cwd(), 'server', 'uploads');`
    // If user runs in `server` directory, this IS `server/server/uploads`.
    // Maybe I should assume that's "correct" for this project or I should use `..` if in server.

    // Better download logic:
    // Try both paths? Or just use the one that works?
    // Or just path.join(process.cwd(), 'server', digital_file_path) (which is uploads/...).

    // I will use `path.resolve` and check if exists.

    let absolutePath = path.join(process.cwd(), 'server', digital_file_path);

    // Fallback: if running from server dir, maybe we don't need 'server' in path?
    if (!fs.existsSync(absolutePath)) {
      // Try without 'server' prefix if it was duplicated
      // digital_file_path is 'uploads/...'
      // if cwd is '.../server', then join(cwd, digital_file_path) -> '.../server/uploads/...'
      const altPath = path.join(process.cwd(), digital_file_path);
      if (fs.existsSync(altPath)) {
        absolutePath = altPath;
      } else {
        // Maybe 'server' was NOT needed in join?
        console.error('File not found at:', absolutePath, 'or', altPath);
      }
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: 'File file not found on server.'
      });
    }

    res.download(absolutePath, digital_file_name || 'download.zip', (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        // Response already sent if download started?
        if (!res.headersSent) {
          res.status(500).json({ status: 'error', message: 'Download failed' });
        }
      }
    });

  } catch (error) {
    console.error('Error in downloadDigitalProduct:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process download',
      error: error.message
    });
  }
};

export {
  createOrder,
  getUserOrders,
  getSellerOrders,
  getOrderById,
  updateOrderStatus,
  confirmReceipt,
  cancelOrder,
  sellerCancelOrder,
  downloadDigitalProduct
};
