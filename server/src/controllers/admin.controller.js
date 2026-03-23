import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import dotenv from 'dotenv';
import AppError from '../utils/appError.js';
import AdminService from '../services/admin.service.js';
import { pool } from '../config/database.js';
import whatsappService from '../services/whatsapp.service.js';
import payoutService from '../services/payout.service.js';
import { PaymentService } from '../services/payment.service.js';
import logger from '../utils/logger.js';

const paymentService = new PaymentService();

dotenv.config();

// Admin login (kept as is, simple enough)
// Admin login with Email/Password
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Reuse shared auth logic directly or via service
    // For now, simpler to query user and check role
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || user.role !== 'admin' || !(await bcrypt.compare(password, user.password_hash))) {
      return next(new AppError('Invalid email or password', 401));
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await AdminService.getAnalytics();
    res.status(200).json({ status: 'success', data: analytics });
  } catch (error) {
    next(error);
  }
};



const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await AdminService.getDashboardStats();
    res.status(200).json({ status: 'success', data: stats });
  } catch (error) {
    next(error);
  }
};

const getAllSellers = async (req, res, next) => {
  try {
    const sellers = await AdminService.getAllSellers();
    res.status(200).json({ status: 'success', results: sellers.length, data: sellers });
  } catch (error) {
    next(error);
  }
};

const getSellerById = async (req, res, next) => {
  try {
    const seller = await AdminService.getSellerById(req.params.id);
    if (!seller) return next(new AppError('Seller not found', 404));
    res.status(200).json({ status: 'success', data: seller });
  } catch (error) {
    next(error);
  }
};

const updateSellerStatus = async (req, res, next) => {
  try {
    const updated = await AdminService.updateSellerStatus(req.params.id, req.body.status);
    if (!updated) return next(new AppError('Seller not found', 404));
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
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
    const result = await paymentService.processPendingPayments(
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
        mobile_payment as phone,
        whatsapp_number,
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
        mobile_payment as phone,
        whatsapp_number,
        status,
        city,
        location,
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

// Get all clients
const getAllClients = async (req, res, next) => {
  try {
    const clients = await AdminService.getAllClients();
    res.status(200).json({
      status: 'success',
      results: clients.length,
      data: clients
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    next(new AppError('Failed to fetch clients', 500));
  }
};

// Delete user (Block action)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await AdminService.deleteUser(id);
    res.status(200).json({
      status: 'success',
      message: 'User account and associated data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    next(new AppError('Failed to delete user account', 500));
  }
};

// GET /api/admin/withdrawal-requests
const getAllWithdrawalRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    const where = status ? `WHERE wr.status = $${params.push(status)}` : '';

    const { rows } = await pool.query(
      `SELECT
                wr.id,
                wr.amount,
                wr.mpesa_number,
                wr.mpesa_name,
                wr.status,
                wr.provider_reference,
                wr.created_at,
                wr.processed_at,
                wr.processed_by,
                wr.metadata,
                'seller' AS entity_type,
                s.full_name AS entity_name,
                s.email         AS entity_email,
                s.whatsapp_number AS entity_phone,
                s.balance     AS current_balance,
                wr.seller_id
             FROM withdrawal_requests wr
             LEFT JOIN sellers    s  ON wr.seller_id    = s.id
             ${where}
             ORDER BY wr.created_at DESC
             LIMIT 500`,
      params
    );

    res.status(200).json({
      status: 'success',
      count: rows.length,
      data: rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        mpesaNumber: r.mpesa_number,
        mpesaName: r.mpesa_name,
        status: r.status,
        providerReference: r.provider_reference,
        entityType: r.entity_type,
        entityName: r.entity_name,
        entityEmail: r.entity_email,
        entityPhone: r.entity_phone,
        currentBalance: parseFloat(r.current_balance || 0),
        sellerId: r.seller_id,
        failureReason: r.metadata?.api_error || r.metadata?.remarks || null,
        mpesaReceipt: r.metadata?.mpesa_receipt || null,
        reconciliationFlag: r.metadata?.reconciliation_flag || null,
        createdAt: r.created_at,
        processedAt: r.processed_at,
        processedBy: r.processed_by
      }))
    });
  } catch (error) {
    logger.error('getAllWithdrawalRequests error:', error);
    next(new AppError('Failed to fetch withdrawal requests', 500));
  }
};

// PATCH /api/admin/withdrawal-requests/:id/status
// Admin can only override to 'completed' or 'failed' — Payd handles real processing
const updateWithdrawalRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['completed', 'failed'].includes(status)) {
      return next(new AppError('Admin override status must be "completed" or "failed"', 400));
    }

    const { rows: [request] } = await pool.query(
      `SELECT wr.*, 
                    s.whatsapp_number AS entity_phone,
                    s.balance AS entity_balance
             FROM withdrawal_requests wr
             LEFT JOIN sellers    s ON wr.seller_id    = s.id
             WHERE wr.id = $1`,
      [id]
    );

    if (!request) return next(new AppError('Withdrawal request not found', 404));

    if (['completed', 'failed'].includes(request.status)) {
      return next(new AppError(`Already finalized as "${request.status}" — cannot override`, 400));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE withdrawal_requests
                 SET status       = $1,
                     processed_at = NOW(),
                     processed_by = $2,
                     metadata     = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
                 WHERE id = $4`,
        [
          status,
          `admin:${req.user.id}`,
          JSON.stringify({ admin_override: { reason, timestamp: new Date(), admin_id: req.user.id } }),
          id
        ]
      );

      // If admin marks as failed → refund balance (it was deducted at creation)
      let newBalance = null;
      if (status === 'failed') {
        newBalance = await payoutService.refundToWallet(client, request);
      }

      await client.query('COMMIT');

      // Notify entity
      if (request.entity_phone) {
        whatsappService.notifySellerWithdrawalUpdate(request.entity_phone, {
          amount: request.amount,
          status,
          reference: request.provider_reference || `REQ-${id}`,
          reason: reason || (status === 'failed' ? 'Rejected by admin' : null),
          newBalance
        }).catch(err => logger.error('Admin override WA notify failed:', err));
      }

      res.status(200).json({
        status: 'success',
        message: `Withdrawal manually set to "${status}"`,
        data: { id: parseInt(id), status, processedBy: `admin:${req.user.id}`, newBalance }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('updateWithdrawalRequestStatus error:', error);
    next(error);
  }
};

// @desc    Mark event as paid (withdrawal processed)
// @route   PATCH /api/admin/events/:eventId/mark-paid
// @access  Private (Admin)


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

/**
 * Get Payd balances (both Pay-ins and Payouts)
 */
const getPaydBalances = async (req, res, next) => {
  try {
    const [payinBalance, payoutBalance] = await Promise.all([
      paymentService.checkBalance().catch(err => ({ error: err.message })),
      payoutService.checkPayoutBalance().catch(err => ({ error: err.message }))
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        payin: payinBalance,
        payout: payoutBalance,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching Payd balances:', error);
    next(new AppError('Failed to fetch Payd balances', 500));
  }
};

export {
  adminLogin,
  getPaydBalances,

  processPendingPayments,
  getDashboardStats,
  getAllSellers,
  getSellerById,
  updateSellerStatus,
  getAllBuyers,
  getBuyerById,
  getAllProducts,
  getSellerProducts,
  getMonthlyMetrics,
  getAllWithdrawalRequests,
  updateWithdrawalRequestStatus,
  getFinancialMetrics,
  getMonthlyFinancialData,
  getAnalytics,
  getAllClients,
  deleteUser
};

