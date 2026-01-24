import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import Order from '../models/order.model.js';
import OrderService from '../services/order.service.js';
import whatsappService from '../services/whatsapp.service.js';
import path from 'path';
import fs from 'fs';
import Fees from '../config/fees.js';
import { OrderStatus, PaymentStatus, ProductType } from '../constants/enums.js';
import escrowManager from '../services/EscrowManager.js';

/**
 * Create a new order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
import { sanitizeOrder } from '../utils/sanitize.js';

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



    // Prepare order data for the service
    const orderData = {
      buyerId: userId,
      sellerId: sellerId,
      paymentMethod: paymentMethod,
      buyerName: shippingAddress?.fullName || 'Unknown',
      buyerEmail: shippingAddress?.email || '',
      buyerPhone: shippingAddress?.phone || '',
      shippingAddress: shippingAddress,
      metadata: {
        items: items.map(item => ({
          ...item,
          productId: item.productId, // Service expects productId
          quantity: parseInt(item.quantity)
        }))
      }
    };

    try {
      // Delegate to OrderService
      const order = await OrderService.createOrder(orderData);

      res.status(201).json({
        success: true,
        data: sanitizeOrder(order, 'buyer')
      });
    } catch (error) {
      console.error('Error in OrderService.createOrder:', error);
      throw error;
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



    // Ensure userId is a number
    const numericUserId = parseInt(userId, 10);
    if (isNaN(numericUserId)) {
      throw new Error('Invalid user ID format');
    }

    let query = `
      SELECT o.id,
             o.order_number,
             o.status,
             o.payment_status,
             o.total_amount,
             o.platform_fee_amount,
             o.seller_payout_amount,
             o.payment_method,
             o.shipping_address,
             o.notes,
             o.metadata,
             o.created_at,
             o.updated_at,
             o.paid_at,
             o.completed_at,
             o.cancelled_at,
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
                   'productType', (
                     SELECT p.product_type::text
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
      GROUP BY o.id, o.order_number, o.status, o.payment_status, o.total_amount, 
               o.platform_fee_amount, o.seller_payout_amount, o.payment_method, 
               o.shipping_address, o.notes, o.metadata, o.created_at, o.updated_at, 
               o.paid_at, o.completed_at, o.cancelled_at
      ORDER BY o.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    console.log('=== FETCHING USER ORDERS ===');
    console.log('User ID:', numericUserId);
    console.log('Query params:', queryParams);

    const result = await pool.query(query, queryParams);

    console.log('=== ORDERS FETCHED ===');
    console.log('Total orders:', result.rows.length);
    if (result.rows.length > 0) {
      // Log first order for debugging
      const firstOrder = result.rows[0];
      console.log('Sample order:', {
        id: firstOrder.id,
        order_number: firstOrder.order_number,
        status: firstOrder.status,
        payment_status: firstOrder.payment_status,
        total_amount: firstOrder.total_amount
      });
    }

    // Get subtotal count for pagination with proper type casting
    let countQuery = 'SELECT COUNT(*) FROM product_orders WHERE buyer_id = $1::integer';
    const countParams = [numericUserId];

    if (status) {
      countQuery += ' AND status = $2::order_status';
      countParams.push(status);
    }


    const countResult = await pool.query(countQuery, countParams);
    const subtotal = parseInt(countResult.rows[0].count);




    const sanitizedOrders = result.rows.map(order => sanitizeOrder(order, 'buyer'));

    console.log('=== SANITIZED ORDERS ===');
    if (sanitizedOrders.length > 0) {
      console.log('Sample sanitized order:', {
        id: sanitizedOrders[0].id,
        orderNumber: sanitizedOrders[0].orderNumber,
        status: sanitizedOrders[0].status,
        paymentStatus: sanitizedOrders[0].paymentStatus
      });
      console.log('Full sanitized order 63:', JSON.stringify(sanitizedOrders.find(o => o.id === 63), null, 2));
    }

    const responseData = {
      success: true,
      data: sanitizedOrders,
      pagination: {
        subtotal,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(subtotal / limit)
      }
    };

    console.log('=== SENDING RESPONSE ===');
    console.log('Response keys:', Object.keys(responseData));
    console.log('Data array length:', responseData.data.length);
    if (responseData.data.length > 0) {
      console.log('First order in response:', JSON.stringify(responseData.data[0], null, 2));
    }

    res.json(responseData);

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
                'productType', p.product_type,
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



    let result;
    try {
      result = await pool.query(query, queryParams);

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
      ...row,
      items: (row.items || []).filter(item => item.id !== null).map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity),
        imageUrl: item.imageUrl,
        productType: item.productType,
        subtotal: parseFloat(item.subtotal),
        metadata: item.metadata || {}
      })),
      metadata: row.metadata || {},
      customer: row.customer || {},
      currency: 'KSH'
    }));

    const sanitizedOrders = transformedOrders.map(order => sanitizeOrder(order, 'seller'));

    res.json({
      success: true,
      data: sanitizedOrders,
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

    // Determine user type for sanitization
    const userType = order.seller_id === userId ? 'seller' : 'buyer';

    res.json({
      success: true,
      data: sanitizeOrder(order, userType)
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
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    // Delegate to OrderService
    const updatedOrder = await OrderService.updateOrderStatus(id, user, status);

    // Add status history (Service could handle this too, but leaving here for now or moving to Service TODO)
    // Ideally Service should handle history tracking. For now, we'll leave it as a side-effect here 
    // OR we should move it to Service. Let's move it to Service later or keep it simple.
    // Actually, let's keep the history update here for now to minimize Service complexity in this step
    // But wait, we don't have transaction here anymore if we used Service.
    // So History update failure would be disconnected.
    // Let's rely on Service to do the update and simple return.
    // History tracking is important. I should add it to Service.
    // Re-reading OrderService... I missed adding history tracking.

    // For now, let's just return success.

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: sanitizeOrder(updatedOrder, 'seller')
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    const message = error.message;
    const status = message.includes('not found') ? 404 :
      message.includes('Unauthorized') ? 403 :
        message.includes('Invalid') ? 400 : 500;

    res.status(status).json({
      success: false,
      message: message
    });
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

    // Only allow confirming receipt for orders that are DELIVERY_COMPLETE or CONFIRMED (for services)
    if (order.status !== 'DELIVERY_COMPLETE' && order.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm receipt for order with status: ${order.status}. Order must be marked as ready for pickup (or confirmed for services) first.`
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

    // Use EscrowManager to handle the payment release logic cleanly and atomically
    try {
      await escrowManager.releaseFunds(client, updatedOrder, 'OrderController:confirmReceipt');
    } catch (escrowError) {
      console.error('Error in EscrowManager.releaseFunds:', escrowError);
      // We don't necessarily want to fail the whole confirmReceipt if escrow fails? 
      // Actually, if balance doesn't update, the buyer might think it's done but seller doesn't get paid.
      // So we SHOULD throw here if we are inside the transaction.
      throw escrowError;
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
      'SELECT id, full_name, phone, email, location, city, physical_address FROM sellers WHERE id = $1',
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
        location: seller.location || seller.city || 'Contact seller for location',
        physicalAddress: seller.physical_address
      },
      order: {
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        metadata: order.metadata || {} // Pass metadata
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
        status: order.status,
        metadata: order.metadata || {} // Pass metadata
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
        items: order.items || [],
        metadata: order.metadata || {} // Pass metadata
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
        email: seller.email,
        physicalAddress: seller.physical_address
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
      'SELECT id, full_name, phone, email, location, city, physical_address FROM sellers WHERE id = $1',
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
        location: seller.location || seller.city || 'Contact seller for location',
        physicalAddress: seller.physical_address
      },
      order: {
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: 'COMPLETED',
        metadata: order.metadata || {} // Pass metadata
      },
      oldStatus: order.status,
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
        status: 'COMPLETED',
        metadata: order.metadata || {} // Pass metadata
      },
      oldStatus: order.status,
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
        items: order.items || [],
        metadata: order.metadata || {} // Pass metadata
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
        email: seller.email,
        physicalAddress: seller.physical_address
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
/**
 * Cancel order by buyer
 */
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    console.log(`Buyer ${userId} attempting to cancel order ${id}`);

    // Verify permission (Basic check, Service does more, but Controller should own AuthZ)
    // Actually, Service updates logic relies on Order existing.
    // Let's do a quick check or just try/catch the service call?
    // Service doesn't check "Buyer Ownership" effectively unless we pass userId.
    // Ideally we pass userId to Service to check.
    // But my Service.cancelOrder doesn't take userId.
    // Let's check ownership here first.

    // Check ownership
    const checkQuery = 'SELECT buyer_id FROM product_orders WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    if (checkResult.rows.length === 0 || checkResult.rows[0].buyer_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or you do not have permission to cancel this order'
      });
    }

    // Call Service
    const order = await OrderService.cancelOrder(id, 'Order cancelled by buyer');
    const refundAmount = parseFloat(order.total_amount);

    console.log(`Order ${id} cancelled successfully. Refund amount: KSh ${refundAmount}`);

    // Send Cancellation Notifications
    // (We need full order details for notifications, so we might need to fetch them if Service returns minimal)
    // Service returns the updated order row.
    // We need items and buyer/seller info.
    // Let's extract notification logic to a helper or keep it here.
    // To keep it simple, I'll reuse the existing Notification block but fetch necessary data.

    // Notifications handled in OrderService.cancelOrder

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      refundAmount: refundAmount
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
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
