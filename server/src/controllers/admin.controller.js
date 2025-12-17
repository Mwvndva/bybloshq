import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import AppError from '../utils/appError.js';
import { promisify } from 'util';
import dotenv from 'dotenv';
import PaymentCompletionService from '../services/paymentCompletion.service.js';

dotenv.config();



// Admin login
const adminLogin = async (req, res, next) => {
  try {
    const { pin } = req.body;

    // 1) Check if pin exists
    if (!pin) {
      return next(new AppError('Please provide a PIN', 400));
    }

    // 2) Check if pin is correct
    const adminPin = process.env.ADMIN_PIN || '123456'; // Default PIN for development
    if (pin !== adminPin) {
      return next(new AppError('Incorrect PIN', 401));
    }

    // 3) If everything is ok, send token to client
    const token = jwt.sign({ id: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '24h', // 24 hours expiration
    });

    // 4) Send response with token
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: { token }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

// Middleware to protect admin routes
const protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user is admin
    if (decoded.id !== 'admin') {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    // 4) Add admin user to request
    req.user = { 
      id: 'admin', 
      email: 'admin@byblos.com',
      role: 'admin',
      userType: 'admin'
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired! Please log in again.', 401));
    }
    next(error);
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res, next) => {
  console.log('Fetching dashboard stats...');
  
  try {
    // Test database connection first
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Get total counts with error handling
    const getCount = async (table) => {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`${table} count:`, result.rows[0].count);
        return parseInt(result.rows[0].count, 10);
      } catch (error) {
        console.error(`Error counting ${table}:`, error.message);
        return 0;
      }
    };

    // Get all counts in parallel
    const [total_sellers, total_products, total_organizers, total_events, total_buyers] = await Promise.all([
      getCount('sellers'),
      getCount('products'),
      getCount('organizers'),
      getCount('events'),
      getCount('buyers')
    ]);

    // Get recent records with error handling
    const queryWithLogging = async (query, name) => {
      try {
        console.log(`Executing ${name} query...`);
        const result = await pool.query(query);
        console.log(`${name} query successful, found ${result.rows.length} rows`);
        return result.rows;
      } catch (error) {
        console.error(`Error in ${name} query:`, error.message);
        return [];
      }
    };

    // Fetch recent activities (combine recent actions from different tables)
    const recentActivities = [];
    
    // Add some mock recent activities since we don't have an activities table
    recentActivities.push({
      id: 1,
      type: 'info',
      message: 'System initialized',
      timestamp: new Date().toISOString()
    });

    // Prepare response in the format expected by the frontend
    const responseData = {
      total_sellers,
      total_products,
      total_organizers,
      total_events,
      total_buyers,
      total_revenue: 0, // This would come from orders/transactions
      monthly_growth: {
        sellers: 0,
        products: 0,
        organizers: 0,
        events: 0,
        buyers: 0,
        revenue: 0
      },
      recent_activities: recentActivities
    };

    console.log('Dashboard stats prepared:', JSON.stringify(responseData, null, 2));
    
    res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (error) {
    console.error('Critical error in getDashboardStats:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    // Return default values that match the expected structure
    res.status(200).json({
      status: 'success',
      data: {
        total_sellers: 0,
        total_products: 0,
        total_organizers: 0,
        total_events: 0,
        total_buyers: 0,
        total_revenue: 0,
        monthly_growth: {
          sellers: 0,
          products: 0,
          organizers: 0,
          events: 0,
          buyers: 0,
          revenue: 0
        },
        recent_activities: []
      }
    });
  }
};

// Sellers management
const getAllSellers = async (req, res, next) => {
  try {
    console.log('Fetching all sellers...');
    const result = await pool.query(
      `SELECT 
        id, 
        full_name as name, 
        email, 
        phone, 
        status, 
        city,
        location,
        created_at 
      FROM sellers 
      ORDER BY created_at DESC`
    );
    
    console.log('Raw sellers data from database:', result.rows.map(seller => ({
      id: seller.id,
      fullName: seller.full_name,
      shopName: seller.shop_name,
      email: seller.email ? '[REDACTED]' : 'missing',
      phone: seller.phone ? '[REDACTED]' : 'missing',
      city: seller.city,
      isActive: seller.is_active,
      balance: seller.balance
    })));
    
    const sellers = result.rows.map(seller => ({
      ...seller,
      status: seller.status || 'Active',
      createdAt: seller.created_at,
      city: seller.city || 'N/A',
      location: seller.location || 'N/A'
    }));
    
    console.log('Processed sellers data:', sellers.map(seller => ({
      ...seller,
      email: seller.email ? '[REDACTED]' : 'missing',
      phone: seller.phone ? '[REDACTED]' : 'missing'
    })));
    
    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: sellers
    });
  } catch (error) {
    console.error('Error getting sellers:', error);
    next(error);
  }
};

const getSellerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Convert id to integer to match database type
    const sellerId = parseInt(id, 10);
    if (isNaN(sellerId)) {
      return next(new AppError('Invalid seller ID', 400));
    }
    
    // Get seller basic info
    const sellerResult = await pool.query(
      `SELECT 
        id, 
        full_name as name, 
        email, 
        phone,
        city,
        location,
        shop_name,
        status, 
        created_at 
      FROM sellers 
      WHERE id = $1`,
      [sellerId]
    );
    
    if (sellerResult.rows.length === 0) {
      return next(new AppError('No seller found with that ID', 404));
    }
    
    const seller = sellerResult.rows[0];
    
    // Get seller's sales metrics
    const salesMetrics = await pool.query(
      `SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN platform_fee_amount ELSE 0 END), 0) as total_commission,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN seller_payout_amount ELSE 0 END), 0) as net_sales,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'DELIVERY_COMPLETE' THEN 1 END) as delivery_complete,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders
      FROM product_orders
      WHERE seller_id = $1`,
      [sellerId]
    );
    
    // Get seller's product count
    const productsResult = await pool.query(
      `SELECT COUNT(*) as total_products
      FROM products
      WHERE seller_id = $1`,
      [sellerId]
    );
    
    // Get recent orders
    const recentOrders = await pool.query(
      `SELECT 
        id,
        order_number,
        buyer_name,
        total_amount,
        status,
        payment_status,
        created_at
      FROM product_orders
      WHERE seller_id = $1
      ORDER BY created_at DESC
      LIMIT 5`,
      [sellerId]
    );
    
    const metrics = salesMetrics.rows[0];
    const productCount = productsResult.rows[0].total_products;
    
    res.status(200).json({
      status: 'success',
      data: {
        ...seller,
        status: seller.status || 'active',
        createdAt: seller.created_at,
        metrics: {
          totalOrders: parseInt(metrics.total_orders) || 0,
          totalSales: parseFloat(metrics.total_sales) || 0,
          totalCommission: parseFloat(metrics.total_commission) || 0,
          netSales: parseFloat(metrics.net_sales) || 0,
          pendingOrders: parseInt(metrics.pending_orders) || 0,
          readyForPickup: parseInt(metrics.ready_for_pickup) || 0,
          completedOrders: parseInt(metrics.completed_orders) || 0,
          cancelledOrders: parseInt(metrics.cancelled_orders) || 0,
          totalProducts: parseInt(productCount) || 0
        },
        recentOrders: recentOrders.rows.map(order => ({
          id: order.id,
          orderNumber: order.order_number,
          buyerName: order.buyer_name,
          totalAmount: parseFloat(order.total_amount),
          status: order.status,
          paymentStatus: order.payment_status,
          createdAt: order.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error getting seller by ID:', error);
    next(error);
  }
};

const updateSellerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended', 'banned'].includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }
    
    const result = await pool.query(
      'UPDATE sellers SET status = $1 WHERE id = $2 RETURNING id, full_name as name, email, status',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return next(new AppError('No seller found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Seller status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Organizers management
const getAllOrganizers = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.full_name as name, o.email, o.phone, o.status, o.created_at,
              COUNT(e.id) as events_count
       FROM organizers o
       LEFT JOIN events e ON o.id = e.organizer_id
       GROUP BY o.id, o.full_name, o.email, o.phone, o.status, o.created_at
       ORDER BY o.created_at DESC`
    );
    
    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: result.rows.map(org => ({
        ...org,
        status: org.status || 'Active',
        eventsCount: parseInt(org.events_count, 10) || 0,
        createdAt: org.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting organizers:', error);
    next(error);
  }
};

const getOrganizerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.id, o.full_name as name, o.email, o.phone, o.status, o.created_at,
              COUNT(e.id) as events_count
       FROM organizers o
       LEFT JOIN events e ON o.id = e.organizer_id
       WHERE o.id = $1
       GROUP BY o.id, o.full_name, o.email, o.phone, o.status, o.created_at`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return next(new AppError('No organizer found with that ID', 404));
    }
    
    const organizer = result.rows[0];
    res.status(200).json({
      status: 'success',
      data: {
        ...organizer,
        status: organizer.status || 'Active',
        eventsCount: parseInt(organizer.events_count, 10) || 0,
        createdAt: organizer.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateOrganizerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended', 'banned'].includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }
    
    const result = await pool.query(
      'UPDATE organizers SET status = $1 WHERE id = $2 RETURNING id, full_name as name, email, status',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return next(new AppError('No organizer found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Organizer status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Events management
const getAllEvents = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
        e.id, 
        e.name as title, 
        e.description, 
        e.start_date, 
        e.end_date, 
        e.location, 
        e.status, 
        e.created_at, 
        e.withdrawal_status,
        e.withdrawal_date,
        e.withdrawal_amount,
        o.full_name as organizer_name,
        (SELECT COUNT(*) FROM tickets WHERE event_id = e.id) as attendees_count,
        COALESCE(
          (SELECT SUM(tt.price) 
           FROM tickets t
           JOIN ticket_types tt ON t.ticket_type_id = tt.id
           WHERE t.event_id = e.id),
          0
        ) as total_revenue
       FROM events e
       LEFT JOIN organizers o ON e.organizer_id = o.id
       ORDER BY e.start_date DESC`
    );
    
    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: result.rows.map(event => ({
        ...event,
        date: event.start_date,
        status: event.status || 'upcoming',
        attendees: parseInt(event.attendees_count, 10) || 0,
        revenue: parseFloat(event.total_revenue) || 0,
        createdAt: event.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting events:', error);
    // Return empty array if there's an error
    res.status(200).json({
      status: 'success',
      results: 0,
      data: []
    });
  }
};

const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT e.*, o.full_name as organizer_name
       FROM events e
       JOIN organizers o ON e.organizer_id = o.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return next(new AppError('No event found with that ID', 404));
    }
    
    const event = result.rows[0];
    res.status(200).json({
      status: 'success',
      data: {
        ...event,
        title: event.name,
        date: event.start_date,
        status: event.status || 'upcoming',
        createdAt: event.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};


// Get tickets for an event
const getEventTickets = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;

    // 1) Get event details
    const eventResult = await pool.query(
      'SELECT id, name, start_date, end_date, location FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return next(new AppError('No event found with that ID', 404));
    }

    // 2) Get all tickets for the event with detailed ticket type information
    const ticketsResult = await pool.query(
      `SELECT 
        t.id, 
        t.ticket_number,
        t.customer_name,
        t.customer_email,
        t.ticket_type_name,
        t.price,
        t.status,
        t.created_at,
        t.scanned,
        t.scanned_at,
        tt.id as ticket_type_id,
        tt.name as ticket_type_name,
        tt.description as ticket_type_description,
        tt.quantity as ticket_type_quantity,
        tt.sales_start_date as ticket_type_sales_start_date,
        tt.sales_end_date as ticket_type_sales_end_date
      FROM tickets t
      LEFT JOIN ticket_types tt ON t.ticket_type_name = tt.name AND t.event_id = tt.event_id
      WHERE t.event_id = $1
      ORDER BY t.created_at DESC`,
      [eventId]
    );

    // 3) Format the response with nested ticket type information
    const tickets = ticketsResult.rows.map(ticket => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      customer_name: ticket.customer_name,
      customer_email: ticket.customer_email,
      price: parseFloat(ticket.price || 0),
      status: ticket.status,
      created_at: ticket.created_at,
      scanned: ticket.scanned,
      scanned_at: ticket.scanned_at,
      ticket_type: {
        id: ticket.ticket_type_id,
        name: ticket.ticket_type_name,
        description: ticket.ticket_type_description || '',
        price: parseFloat(ticket.price || 0),
        quantity_available: parseInt(ticket.ticket_type_quantity || 0, 10),
        sales_start: ticket.ticket_type_sales_start,
        sales_end: ticket.ticket_type_sales_end
      }
    }));

    // 4) Send response
    res.status(200).json({
      status: 'success',
      results: tickets.length,
      data: {
        event: eventResult.rows[0],
        tickets: tickets
      }
    });
  } catch (error) {
    console.error('Error getting event tickets:', error);
    next(error);
  }
};

// Products management
const getAllProducts = async (req, res, next) => {
  try {
    // First, let's check the structure of the products table
    const columnsResult = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'products'`
    );
    
    // Get available columns
    const availableColumns = columnsResult.rows.map(row => row.column_name);
    
    // Build the query based on available columns
    const hasStock = availableColumns.includes('stock');
    const hasStatus = availableColumns.includes('status');
    
    // Build the select fields
    const selectFields = [
      'p.id', 
      'p.name', 
      'p.description', 
      'p.price',
      'p.created_at',
      's.full_name as seller_name'
    ];
    
    if (hasStock) selectFields.push('p.stock');
    if (hasStatus) selectFields.push('p.status');
    
    const query = `
      SELECT ${selectFields.join(', ')}
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      ORDER BY p.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: result.rows.map(product => ({
        ...product,
        stock: hasStock ? (product.stock || 0) : 0,
        status: hasStatus ? (product.status || 'active') : 'active',
        createdAt: product.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting products:', error);
    // Return empty array if there's an error
    res.status(200).json({
      status: 'success',
      results: 0,
      data: []
    });
  }
};

const getSellerProducts = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    
    // First, check the structure of the products table
    const columnsResult = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'products'`
    );
    
    // Get available columns
    const availableColumns = columnsResult.rows.map(row => row.column_name);
    
    // Build the query based on available columns
    const hasStock = availableColumns.includes('stock');
    const hasStatus = availableColumns.includes('status');
    
    // Build the select fields
    const selectFields = [
      'p.id', 
      'p.name', 
      'p.description', 
      'p.price',
      'p.created_at',
      's.full_name as seller_name'
    ];
    
    if (hasStock) selectFields.push('p.stock');
    if (hasStatus) selectFields.push('p.status');
    
    const query = `
      SELECT ${selectFields.join(', ')}
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.seller_id = $1
      ORDER BY p.created_at DESC
    `;
    
    const result = await pool.query(query, [sellerId]);
    
    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: result.rows.map(product => ({
        ...product,
        stock: hasStock ? (product.stock || 0) : 0,
        status: hasStatus ? (product.status || 'active') : 'active',
        createdAt: product.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting seller products:', error);
    // Return empty array if there's an error
    res.status(200).json({
      status: 'success',
      results: 0,
      data: []
    });
  }
};

// Helper function to determine product status
const getProductStatus = (stock) => {
  if (stock > 10) return 'In Stock';
  if (stock > 0) return 'Low Stock';
  return 'Out of Stock';
};

// Get monthly event counts
const getMonthlyEvents = async (req, res, next) => {
  try {
    console.log('Fetching monthly event counts...');
    
    // Query to get event counts for the last 12 months
    const query = `
      WITH months AS (
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months' + (n || ' months')::interval) AS month
        FROM generate_series(0, 11) n
      )
      SELECT 
        TO_CHAR(m.month, 'YYYY-MM-DD') AS month,
        COUNT(e.id) AS event_count
      FROM months m
      LEFT JOIN events e ON DATE_TRUNC('month', e.created_at) = m.month
      GROUP BY m.month
      ORDER BY m.month ASC;
    `;

    console.log('Executing events query...');
    const result = await pool.query(query);
    console.log('Query result rows:', result.rows);
    
    // Format the response
    const monthlyEvents = result.rows.map(row => ({
      month: row.month,
      event_count: parseInt(row.event_count) || 0
    }));

    res.status(200).json({
      status: 'success',
      data: monthlyEvents
    });
  } catch (error) {
    console.error('Error fetching monthly events:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    next(new AppError(`Failed to fetch monthly event data: ${error.message}`, 500));
  }
};

// Get monthly metrics for sellers, products, and products sold
const getMonthlyMetrics = async (req, res, next) => {
  try {
    console.log('Fetching monthly metrics...');
    
    // Query to get metrics for the last 12 months
    const query = `
      WITH months AS (
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months' + (n || ' months')::interval) AS month
        FROM generate_series(0, 11) n
      ),
      seller_counts AS (
        SELECT 
          DATE_TRUNC('month', created_at) AS month,
          COUNT(*) AS seller_count
        FROM sellers
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      product_counts AS (
        SELECT 
          DATE_TRUNC('month', created_at) AS month,
          COUNT(*) AS product_count
        FROM products
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      buyer_counts AS (
        SELECT 
          DATE_TRUNC('month', created_at) AS month,
          COUNT(*) AS buyer_count
        FROM buyers
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
        GROUP BY DATE_TRUNC('month', created_at)
      )
      SELECT 
        TO_CHAR(m.month, 'YYYY-MM-DD') AS month,
        COALESCE(sc.seller_count, 0) AS seller_count,
        COALESCE(pc.product_count, 0) AS product_count,
        COALESCE(bc.buyer_count, 0) AS buyer_count
      FROM months m
      LEFT JOIN seller_counts sc ON sc.month = m.month
      LEFT JOIN product_counts pc ON pc.month = m.month
      LEFT JOIN buyer_counts bc ON bc.month = m.month
      ORDER BY m.month ASC;
    `;

    console.log('Executing metrics query...');
    const result = await pool.query(query);
    console.log('Metrics query result rows:', result.rows);
    
    // Format the response
    const monthlyMetrics = result.rows.map(row => ({
      month: row.month,
      seller_count: parseInt(row.seller_count) || 0,
      product_count: parseInt(row.product_count) || 0,
      buyer_count: parseInt(row.buyer_count) || 0
    }));

    res.status(200).json({
      status: 'success',
      data: monthlyMetrics
    });
  } catch (error) {
    console.error('Error fetching monthly metrics:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    next(new AppError(`Failed to fetch monthly metrics: ${error.message}`, 500));
  }
};

/**
 * Process pending payments (admin only)
 */
const processPendingPayments = async (req, res, next) => {
  try {
    const { hours = 24, limit = 50 } = req.query;
    
    logger.info(`Admin requested to process pending payments from last ${hours} hours, limit ${limit}`);
    
    // Process pending payments
    const result = await PaymentCompletionService.processPendingPayments(
      parseInt(hours, 10),
      parseInt(limit, 10)
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Pending payments processed successfully',
      data: result
    });
    
  } catch (error) {
    logger.error('Error processing pending payments:', error);
    next(new AppError('Failed to process pending payments', 500));
  }
};

// Get all buyers
const getAllBuyers = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        id,
        full_name as name,
        email,
        phone,
        status,
        city,
        location,
        created_at
      FROM buyers 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // Process the rows to include default values for city and location
    const buyers = result.rows.map(buyer => ({
      ...buyer,
      city: buyer.city || 'N/A',
      location: buyer.location || 'N/A',
      status: buyer.status || 'Active',
      createdAt: buyer.created_at
    }));
    
    res.status(200).json({
      status: 'success',
      data: buyers
    });
  } catch (error) {
    console.error('Error fetching buyers:', error);
    next(new AppError('Failed to fetch buyers', 500));
  }
};

// Get buyer by ID
const getBuyerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        full_name as name,
        email,
        phone,
        status,
        created_at
      FROM buyers 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return next(new AppError('Buyer not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching buyer:', error);
    next(new AppError('Failed to fetch buyer', 500));
  }
};

// @desc    Get all withdrawal requests
// @route   GET /api/admin/withdrawal-requests
// @access  Private (Admin)
const getAllWithdrawalRequests = async (req, res, next) => {
  try {
    const query = `
      SELECT
        wr.id,
        wr.amount,
        wr.mpesa_number,
        wr.mpesa_name,
        wr.status,
        wr.created_at,
        wr.processed_at,
        wr.processed_by,
        s.id as seller_id,
        s.full_name as seller_name,
        s.email as seller_email,
        s.phone as seller_phone
      FROM withdrawal_requests wr
      JOIN sellers s ON wr.seller_id = s.id
      ORDER BY wr.created_at DESC
    `;

    const result = await pool.query(query);

    const withdrawalRequests = result.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      mpesaNumber: row.mpesa_number,
      mpesaName: row.mpesa_name,
      status: row.status,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      sellerEmail: row.seller_email,
      sellerPhone: row.seller_phone,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      processedBy: row.processed_by
    }));

    res.status(200).json({
      status: 'success',
      data: withdrawalRequests
    });

  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    next(new AppError('Failed to fetch withdrawal requests', 500));
  }
};

// @desc    Update withdrawal request status
// @route   PATCH /api/admin/withdrawal-requests/:id/status
// @access  Private (Admin)
const updateWithdrawalRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return next(new AppError('Invalid status. Must be approved or rejected', 400));
    }

    // Check if withdrawal request exists
    const checkQuery = `
      SELECT wr.*, s.balance as seller_balance
      FROM withdrawal_requests wr
      JOIN sellers s ON wr.seller_id = s.id
      WHERE wr.id = $1
    `;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return next(new AppError('Withdrawal request not found', 404));
    }

    const withdrawalRequest = checkResult.rows[0];
    const currentBalance = parseFloat(withdrawalRequest.seller_balance || 0);
    const withdrawalAmount = parseFloat(withdrawalRequest.amount || 0);

    // Check if already processed
    if (withdrawalRequest.status !== 'pending') {
      return next(new AppError('Withdrawal request has already been processed', 400));
    }

    // If approving, check if seller has sufficient balance
    if (status === 'approved' && withdrawalAmount > currentBalance) {
      return next(new AppError(`Insufficient balance. Seller has KSh ${currentBalance.toLocaleString()} but requested KSh ${withdrawalAmount.toLocaleString()}`, 400));
    }

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update withdrawal request status
      const updateWithdrawalQuery = `
        UPDATE withdrawal_requests
        SET status = $1, processed_at = NOW(), processed_by = 'admin'
        WHERE id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateWithdrawalQuery, [status, id]);
      const updatedRequest = updateResult.rows[0];

      // If approved, subtract from seller's balance
      if (status === 'approved') {
        const newBalance = currentBalance - withdrawalAmount;

        const updateBalanceQuery = `
          UPDATE sellers
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
        `;

        await client.query(updateBalanceQuery, [newBalance, withdrawalRequest.seller_id]);

        console.log(`Withdrawal approved: KSh ${withdrawalAmount} deducted from seller ${withdrawalRequest.seller_id}. New balance: KSh ${newBalance}`);
      }

      await client.query('COMMIT');

      res.status(200).json({
        status: 'success',
        message: `Withdrawal request ${status} successfully${status === 'approved' ? ` and balance updated` : ''}`,
        data: {
          id: updatedRequest.id,
          amount: parseFloat(updatedRequest.amount),
          mpesaNumber: updatedRequest.mpesa_number,
          mpesaName: updatedRequest.mpesa_name,
          status: updatedRequest.status,
          sellerId: updatedRequest.seller_id,
          createdAt: updatedRequest.created_at,
          processedAt: updatedRequest.processed_at,
          processedBy: updatedRequest.processed_by,
          balanceDeducted: status === 'approved' ? withdrawalAmount : 0,
          newBalance: status === 'approved' ? currentBalance - withdrawalAmount : currentBalance
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating withdrawal request status:', error);
    next(new AppError('Failed to update withdrawal request status', 500));
  }
};

// @desc    Mark event as paid (withdrawal processed)
// @route   PATCH /api/admin/events/:eventId/mark-paid
// @access  Private (Admin)
const markEventAsPaid = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { withdrawalMethod, withdrawalDetails } = req.body;

    // Validate event ID
    if (!eventId || isNaN(parseInt(eventId))) {
      return next(new AppError('Invalid event ID', 400));
    }

    // Check if event exists
    const eventQuery = 'SELECT id, name, withdrawal_status FROM events WHERE id = $1';
    const eventResult = await pool.query(eventQuery, [eventId]);
    
    if (eventResult.rows.length === 0) {
      return next(new AppError('Event not found', 404));
    }

    const event = eventResult.rows[0];

    // Check if event is already marked as paid
    if (event.withdrawal_status === 'paid') {
      return next(new AppError('Event withdrawal has already been processed', 400));
    }

    // Calculate total revenue for the event
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(t.total_price), 0) as total_revenue
      FROM tickets t
      WHERE t.event_id = $1 AND t.status = 'paid'
    `;
    const revenueResult = await pool.query(revenueQuery, [eventId]);
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue || 0);

    // Calculate platform fee (6%) and net payout (94%)
    const platformFee = totalRevenue * 0.06;
    const netPayout = totalRevenue * 0.94;

    // Update event with withdrawal status
    const updateQuery = `
      UPDATE events 
      SET 
        withdrawal_status = 'paid',
        withdrawal_date = NOW(),
        withdrawal_amount = $1,
        withdrawal_method = $2,
        withdrawal_details = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      netPayout,
      withdrawalMethod || 'manual',
      JSON.stringify(withdrawalDetails || {}),
      eventId
    ]);

    const updatedEvent = updateResult.rows[0];

    res.status(200).json({
      status: 'success',
      message: 'Event marked as paid successfully',
      data: {
        event: {
          id: updatedEvent.id,
          name: updatedEvent.name,
          withdrawal_status: updatedEvent.withdrawal_status,
          withdrawal_date: updatedEvent.withdrawal_date,
          withdrawal_amount: updatedEvent.withdrawal_amount,
          withdrawal_method: updatedEvent.withdrawal_method
        },
        financial_summary: {
          total_revenue: totalRevenue,
          platform_fee: platformFee,
          net_payout: netPayout
        }
      }
    });

  } catch (error) {
    console.error('Error marking event as paid:', error);
    next(new AppError('Failed to mark event as paid', 500));
  }
};

// Get financial metrics (sales, commission, refunds)
const getFinancialMetrics = async (req, res, next) => {
  try {
    console.log('Fetching financial metrics...');

    // Get total sales from all completed orders
    const salesQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as total_orders
      FROM product_orders
      WHERE payment_status = 'completed'
        AND status IN ('PENDING', 'DELIVERY_COMPLETE', 'COMPLETED')
    `);

    // Get total commission (platform_fee_amount)
    const commissionQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(platform_fee_amount), 0) as total_commission
      FROM product_orders
      WHERE payment_status = 'completed'
        AND status IN ('PENDING', 'DELIVERY_COMPLETE', 'COMPLETED')
    `);

    // Get total refunds made
    const refundsQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_refunds,
        COUNT(*) as total_refund_requests
      FROM refund_requests
      WHERE status = 'completed'
    `);

    // Get pending refunds
    const pendingRefundsQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(refunds), 0) as pending_refunds
      FROM buyers
      WHERE refunds > 0
    `);

    const totalSales = parseFloat(salesQuery.rows[0].total_sales) || 0;
    const totalOrders = parseInt(salesQuery.rows[0].total_orders) || 0;
    const totalCommission = parseFloat(commissionQuery.rows[0].total_commission) || 0;
    const totalRefunds = parseFloat(refundsQuery.rows[0].total_refunds) || 0;
    const totalRefundRequests = parseInt(refundsQuery.rows[0].total_refund_requests) || 0;
    const pendingRefunds = parseFloat(pendingRefundsQuery.rows[0].pending_refunds) || 0;

    res.status(200).json({
      status: 'success',
      data: {
        totalSales,
        totalOrders,
        totalCommission,
        totalRefunds,
        totalRefundRequests,
        pendingRefunds,
        netRevenue: totalCommission - totalRefunds
      }
    });
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    next(new AppError(`Failed to fetch financial metrics: ${error.message}`, 500));
  }
};

// Get monthly financial data (sales, commission, refunds)
const getMonthlyFinancialData = async (req, res, next) => {
  try {
    console.log('Fetching monthly financial data...');

    // Get monthly sales, commission, and refunds for the last 12 months
    const query = `
      WITH monthly_dates AS (
        SELECT 
          date_trunc('month', CURRENT_DATE - (n || ' months')::interval) AS month
        FROM generate_series(0, 11) n
      ),
      monthly_sales AS (
        SELECT 
          date_trunc('month', created_at) AS month,
          COALESCE(SUM(total_amount), 0) AS sales,
          COALESCE(SUM(platform_fee_amount), 0) AS commission
        FROM product_orders
        WHERE payment_status = 'completed'
          AND status IN ('PENDING', 'DELIVERY_COMPLETE', 'COMPLETED')
          AND created_at >= CURRENT_DATE - interval '12 months'
        GROUP BY date_trunc('month', created_at)
      ),
      monthly_refunds AS (
        SELECT 
          date_trunc('month', processed_at) AS month,
          COALESCE(SUM(amount), 0) AS refunds
        FROM refund_requests
        WHERE status = 'completed'
          AND processed_at >= CURRENT_DATE - interval '12 months'
        GROUP BY date_trunc('month', processed_at)
      )
      SELECT 
        md.month,
        COALESCE(ms.sales, 0) AS sales,
        COALESCE(ms.commission, 0) AS commission,
        COALESCE(mr.refunds, 0) AS refunds
      FROM monthly_dates md
      LEFT JOIN monthly_sales ms ON md.month = ms.month
      LEFT JOIN monthly_refunds mr ON md.month = mr.month
      ORDER BY md.month ASC
    `;

    const result = await pool.query(query);

    const monthlyData = result.rows.map(row => ({
      month: row.month,
      sales: parseFloat(row.sales) || 0,
      commission: parseFloat(row.commission) || 0,
      refunds: parseFloat(row.refunds) || 0
    }));

    res.status(200).json({
      status: 'success',
      data: monthlyData
    });
  } catch (error) {
    console.error('Error fetching monthly financial data:', error);
    next(new AppError(`Failed to fetch monthly financial data: ${error.message}`, 500));
  }
};

export {
  adminLogin,
  protect,
  processPendingPayments,
  getDashboardStats,
  getAllSellers,
  getSellerById,
  updateSellerStatus,
  getAllOrganizers,
  getOrganizerById,
  getMonthlyEvents,
  updateOrganizerStatus,
  getAllBuyers,
  getBuyerById,
  getAllEvents,
  getEventById,
  getEventTickets,
  getAllProducts,
  getSellerProducts,
  getMonthlyMetrics,
  markEventAsPaid,
  getAllWithdrawalRequests,
  updateWithdrawalRequestStatus,
  getFinancialMetrics,
  getMonthlyFinancialData,
};

