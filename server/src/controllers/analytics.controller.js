import { pool } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';

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
  if (!sellerId) {
    return next(new AppError('No seller profile linked to this account. Please contact support.', 400));
  }

  try {
    // Run all read-only queries in parallel — no transaction needed
    const [
      productsResult,
      sellerStatsResult,
      monthlySalesResult,
      recentOrdersResult,
    ] = await Promise.all([
      // 1. Total products count
      pool.query(
        `SELECT COUNT(*) as total_products 
         FROM products 
         WHERE seller_id = $1 AND status = 'available'`,
        [sellerId]
      ),
      // 2. Seller stats (source of truth)
      pool.query(
        `SELECT 
           COALESCE(total_sales, 0) as total_sales, 
           COALESCE(net_revenue, 0) as net_revenue, 
           COALESCE(balance, 0) as balance 
         FROM sellers WHERE id = $1`,
        [sellerId]
      ),
      // 3. Monthly sales (last 12 months)
      pool.query(
        `SELECT 
           TO_CHAR(o.created_at, 'YYYY-MM') as month,
           COALESCE(SUM(o.total_amount), 0) as sales
         FROM product_orders o
         WHERE o.seller_id = $1 
           AND o.status IN ('PROCESSING', 'COMPLETED', 'DELIVERY_PENDING', 'COLLECTION_PENDING', 'SERVICE_PENDING')
           AND o.created_at >= NOW() - INTERVAL '12 months'
         GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
         ORDER BY month`,
        [sellerId]
      ),
      // 4. Recent orders
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
           AND o.status IN ('PENDING', 'PROCESSING', 'COMPLETED')
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [sellerId]
      ),
    ]);

    const sellerStats = sellerStatsResult.rows[0] || { total_sales: 0, net_revenue: 0, balance: 0 };
    const sellerBalance = parseFloat(sellerStats.balance);

    // 5. Debt queries — graceful fallback if client_debts table doesn't exist
    let debtStats = { count: 0, total_amount: 0 };
    let recentDebts = [];

    try {
      const [debtStatsResult, recentDebtsResult] = await Promise.all([
        pool.query(
          `SELECT 
             COUNT(*) as count,
             COALESCE(SUM(amount), 0) as total_amount
           FROM client_debts 
           WHERE seller_id = $1 AND is_paid = false`,
          [sellerId]
        ),
        pool.query(
          `SELECT 
             cd.id,
             cd.amount,
             cd.created_at,
             c.full_name as client_name,
             c.phone as client_phone,
             p.name as product_name
           FROM client_debts cd
           JOIN clients c ON cd.client_id = c.id
           JOIN products p ON cd.product_id = p.id
           WHERE cd.seller_id = $1 AND cd.is_paid = false
           ORDER BY cd.created_at DESC
           LIMIT 5`,
          [sellerId]
        ),
      ]);
      debtStats = debtStatsResult.rows[0] || { count: 0, total_amount: 0 };
      recentDebts = recentDebtsResult.rows.map(debt => ({
        id: debt.id,
        amount: parseFloat(debt.amount || 0),
        clientName: debt.client_name,
        clientPhone: debt.client_phone,
        productName: debt.product_name,
        createdAt: debt.created_at
      }));
    } catch (debtError) {
      // client_debts table may not exist yet — return zeroed debt data, don't crash
      console.warn('Debt query failed (table may not exist):', debtError.message);
    }

    const analyticsData = {
      totalProducts: parseInt(productsResult.rows[0]?.total_products || 0),
      totalSales: parseFloat(sellerStats.total_sales),
      totalRevenue: parseFloat(sellerStats.net_revenue),
      totalPayout: parseFloat(sellerStats.net_revenue),
      balance: sellerBalance,
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
      pendingDebtCount: parseInt(debtStats.count || 0),
      pendingDebt: parseFloat(debtStats.total_amount || 0),
      recentDebts,
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