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
          stats[`total_${key}`] = parseInt(res.rows[0].count, 10);
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
        clientCount: parseInt(row.client_count)
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
                status as name,
                COUNT(*) as value
              FROM products 
              GROUP BY status;
            `;

      // 4. Geographic Distribution (Top 5 Cities)
      const geoQuery = `
              SELECT COALESCE(NULLIF(city, ''), 'Unknown') as name, COUNT(*) as value
              FROM buyers 
              GROUP BY COALESCE(NULLIF(city, ''), 'Unknown')
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
            SELECT id, full_name as name, email, whatsapp_number as phone, status, city, location, created_at, shop_name, balance
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
        totalOrders: parseInt(metrics.total_orders),
        totalSales: parseFloat(metrics.total_sales),
        totalCommission: parseFloat(metrics.total_commission),
        netSales: parseFloat(metrics.net_sales),
        pendingOrders: parseInt(metrics.pending_orders),
        completedOrders: parseInt(metrics.completed_orders),
        cancelledOrders: parseInt(metrics.cancelled_orders),
        totalProducts: parseInt(productCountRes.rows[0].total)
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
        // Resolve seller row
        const sellerRes = await client.query('SELECT id FROM sellers WHERE user_id = $1', [userId]);
        if (sellerRes.rows.length > 0) {
          const sellerId = sellerRes.rows[0].id;

          // Delete junction tables that directly reference seller id
          await client.query('DELETE FROM seller_clients WHERE seller_id = $1', [sellerId]);
          await client.query('DELETE FROM clients WHERE seller_id = $1', [sellerId]);

          // Nullify seller references on orders (preserve order history)
          await client.query('UPDATE product_orders SET seller_id = NULL WHERE seller_id = $1', [sellerId]);

          // Delete products owned by this seller (wishlists reference products, cascade via FK or nullify)
          await client.query('DELETE FROM wishlists WHERE product_id IN (SELECT id FROM products WHERE seller_id = $1)', [sellerId]);
          await client.query('DELETE FROM products WHERE seller_id = $1', [sellerId]);

          // Now safe to delete the seller row
          await client.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
        }
      } else if (role === 'buyer') {
        // buyers table uses user_id
        await client.query('DELETE FROM buyers WHERE user_id = $1', [userId]);
      }

      // 2. Delete from users table last
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
