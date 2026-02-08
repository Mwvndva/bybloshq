import { pool } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';

/**
 * @desc    Get analytics data for the authenticated seller
 * @route   GET /api/sellers/analytics
 * @access  Private/Seller
 */
export const getSellerAnalytics = async (req, res, next) => {
  console.log('=== getSellerAnalytics called ===');


  if (!req.user || !req.user.id) {
    console.error('Error: User not authenticated or missing user ID');
    return next(new AppError('Authentication required', 401));
  }

  const sellerId = req.user.id; // Get seller ID from authenticated user
  console.log('Seller ID:', sellerId);

  try {
    // Start a transaction
    await pool.query('BEGIN');
    console.log('Transaction started');

    // 1. Get total products count
    const productsResult = await pool.query(
      `SELECT COUNT(*) as total_products 
       FROM products 
       WHERE seller_id = $1 AND status = 'available'`,
      [sellerId]
    );


    // 2. Get stats from sellers table (Source of Truth)
    console.log('Fetching seller stats from sellers table...');
    const sellerStatsResult = await pool.query(
      `SELECT 
         COALESCE(total_sales, 0) as total_sales, 
         COALESCE(net_revenue, 0) as net_revenue, 
         COALESCE(balance, 0) as balance 
       FROM sellers WHERE id = $1`,
      [sellerId]
    );
    const sellerStats = sellerStatsResult.rows[0] || { total_sales: 0, net_revenue: 0, balance: 0 };




    // 3. Get monthly sales data (using product_orders directly to avoid overcounting)
    console.log('Fetching monthly sales data...');
    const monthlySalesResult = await pool.query(
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
    );


    const sellerBalance = parseFloat(sellerStats.balance);


    // 6. Get recent orders
    console.log('Fetching recent orders...');
    const recentOrdersResult = await pool.query(
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
    );


    // 7. Get pending debt count, total amount, and recent debt list
    console.log('Fetching pending debts...');
    const debtStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM(amount), 0) as total_amount
       FROM client_debts 
       WHERE seller_id = $1 AND is_paid = false`,
      [sellerId]
    );

    console.log('Fetching recent debts list...');
    const recentDebtsResult = await pool.query(
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
    );

    // Commit the transaction
    await pool.query('COMMIT');
    console.log('Transaction committed successfully');

    try {
      // Format the response
      const analyticsData = {
        totalProducts: parseInt(productsResult.rows[0]?.total_products || 0),
        totalSales: parseFloat(sellerStats.total_sales),
        totalRevenue: parseFloat(sellerStats.net_revenue), // Map net_revenue to totalRevenue (Revenue card)
        totalPayout: parseFloat(sellerStats.net_revenue),   // Keep for compatibility
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
        pendingDebtCount: parseInt(debtStatsResult.rows[0]?.count || 0),
        pendingDebt: parseFloat(debtStatsResult.rows[0]?.total_amount || 0),
        recentDebts: recentDebtsResult.rows.map(debt => ({
          id: debt.id,
          amount: parseFloat(debt.amount || 0),
          clientName: debt.client_name,
          clientPhone: debt.client_phone,
          productName: debt.product_name,
          createdAt: debt.created_at
        }))
      };



      res.status(200).json({
        status: 'success',
        data: analyticsData
      });
    } catch (formatError) {
      console.error('Error formatting response:', formatError);
      throw new AppError('Error formatting analytics data', 500);
    }
  } catch (error) {
    // Rollback in case of error
    try {
      await pool.query('ROLLBACK');
      console.log('Transaction rolled back due to error');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }

    console.error('Error in getSellerAnalytics:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      query: error.query,
      parameters: error.parameters
    });

    // Handle specific database errors
    if (error.code === '42P01') { // Undefined table
      const missingTable = error.message.includes('order_items') ? 'order_items' :
        error.message.includes('product_orders') ? 'product_orders' :
          error.message.includes('products') ? 'products' : 'required tables';
      return next(new AppError(`Required database tables (${missingTable}) do not exist. Please run database migrations.`, 500));
    }
    if (error.code === '42P02') { // Undefined column
      return next(new AppError('Database schema mismatch. Please check your database migrations.', 500));
    }
    if (error.code === '23505') { // Unique violation
      return next(new AppError('Duplicate entry found in the database', 400));
    }
    if (error.code === '23503') { // Foreign key violation
      return next(new AppError('Reference error: related data not found in the database', 400));
    }

    // If it's already an AppError, pass it along
    if (error instanceof AppError) {
      return next(error);
    }

    // For any other error, return a generic 500 error with the actual error message
    return next(new AppError(`Error fetching analytics data: ${error.message}`, 500));
  }
};
