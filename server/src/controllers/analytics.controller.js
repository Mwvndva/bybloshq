import * as sellerAnalyticsRepository from '../repositories/sellerAnalytics.repository.js';
import { AppError } from '../shared/utils/errorHandler.js';

const SELLER_ANALYTICS_EXCLUDED_STATUSES = [
  'CANCELLED',
  'FAILED',
  'EXPIRED',
  'REFUND_PENDING',
  'REFUNDED',
  'MANUAL_REVIEW',
  'COMPENSATION_REQUIRED'
];

/**
 * @desc    Get analytics data for the authenticated seller
 * @route   GET /api/sellers/analytics
 * @access  Private/Seller
 */
export const getSellerAnalytics = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new AppError('Authentication required', 401));
  }

  const sellerId = req.user.sellerId;
  const excludedStatuses = SELLER_ANALYTICS_EXCLUDED_STATUSES;

  try {
    const [
      totalProducts,
      sellerStatsRow,
      monthlySalesRows,
      recentOrdersRows,
      wishlistCount,
      clickCount,
    ] = await Promise.all([
      sellerAnalyticsRepository.countAvailableProducts(sellerId),
      sellerAnalyticsRepository.findSellerStats({ sellerId, excludedStatuses }),
      sellerAnalyticsRepository.findMonthlySales({ sellerId, excludedStatuses }),
      sellerAnalyticsRepository.findRecentOrders({ sellerId, excludedStatuses }),
      sellerAnalyticsRepository.countWishlistsForSeller(sellerId),
      sellerAnalyticsRepository.countRecentKnocks(sellerId),
    ]);

    const sellerStats = sellerStatsRow || {
      total_sales: 0,
      net_revenue: 0,
      balance: 0,
      available_balance: 0,
      pending_settlement_balance: 0,
      withdrawal_reserved_balance: 0,
      refund_reserved_balance: 0,
      next_settlement_at: null,
      client_count: 0,
      creator_count: 0,
      creator_generated_sales: 0,
    };

    const analyticsData = {
      totalProducts,
      totalSales: parseFloat(sellerStats.total_sales || 0),
      totalRevenue: parseFloat(sellerStats.net_revenue || 0),
      balance: parseFloat(sellerStats.balance || 0),
      availableBalance: parseFloat(sellerStats.available_balance ?? sellerStats.balance ?? 0),
      pendingSettlementBalance: parseFloat(sellerStats.pending_settlement_balance || 0),
      withdrawalReservedBalance: parseFloat(sellerStats.withdrawal_reserved_balance || 0),
      refundReservedBalance: parseFloat(sellerStats.refund_reserved_balance || 0),
      nextSettlementAt: sellerStats.next_settlement_at || null,
      clientCount: parseInt(sellerStats.client_count || 0),
      creatorCount: parseInt(sellerStats.creator_count || 0),
      creatorGeneratedSales: parseFloat(sellerStats.creator_generated_sales || 0),
      wishlistCount,
      clickCount,
      monthlySales: monthlySalesRows.map(row => ({
        month: row.month,
        sales: parseFloat(row.sales || 0)
      })),
      recentOrders: recentOrdersRows.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: parseFloat(order.total_amount || 0),
        createdAt: order.created_at,
        items: order.items || []
      })),
    };

    return res.status(200).json({
      status: 'success',
      data: analyticsData
    });

  } catch (error) {
    console.error('Error in getSellerAnalytics:', error.message);

    if (error.code === '42P01') {
      const missingTable = error.message.includes('order_items') ? 'order_items' :
        error.message.includes('product_orders') ? 'product_orders' :
          error.message.includes('seller_knocks') ? 'seller_knocks' :
            error.message.includes('wishlists') ? 'wishlists' :
              error.message.includes('products') ? 'products' : 'required tables';
      return next(new AppError(`Required table (${missingTable}) missing. Run migrations.`, 500));
    }
    if (error.code === '42P02') {
      return next(new AppError('Database schema mismatch. Run migrations.', 500));
    }
    if (error instanceof AppError) return next(error);

    return next(new AppError(`Error fetching analytics data: ${error.message}`, 500));
  }
};
