import { promisify } from 'util';
import dotenv from 'dotenv';
import { AppError } from '../../../shared/utils/errorHandler.js';
import AdminService from './admin.service.js';
import AuthService from '../auth/auth.service.js';
import * as userRepository from '../users/user.repository.js';
import * as buyerRepository from '../../commerce/buyers/buyer.repository.js';
import * as adminProductRepository from '../../commerce/repositories/adminProduct.repository.js';
import * as adminMetricsRepository from '../../growth/repositories/adminMetrics.repository.js';
import * as withdrawalRequestRepository from '../../payments/withdrawals/withdrawalRequest.repository.js';
import * as sellerRepository from '../../commerce/sellers/seller.repository.js';
import payoutService from '../../payments/payouts/payout.service.js';
import { PaymentService } from '../../payments/payments/payment.service.js';
import logger from '../../../shared/utils/logger.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import LogisticsDashboardService from '../../logistics/logisticsDashboard.service.js';
import { getWithdrawalReservedAmount } from '../../../shared/utils/withdrawalUtils.js';
import { setAuthCookie } from '../../../shared/utils/cookie.utils.js';

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

    const authResult = await AuthService.login(email, password, 'admin');

    if (!authResult || !authResult.user) {
      return next(new AppError('Invalid email or password', 401));
    }

    const { user, token } = authResult;

    setAuthCookie(res, token);

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

