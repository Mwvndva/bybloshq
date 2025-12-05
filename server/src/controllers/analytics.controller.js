import pool from '../db/index.js';
import { AppError } from '../utils/errorHandler.js';

/**
 * @desc    Get analytics data for the authenticated seller
 * @route   GET /api/sellers/analytics
 * @access  Private/Seller
 */
export const getSellerAnalytics = async (req, res, next) => {
  console.log('=== getSellerAnalytics called ===');
  console.log('Request user:', {
    id: req.user?.id,
    userType: req.user?.userType,
    role: req.user?.role
  });
  
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
    console.log('Products query result:', productsResult.rows[0]);

    // 2. Get total sales (sum of total_amount for all orders)
    const totalSalesResult = await pool.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) as total_sales
       FROM product_orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND o.status IN ('PROCESSING', 'COMPLETED')`,
      [sellerId]
    );
    console.log('Total sales query result:', totalSalesResult.rows[0]);

    // 3. Get total revenue (sum of total_amount for this seller)
    // Include all COMPLETED and PROCESSING orders
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) as total_revenue
       FROM product_orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND o.status IN ('PROCESSING', 'COMPLETED')`,
      [sellerId]
    );
    
    // Also get the total seller payout for reference
    const payoutResult = await pool.query(
      `SELECT COALESCE(SUM(o.seller_payout_amount), 0) as total_payout
       FROM product_orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND o.status IN ('PROCESSING', 'COMPLETED')`,
      [sellerId]
    );
    
    console.log('Revenue and Payout:', {
      total_revenue: revenueResult.rows[0].total_revenue,
      total_payout: payoutResult.rows[0].total_payout
    });
    console.log('Net revenue query result:', revenueResult.rows[0]);

    // 4. Get monthly sales data for the last 12 months
    console.log('Fetching monthly sales data...');
    const monthlySalesResult = await pool.query(
      `SELECT 
         TO_CHAR(o.created_at, 'YYYY-MM') as month,
         COALESCE(SUM(o.seller_payout_amount), 0) as sales
       FROM product_orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id::INTEGER = p.id
       WHERE p.seller_id = $1 
         AND o.status IN ('PROCESSING', 'COMPLETED')
         AND o.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
       ORDER BY month`,
      [sellerId]
    );
    console.log('Monthly sales query result:', monthlySalesResult.rows);

    // 5. Get seller's balance
    console.log('Fetching seller balance...');
    const sellerBalanceResult = await pool.query(
      `SELECT balance FROM sellers WHERE id = $1`,
      [sellerId]
    );
    const sellerBalance = parseFloat(sellerBalanceResult.rows[0]?.balance || 0);
    console.log('Seller balance:', sellerBalance ? {
      sellerId: sellerBalance.seller_id,
      balance: sellerBalance.balance,
      email: sellerBalance.email ? '[REDACTED]' : 'missing',
      phone: sellerBalance.phone ? '[REDACTED]' : 'missing'
    } : 'Not found');

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
    console.log('Recent orders query result:', recentOrdersResult.rows);

    // Commit the transaction
    await pool.query('COMMIT');
    console.log('Transaction committed successfully');

    try {
      // Format the response
      const analyticsData = {
        totalProducts: parseInt(productsResult.rows[0]?.total_products || 0),
        totalSales: parseFloat(totalSalesResult.rows[0]?.total_sales || 0),
        totalRevenue: parseFloat(revenueResult.rows[0]?.total_revenue || 0),
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
        }))
      };

      console.log('Sending analytics response:', JSON.stringify(analyticsData, null, 2));
      
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
