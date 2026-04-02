import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

class AdminService {
  async getDashboardStats() {
    // Parallel queries
    const queries = {
      sellers: 'SELECT COUNT(*) FROM sellers',
      products: 'SELECT COUNT(*) FROM products',
      buyers: 'SELECT COUNT(*) FROM buyers WHERE user_id IS NOT NULL', // Registered buyers
      clients: 'SELECT COUNT(*) FROM clients', // New stats
      orders: 'SELECT COUNT(*) FROM product_orders',
      wishlists: 'SELECT COUNT(*) FROM wishlists'
    };

    const stats = {};

    await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        try {
          const res = await pool.query(query);
          stats[`total_${key}`] = Number.parseInt(res.rows[0].count, 10);
        } catch (e) {
          logger.error(`Failed to count ${key}:`, e);
          stats[`total_${key}`] = 0;
        }
      })
    );

    // Fetch top 3 shops by client count
    let topShops = [];
    try {
      const topShopsRes = await pool.query(`
                SELECT s.id, s.full_name as name, s.shop_name, COUNT(c.id) as client_count
                FROM sellers s
                LEFT JOIN clients c ON s.id = c.seller_id
                GROUP BY s.id
                ORDER BY client_count DESC
                LIMIT 3
            `);
      topShops = topShopsRes.rows.map(row => ({
        id: row.id,
        name: row.name,
        shopName: row.shop_name,
        clientCount: Number.parseInt(row.client_count)
      }));
    } catch (e) {
      logger.error('Failed to fetch top shops:', e);
    }

    // Map to expected frontend keys
    return {
      totalSellers: stats.total_sellers,
      totalBuyers: stats.total_buyers,
      totalClients: stats.total_clients,
      totalShops: stats.total_sellers,
      totalProducts: stats.total_products,
      totalOrders: stats.total_orders,
      totalWishlists: stats.total_wishlists,
      topShops
    };
  }

  async getAnalytics() {
    try {
      // 1. User Growth (Last 6 months)
      const userGrowthQuery = `
              WITH months AS (
                SELECT generate_series(
                  date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                  date_trunc('month', CURRENT_DATE),
                  '1 month'::interval
                ) as month
              )
              SELECT 
                to_char(m.month, 'Mon') as name,
                (SELECT COUNT(*) FROM buyers WHERE date_trunc('month', created_at) <= m.month) as buyers,
                (SELECT COUNT(*) FROM sellers WHERE date_trunc('month', created_at) <= m.month) as sellers
              FROM months m
              ORDER BY m.month;
            `;

      // 2. Revenue Trends (Platform commission)
      const revenueQuery = `
              WITH months AS (
                SELECT generate_series(
                  date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                  date_trunc('month', CURRENT_DATE),
                  '1 month'::interval
                ) as month
              )
              SELECT 
                to_char(m.month, 'Mon') as name,
                COALESCE(SUM(platform_fee_amount), 0) as revenue,
                COUNT(id) as orders
              FROM months m
              LEFT JOIN product_orders o ON date_trunc('month', o.created_at) = m.month 
                AND o.payment_status = 'completed'
                AND o.status IN ('PENDING', 'DELIVERY_COMPLETE', 'COMPLETED')
              GROUP BY m.month
              ORDER BY m.month;
            `;

      // 2b. Sales Trends (Total Volume)
      const salesQuery = `
              WITH months AS (
                SELECT generate_series(
                  date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                  date_trunc('month', CURRENT_DATE),
                  '1 month'::interval
                ) as month
              )
              SELECT 
                to_char(m.month, 'Mon') as name,
                COALESCE(SUM(total_amount), 0) as sales
              FROM months m
              LEFT JOIN product_orders o ON date_trunc('month', o.created_at) = m.month 
                AND o.payment_status = 'completed'
                AND o.status IN ('PENDING', 'DELIVERY_COMPLETE', 'COMPLETED')
              GROUP BY m.month
              ORDER BY m.month;
            `;

      // 3. Product Status Distribution
      const productStatusQuery = `
              SELECT 
                CASE 
                  WHEN status = 'available' THEN 'Available'
                  WHEN status = 'sold' THEN 'Sold'
                  ELSE INITCAP(status)
                END as name,
                COUNT(*) as value
              FROM products 
              WHERE status != 'draft'
              GROUP BY status;
            `;

      // 4. Geographic Distribution (Top 5 Areas in Nairobi)
      const geoQuery = `
              SELECT COALESCE(NULLIF(location, ''), 'Unknown') as name, COUNT(*) as value
              FROM buyers 
              WHERE city = 'Nairobi' OR city IS NULL OR city = ''
              GROUP BY COALESCE(NULLIF(location, ''), 'Unknown')
              ORDER BY value DESC 
              LIMIT 5;
            `;

      const [userGrowth, revenueTrends, salesTrends, productStatus, geoDist] = await Promise.all([
        pool.query(userGrowthQuery).catch(e => ({ rows: [] })),
        pool.query(revenueQuery).catch(e => ({ rows: [] })),
        pool.query(salesQuery).catch(e => ({ rows: [] })),
        pool.query(productStatusQuery).catch(e => ({ rows: [] })),
        pool.query(geoQuery).catch(e => ({ rows: [] }))
      ]);

      return {
        userGrowth: userGrowth.rows,
        revenueTrends: revenueTrends.rows,
        salesTrends: salesTrends.rows,
        productStatus: productStatus.rows,
        geoDistribution: geoDist.rows
      };
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      // Return empty structures on error to avoid UI crash
      return {
        userGrowth: [],
        revenueTrends: [],
        productStatus: [],
        geoDistribution: []
      };
    }
  }

  async getAllSellers() {
    const query = `
            SELECT id, user_id, full_name as name, email, whatsapp_number as phone, status, city, location, created_at, shop_name, balance
            FROM sellers ORDER BY created_at DESC
        `;
    const { rows } = await pool.query(query);
    return rows;
  }

  async getSellerById(id) {
    // (Copying aggregation logic from controller)
    // Seller Info
    const sellerRes = await pool.query('SELECT * FROM sellers WHERE id = $1', [id]);
    if (!sellerRes.rows[0]) return null;

    const seller = sellerRes.rows[0];

    // Metrics
    const metricsRes = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END), 0) as total_sales,
                COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN platform_fee_amount ELSE 0 END), 0) as total_commission,
                COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN seller_payout_amount ELSE 0 END), 0) as net_sales,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders
            FROM product_orders WHERE seller_id = $1
        `, [id]);

    const productCountRes = await pool.query('SELECT COUNT(*) as total FROM products WHERE seller_id = $1', [id]);

    const recentOrdersRes = await pool.query(`
            SELECT id, order_number, buyer_name, total_amount, status, payment_status, created_at
            FROM product_orders WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 5
        `, [id]);

    const metrics = metricsRes.rows[0];

    return {
      ...seller,
      metrics: {
        totalOrders: Number.parseInt(metrics.total_orders),
        totalSales: Number.parseFloat(metrics.total_sales),
        totalCommission: Number.parseFloat(metrics.total_commission),
        netSales: Number.parseFloat(metrics.net_sales),
        pendingOrders: Number.parseInt(metrics.pending_orders),
        completedOrders: Number.parseInt(metrics.completed_orders),
        cancelledOrders: Number.parseInt(metrics.cancelled_orders),
        totalProducts: Number.parseInt(productCountRes.rows[0].total)
      },
      recentOrders: recentOrdersRes.rows
    };
  }

  async updateSellerStatus(id, status) {
    const res = await pool.query(
      'UPDATE sellers SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return res.rows[0];
  }

  async getAllClients() {
    const query = `
            SELECT c.*, s.full_name as seller_name, s.shop_name 
            FROM clients c
            LEFT JOIN sellers s ON c.seller_id = s.id
            ORDER BY c.created_at DESC
        `;
    const { rows } = await pool.query(query);
    return rows;
  }

  async deleteUser(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Identify user role
      const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) throw new Error('User not found');
      const role = userRes.rows[0].role;

      if (role === 'seller') {
        const sellerRes = await client.query('SELECT id FROM sellers WHERE user_id = $1', [userId]);
        if (sellerRes.rows.length > 0) {
          const sellerId = sellerRes.rows[0].id;

          // Delete payout and withdrawal history (FK dependencies)
          await client.query('DELETE FROM payouts WHERE seller_id = $1', [sellerId]);
          await client.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [sellerId]);

          // Delete junction tables
          await client.query('DELETE FROM seller_clients WHERE seller_id = $1', [sellerId]);
          await client.query('DELETE FROM clients WHERE seller_id = $1', [sellerId]);

          // Delete orders and products
          await client.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM product_orders WHERE seller_id = $1)', [sellerId]);
          await client.query('DELETE FROM product_orders WHERE seller_id = $1', [sellerId]);
          await client.query('DELETE FROM wishlists WHERE product_id IN (SELECT id FROM products WHERE seller_id = $1)', [sellerId]);
          await client.query('DELETE FROM products WHERE seller_id = $1', [sellerId]);

          await client.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
        }
      }

      // --- Universal cleanup: runs for ALL roles (Sellers can be Buyers too) ---

      // Fix for "seller_clients" FK violation (where user is the client)
      // Also decrement client count for affected sellers
      await client.query(`
        UPDATE sellers 
        SET client_count = GREATEST(COALESCE(client_count, 0) - 1, 0)
        WHERE id IN (SELECT seller_id FROM seller_clients WHERE user_id = $1)
      `, [userId]);
      await client.query('DELETE FROM seller_clients WHERE user_id = $1', [userId]);

      const buyerRow = await client.query('SELECT id FROM buyers WHERE user_id = $1', [userId]);
      if (buyerRow.rows.length > 0) {
        const buyerId = buyerRow.rows[0].id;
        // Cleanup buyer specific FKs
        await client.query('DELETE FROM wishlists WHERE buyer_id = $1', [buyerId]);
        await client.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM product_orders WHERE buyer_id = $1)', [buyerId]);
        await client.query('DELETE FROM product_orders WHERE buyer_id = $1', [buyerId]);
        await client.query('DELETE FROM buyers WHERE id = $1', [buyerId]);
      }

      // Now safe to delete the user row
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting user ${userId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new AdminService();
