import pool from '../db/index.js';
import { AppError } from '../utils/errorHandler.js';

/**
 * @desc    Get analytics data for the authenticated seller
 * @route   GET /api/sellers/analytics
 * @access  Private/Seller
 */
export const getSellerAnalytics = async (req, res, next) => {
  const sellerId = req.user.id; // Get seller ID from authenticated user

  try {
    // Start a transaction
    await pool.query('BEGIN');

    // 1. Get total products count
    const productsResult = await pool.query(
      `SELECT COUNT(*) as total_products 
       FROM products 
       WHERE seller_id = $1 AND status = 'available'`,
      [sellerId]
    );

    // 2. Get total revenue (sum of all order items for this seller)
    // Only include orders that are either confirmed or delivered more than 24 hours ago
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(oi.quantity * oi.product_price), 0) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND (
           o.status = 'confirmed' 
           OR (
             o.status = 'delivered' 
             AND o.updated_at < NOW() - INTERVAL '24 hours'
           )
         )`,
      [sellerId]
    );

    // 3. Get monthly sales data for the last 12 months
    const monthlySalesResult = await pool.query(
      `SELECT 
         TO_CHAR(o.created_at, 'YYYY-MM') as month,
         COALESCE(SUM(oi.quantity * oi.product_price), 0) as sales
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND (
           o.status = 'confirmed' 
           OR (
             o.status = 'delivered' 
             AND o.updated_at < NOW() - INTERVAL '24 hours'
           )
         )
         AND o.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
       ORDER BY month`,
      [sellerId]
    );

    // 4. Get total tickets sold (if applicable)
    const ticketsResult = await pool.query(
      `SELECT COALESCE(SUM(oi.quantity), 0) as total_tickets
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND o.status = 'delivered'`,
      [sellerId]
    );

    // Commit the transaction
    await pool.query('COMMIT');

    // Format the response
    const analyticsData = {
      totalProducts: parseInt(productsResult.rows[0]?.total_products || 0),
      totalRevenue: parseFloat(revenueResult.rows[0]?.total_revenue || 0),
      monthlySales: monthlySalesResult.rows.map(row => ({
        month: row.month,
        sales: parseFloat(row.sales || 0)
      })),
      totalTicketsSold: parseInt(ticketsResult.rows[0]?.total_tickets || 0)
    };

    res.status(200).json({
      status: 'success',
      data: analyticsData
    });

  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Error in getSellerAnalytics:', error);
    
    if (error instanceof AppError) {
      return next(error);
    }
    
    // Handle database errors
    if (error.code === '42P01') { // Undefined table
      return next(new AppError('Required database tables do not exist', 500));
    }
    
    return next(new AppError('Error fetching analytics data', 500));
  }
};
