import { pool } from '../shared/db/database.js';
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

  try {
    const [
      productsResult,
      sellerStatsResult,
      monthlySalesResult,
      recentOrdersResult,
      wishlistCountResult,
      clickCountResult,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total_products
         FROM products
         WHERE seller_id = $1 AND status = 'available'`,
        [sellerId]
      ),
      pool.query(
        `SELECT
           COALESCE(financials.total_sales, 0) as total_sales,
           COALESCE(financials.net_revenue, 0) as net_revenue,
           COALESCE(s.balance, 0) as balance,
           COALESCE(s.client_count, 0) as client_count,
           COALESCE(creator_links.creator_count, 0) as creator_count,
           COALESCE(creator_sales.creator_generated_sales, 0) as creator_generated_sales
         FROM sellers s
         LEFT JOIN LATERAL (
           SELECT
             COALESCE(SUM(o.total_amount), 0) as total_sales,
             COALESCE(SUM(o.seller_payout_amount), 0) as net_revenue
           FROM product_orders o
           WHERE o.seller_id = s.id
             AND o.payment_status = 'completed'
             AND o.status::text <> ALL($2::text[])
         ) financials ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT scl.creator_id)::int as creator_count
           FROM seller_creator_links scl
           JOIN creators c ON c.id = scl.creator_id
           WHERE scl.seller_id = s.id
             AND scl.status = 'active'
             AND c.status = 'active'
         ) creator_links ON true
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(o.total_amount), 0) as creator_generated_sales
           FROM product_orders o
           WHERE o.seller_id = s.id
             AND o.payment_status = 'completed'
             AND o.status::text <> ALL($2::text[])
             AND COALESCE(o.metadata, '{}'::jsonb) ? 'creator_attribution'
         ) creator_sales ON true
         WHERE s.id = $1`,
        [sellerId, SELLER_ANALYTICS_EXCLUDED_STATUSES]
      ),
      pool.query(
        `SELECT
           TO_CHAR(o.created_at, 'YYYY-MM') as month,
           COALESCE(SUM(o.total_amount), 0) as sales
         FROM product_orders o
         WHERE o.seller_id = $1
           AND o.payment_status = 'completed'
           AND o.status::text <> ALL($2::text[])
           AND o.created_at >= NOW() - INTERVAL '12 months'
         GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
         ORDER BY month`,
        [sellerId, SELLER_ANALYTICS_EXCLUDED_STATUSES]
      ),
      pool.query(
        `SELECT
           o.id,
           o.order_number,
           o.status,
           o.total_amount,
           o.created_at,
           (
             SELECT json_agg(
               json_build_object(
                 'id', oi.id,
                 'product_name', oi.product_name,
                 'quantity', oi.quantity,
                 'price', oi.product_price
               )
             )
             FROM order_items oi
             WHERE oi.order_id = o.id
           ) as items
         FROM product_orders o
         WHERE o.seller_id = $1
           AND o.payment_status = 'completed'
           AND o.status::text <> ALL($2::text[])
         ORDER BY o.created_at DESC
         LIMIT 8`,
        [sellerId, SELLER_ANALYTICS_EXCLUDED_STATUSES]
      ),
      pool.query(
        `SELECT COUNT(*) as wishlist_count
         FROM wishlists w
         JOIN products p ON p.id = w.product_id
         WHERE p.seller_id = $1`,
        [sellerId]
      ),
      pool.query(
        `SELECT COUNT(*) as click_count
         FROM seller_knocks
         WHERE seller_id = $1
           AND created_at >= NOW() - INTERVAL '24 hours'`,
        [sellerId]
      ),
    ]);

    const sellerStats = sellerStatsResult.rows[0] || {
      total_sales: 0,
      net_revenue: 0,
      balance: 0,
      client_count: 0,
      creator_count: 0,
      creator_generated_sales: 0,
    };

    const analyticsData = {
      totalProducts: parseInt(productsResult.rows[0]?.total_products || 0),
      totalSales: parseFloat(sellerStats.total_sales || 0),
      totalRevenue: parseFloat(sellerStats.net_revenue || 0),
      balance: parseFloat(sellerStats.balance || 0),
      clientCount: parseInt(sellerStats.client_count || 0),
      creatorCount: parseInt(sellerStats.creator_count || 0),
      creatorGeneratedSales: parseFloat(sellerStats.creator_generated_sales || 0),
      wishlistCount: parseInt(wishlistCountResult.rows[0]?.wishlist_count || 0),
      clickCount: parseInt(clickCountResult.rows[0]?.click_count || 0),
      monthlySales: monthlySalesResult.rows.map(row => ({
        month: row.month,
        sales: parseFloat(row.sales || 0)
      })),
      recentOrders: recentOrdersResult.rows.map(order => ({
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