const getMe = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    const user = await userRepository.findByIdMinimal(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
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

const getAllCreators = async (req, res, next) => {
  try {
    const creators = await AdminService.getAllCreators();
    res.status(200).json({ status: 'success', results: creators.length, data: creators });
  } catch (error) {
    next(error);
  }
};

const deleteCreator = async (req, res, next) => {
  try {
    const result = await AdminService.deleteCreator(req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'Creator account deleted. Earnings and sales history were preserved for audit.',
      data: result
    });
  } catch (error) {
    next(new AppError(error.message || 'Failed to delete creator account', error.statusCode || 500));
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
    const availableColumns = await adminProductRepository.findProductColumnNames();
    const hasStock = availableColumns.includes('stock');
    const hasStatus = availableColumns.includes('status');

    const rows = await adminProductRepository.findAllWithSeller({ hasStock, hasStatus });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: rows.map(product => ({
        ...product,
        stock: hasStock ? (product.stock || 0) : 0,
        status: hasStatus ? (product.status || 'available') : 'available',
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

    const availableColumns = await adminProductRepository.findProductColumnNames();
    const hasStock = availableColumns.includes('stock');
    const hasStatus = availableColumns.includes('status');

    const rows = await adminProductRepository.findBySellerWithSeller({ sellerId, hasStock, hasStatus });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: rows.map(product => ({
        ...product,
        stock: hasStock ? (product.stock || 0) : 0,
        status: hasStatus ? (product.status || 'available') : 'available',
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
    const rows = await adminMetricsRepository.findMonthlyEntityCounts();

    const monthlyMetrics = rows.map(row => ({
      month: row.month,
      seller_count: Number.parseInt(row.seller_count) || 0,
      product_count: Number.parseInt(row.product_count) || 0,
      buyer_count: Number.parseInt(row.buyer_count) || 0
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

const getFinancialMetrics = async (req, res, next) => {
  try {
    const [sales, commission, completedRefunds, pendingRefunds] = await Promise.all([
      adminMetricsRepository.findTotalSales(),
      adminMetricsRepository.findTotalCommission(),
      adminMetricsRepository.findCompletedRefundsTotal(),
      adminMetricsRepository.findPendingRefundsTotal()
    ]);

    const totalSales = Number.parseFloat(sales?.total_sales) || 0;
    const totalOrders = Number.parseInt(sales?.total_orders, 10) || 0;
    const totalCommission = Number.parseFloat(commission?.total_commission) || 0;
    const totalRefunds = Number.parseFloat(completedRefunds?.total_refunds) || 0;
    const totalRefundRequests = Number.parseInt(completedRefunds?.total_refund_requests, 10) || 0;
    const pendingRefundsVal = Number.parseFloat(pendingRefunds?.pending_refunds) || 0;
    const netRevenue = totalSales - totalRefunds;

    res.status(200).json({
      status: 'success',
      data: {
        totalSales,
        totalOrders,
        totalCommission,
        totalRefunds,
        totalRefundRequests,
        pendingRefunds: pendingRefundsVal,
        netRevenue
      }
    });
  } catch (error) {
    logger.error('Error fetching financial metrics:', error);
    next(new AppError(`Failed to fetch financial metrics: ${error.message}`, 500));
  }
};

const getMonthlyFinancialMetrics = async (req, res, next) => {
  try {
    const rows = await adminMetricsRepository.findMonthlyFinancials();

    const monthlyFinancialData = rows.map(row => {
      let monthStr = '';
      if (row.month instanceof Date) {
        monthStr = row.month.toISOString().split('T')[0];
      } else if (typeof row.month === 'string') {
        monthStr = row.month.split('T')[0];
      } else {
        monthStr = String(row.month || '');
      }

      return {
        month: monthStr,
        sales: Number.parseFloat(row.sales) || 0,
        commission: Number.parseFloat(row.commission) || 0,
        refunds: Number.parseFloat(row.refunds) || 0
      };
    });

    res.status(200).json({
      status: 'success',
      data: monthlyFinancialData
    });
  } catch (error) {
    logger.error('Error fetching monthly financial metrics:', error);
    next(new AppError(`Failed to fetch monthly financial metrics: ${error.message}`, 500));
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
      Number.parseInt(hours, 10),
      Number.parseInt(limit, 10)
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
    const rows = await buyerRepository.findAllForAdmin();

    // Process the rows to include default values for city and location
    const buyers = rows.map(buyer => ({
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
    const buyer = await buyerRepository.findByIdForAdmin(id);

    if (!buyer) {
      return next(new AppError('Buyer not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: buyer
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
    const result = await AdminService.deleteUser(id);
    res.status(200).json({
      status: 'success',
      message: 'User login deleted. Financial, order, and logistics history was preserved for audit.',
      data: result
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    next(new AppError(error.message || 'Failed to delete user account', error.statusCode || 500));
  }
};

// GET /api/admin/withdrawal-requests
const getAllWithdrawalRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const rows = await withdrawalRequestRepository.findAllWithSeller({ status });

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
        creatorId: r.creator_id,
        buyerId: r.buyer_id,
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

const getAdminLogisticsRequests = async (req, res, next) => {
  try {
    const data = await LogisticsDashboardService.getAdminRequests({
      status: req.query.status,
      sort: req.query.sort,
      limit: req.query.limit,
      offset: req.query.offset
    });

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    logger.error('getAdminLogisticsRequests error:', error);
    next(new AppError('Failed to fetch logistics requests', 500));
  }
};

const adminUpdateLogisticsLegStatus = async (req, res, next) => {
  try {
    const result = await LogisticsDashboardService.adminUpdateLegStatus({
      admin: req.user,
      requestId: req.params.requestId,
      legType: req.params.legType,
      status: req.body.status,
      reason: req.body.reason
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('adminUpdateLogisticsLegStatus error:', error);
    next(error);
  }
};

const adminResolveLogisticsDispute = async (req, res, next) => {
  try {
    const result = await LogisticsDashboardService.adminResolveDispute({
      admin: req.user,
      requestId: req.params.requestId,
      resolution: req.body.resolution,
      note: req.body.note
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('adminResolveLogisticsDispute error:', error);
    next(error);
  }
};

const updateWithdrawalRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const result = await AdminService.overrideWithdrawalStatus({
      id,
      status,
      reason,
      adminId: req.user.id
    });

    res.status(200).json({
      status: 'success',
      message: `Withdrawal request status overridden to ${status}`,
      data: result
    });
  } catch (error) {
    logger.error('Error updating withdrawal request status:', error);
    next(error);
  }
};


/**
 * Get payment provider balance/status for pay-ins and payouts.
 */
const getPaymentProviderBalances = async (req, res, next) => {
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
    logger.error('Error fetching payment provider balance/status:', error);
    next(new AppError('Failed to fetch payment provider balance/status', 500));
  }
};

export {
  adminLogin,
  getPaymentProviderBalances,
  processPendingPayments,
  getDashboardStats,
  getAllSellers,
  getAllCreators,
  deleteCreator,
  getSellerById,
  updateSellerStatus,
  getAllBuyers,
  getBuyerById,
  getAllProducts,
  getSellerProducts,
  getMonthlyMetrics,
  getFinancialMetrics,
  getMonthlyFinancialMetrics,
  getAllWithdrawalRequests,
  updateWithdrawalRequestStatus,
  getAnalytics,
  getAllClients,
  deleteUser,
  getAdminLogisticsRequests,
  adminUpdateLogisticsLegStatus,
  adminResolveLogisticsDispute,
  getMe
};
