import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

class AdminService {
  async getDashboardStats() {
    // Parallel queries
    const queries = {
      sellers: 'SELECT COUNT(*) FROM sellers WHERE user_id IS NOT NULL',
      products: `
        SELECT COUNT(*)
        FROM products p
        LEFT JOIN sellers s ON s.id = p.seller_id
        WHERE s.user_id IS NOT NULL
      `,
      buyers: 'SELECT COUNT(*) FROM buyers WHERE user_id IS NOT NULL', // Active registered buyers
      creators: 'SELECT COUNT(*) FROM creators WHERE user_id IS NOT NULL',
      creatorPendingRequests: `
        SELECT COUNT(*)
        FROM seller_creator_invites
        WHERE status = 'pending'
          AND accepted_creator_id IS NOT NULL
      `,
      creatorEarnings: 'SELECT COALESCE(SUM(total_earnings + total_referral_earnings), 0) AS count FROM creators',
      clients: 'SELECT COUNT(DISTINCT buyer_id) FROM product_orders WHERE payment_status = \'completed\' AND buyer_id IS NOT NULL',
      orders: 'SELECT COUNT(*) FROM product_orders',
      wishlists: 'SELECT COUNT(*) FROM wishlists',
      activeOrders: `
        SELECT COUNT(*)
        FROM product_orders
        WHERE payment_status = 'completed'
          AND status::text NOT IN ('COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED')
      `,
      lowStockProducts: `
        SELECT COUNT(*)
        FROM products p
        LEFT JOIN sellers s ON s.id = p.seller_id
        WHERE s.user_id IS NOT NULL
          AND COALESCE(p.track_inventory, false) = true
          AND COALESCE(p.quantity, 0) <= COALESCE(NULLIF(p.low_stock_threshold, 0), 10)
      `,
      pendingWithdrawals: `
        SELECT COUNT(*)
        FROM withdrawal_requests
        WHERE status NOT IN ('completed', 'failed', 'rejected')
      `
    };

    const stats = {};

    await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        try {
          const res = await pool.query(query);
          stats[`total_${key}`] = key.toLowerCase().includes('earnings')
            ? Number.parseFloat(res.rows[0].count || 0)
            : Number.parseInt(res.rows[0].count, 10);
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
                SELECT s.id, s.full_name as name, s.shop_name, COALESCE(s.client_count, 0) as client_count
                FROM sellers s
                WHERE s.user_id IS NOT NULL
                ORDER BY COALESCE(s.client_count, 0) DESC
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
      totalCreators: stats.total_creators,
      pendingCreatorRequests: stats.total_creatorPendingRequests,
      totalCreatorEarnings: stats.total_creatorEarnings,
      totalClients: stats.total_clients,
      totalShops: stats.total_sellers,
      totalProducts: stats.total_products,
      totalOrders: stats.total_orders,
      totalWishlists: stats.total_wishlists,
      activeOrders: stats.total_activeOrders,
      lowStockProducts: stats.total_lowStockProducts,
      pendingWithdrawals: stats.total_pendingWithdrawals,
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
                (SELECT COUNT(*) FROM buyers WHERE user_id IS NOT NULL AND date_trunc('month', created_at) <= m.month) as buyers,
                (SELECT COUNT(*) FROM sellers WHERE user_id IS NOT NULL AND date_trunc('month', created_at) <= m.month) as sellers
              FROM months m
              ORDER BY m.month;
            `;

      const excludedOrderStatuses = "('CANCELLED', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED', 'MANUAL_REVIEW', 'COMPENSATION_REQUIRED')";

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
                AND o.status::text NOT IN ${excludedOrderStatuses}
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
                AND o.status::text NOT IN ${excludedOrderStatuses}
              GROUP BY m.month
              ORDER BY m.month;
            `;

      // 3. Product Distribution
      const productStatusQuery = `
              SELECT 
                CASE 
                  WHEN COALESCE(product_type::text, '') = '' THEN 'Physical'
                  ELSE INITCAP(product_type::text)
                END as name,
                COUNT(*) as value,
                COALESCE(SUM(COALESCE(quantity, 0)), 0) AS inventory
              FROM products p
              LEFT JOIN sellers s ON s.id = p.seller_id
              WHERE s.user_id IS NOT NULL
                AND COALESCE(p.status::text, 'available') != 'draft'
              GROUP BY 1;
            `;

      // 4. Geographic Distribution (buyers, sellers, and paid order GMV)
      const geoQuery = `
              WITH buyer_regions AS (
                SELECT
                  COALESCE(NULLIF(TRIM(city), ''), NULLIF(TRIM(location), ''), 'Unknown') AS name,
                  COUNT(*) AS buyers,
                  0::int AS sellers,
                  0::numeric AS gmv
                FROM buyers
                WHERE user_id IS NOT NULL
                GROUP BY 1
              ),
              seller_regions AS (
                SELECT
                  COALESCE(NULLIF(TRIM(city), ''), NULLIF(TRIM(location), ''), 'Unknown') AS name,
                  0::int AS buyers,
                  COUNT(*) AS sellers,
                  0::numeric AS gmv
                FROM sellers
                WHERE user_id IS NOT NULL
                GROUP BY 1
              ),
              order_regions AS (
                SELECT
                  COALESCE(NULLIF(TRIM(po.location_address), ''), NULLIF(TRIM(s.city), ''), NULLIF(TRIM(s.location), ''), 'Unknown') AS name,
                  0::int AS buyers,
                  0::int AS sellers,
                  COALESCE(SUM(po.total_amount), 0) AS gmv
                FROM product_orders po
                LEFT JOIN sellers s ON s.id = po.seller_id
                WHERE po.payment_status = 'completed'
                  AND po.status::text NOT IN ${excludedOrderStatuses}
                GROUP BY 1
              ),
              combined AS (
                SELECT * FROM buyer_regions
                UNION ALL
                SELECT * FROM seller_regions
                UNION ALL
                SELECT * FROM order_regions
              )
              SELECT
                name,
                SUM(buyers) AS buyers,
                SUM(sellers) AS sellers,
                SUM(gmv) AS gmv,
                SUM(buyers + sellers) AS value
              FROM combined
              GROUP BY name
              ORDER BY gmv DESC, value DESC
              LIMIT 8;
            `;

      const [userGrowth, revenueTrends, salesTrends, productStatus, geoDist] = await Promise.all([
        pool.query(userGrowthQuery).catch(e => {
          logger.error('Analytics: userGrowthQuery failed', e);
          return { rows: [] };
        }),
        pool.query(revenueQuery).catch(e => {
          logger.error('Analytics: revenueQuery failed', e);
          return { rows: [] };
        }),
        pool.query(salesQuery).catch(e => {
          logger.error('Analytics: salesQuery failed', e);
          return { rows: [] };
        }),
        pool.query(productStatusQuery).catch(e => {
          logger.error('Analytics: productStatusQuery failed', e);
          return { rows: [] };
        }),
        pool.query(geoQuery).catch(e => {
          logger.error('Analytics: geoQuery failed', e);
          return { rows: [] };
        })
      ]);

      return {
        userGrowth: userGrowth.rows,
        revenueTrends: revenueTrends.rows,
        salesTrends: salesTrends.rows,
        productStatus: productStatus.rows.map(row => ({
          ...row,
          value: Number.parseInt(row.value, 10) || 0,
          inventory: Number.parseInt(row.inventory, 10) || 0
        })),
        geoDistribution: geoDist.rows.map(row => ({
          name: row.name,
          value: Number.parseInt(row.value, 10) || 0,
          buyers: Number.parseInt(row.buyers, 10) || 0,
          sellers: Number.parseInt(row.sellers, 10) || 0,
          gmv: Number.parseFloat(row.gmv) || 0
        }))
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
            FROM sellers
            WHERE user_id IS NOT NULL
            ORDER BY created_at DESC
        `;
    const { rows } = await pool.query(query);
    return rows;
  }

  async getAllCreators() {
    const query = `
      SELECT c.id,
             c.user_id,
             c.first_name,
             c.last_name,
             CONCAT_WS(' ', c.first_name, c.last_name) AS name,
             c.email,
             c.mpesa_number,
             c.whatsapp_number,
             c.balance,
             c.total_sales,
             c.total_earnings,
             c.total_referral_earnings,
             (c.total_earnings + c.total_referral_earnings) AS total_income,
             c.status,
             c.created_at,
             COUNT(DISTINCT CASE WHEN scl.status = 'active' THEN scl.id END) AS linked_shops,
             COALESCE(SUM(CASE WHEN scl.status = 'active' THEN scl.click_count ELSE 0 END), 0) AS link_clicks,
             COUNT(DISTINCT CASE WHEN sci.status = 'pending' THEN sci.id END) AS pending_requests
      FROM creators c
      LEFT JOIN seller_creator_links scl ON scl.creator_id = c.id
      LEFT JOIN seller_creator_invites sci ON sci.accepted_creator_id = c.id
      WHERE c.user_id IS NOT NULL
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows.map(row => ({
      ...row,
      balance: Number.parseFloat(row.balance || 0),
      total_sales: Number.parseInt(row.total_sales || 0, 10),
      total_earnings: Number.parseFloat(row.total_earnings || 0),
      total_referral_earnings: Number.parseFloat(row.total_referral_earnings || 0),
      total_income: Number.parseFloat(row.total_income || 0),
      linked_shops: Number.parseInt(row.linked_shops || 0, 10),
      link_clicks: Number.parseInt(row.link_clicks || 0, 10),
      pending_requests: Number.parseInt(row.pending_requests || 0, 10)
    }));
  }

  async deleteCreator(creatorId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const creatorRes = await client.query(
        `SELECT id, user_id, email
         FROM creators
         WHERE id = $1
         FOR UPDATE`,
        [creatorId]
      );
      if (creatorRes.rows.length === 0) {
        const error = new Error('Creator not found');
        error.statusCode = 404;
        throw error;
      }

      const creator = creatorRes.rows[0];
      const userId = creator.user_id;
      const deletedEmail = `deleted-creator-${creatorId}@bybloshq.local`;

      await client.query(
        `UPDATE seller_creator_links
         SET status = 'deleted',
             updated_at = NOW()
         WHERE creator_id = $1
           AND status = 'active'`,
        [creatorId]
      );

      await client.query(
        `UPDATE seller_creator_invites
         SET status = 'creator_deleted',
             updated_at = NOW()
         WHERE accepted_creator_id = $1
           AND status IN ('pending', 'accepted')`,
        [creatorId]
      );

      await client.query(
         `UPDATE creators
         SET user_id = NULL,
             email = $2,
             mpesa_number = CONCAT('deleted-', $1::text),
             whatsapp_number = NULL,
             status = 'deleted',
             updated_at = NOW()
         WHERE id = $1`,
        [creatorId, deletedEmail]
      );

      if (userId) {
        const profileRes = await client.query(
          `SELECT
             EXISTS(SELECT 1 FROM sellers WHERE user_id = $1) AS has_seller,
             EXISTS(SELECT 1 FROM buyers WHERE user_id = $1) AS has_buyer`,
          [userId]
        );
        const { has_seller: hasSeller, has_buyer: hasBuyer } = profileRes.rows[0] || {};

        await client.query(
          `DELETE FROM user_roles
           WHERE user_id = $1
             AND role_id = (SELECT id FROM roles WHERE slug = 'creator')`,
          [userId]
        );

        if (!hasSeller && !hasBuyer) {
          await client.query('DELETE FROM users WHERE id = $1', [userId]);
        } else {
          const nextRole = hasSeller ? 'seller' : 'buyer';
          await client.query(
            `UPDATE users
             SET role = CASE WHEN role = 'creator' THEN $2 ELSE role END,
                 updated_at = NOW()
             WHERE id = $1`,
            [userId, nextRole]
          );
        }

        try {
          const CacheService = (await import('./cache.service.js')).default;
          await CacheService.delete(`user:${userId}:cross-roles`);
        } catch (cacheError) {
          logger.warn('[ADMIN_DELETE_CREATOR] Failed to invalidate cross-role cache:', cacheError.message);
        }
      }

      await client.query('COMMIT');
      return { deletedCreatorId: Number(creatorId), preservedHistory: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting creator ${creatorId}:`, error);
      throw error;
    } finally {
      client.release();
    }
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
                COUNT(po.*) as total_orders,
                COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN po.total_amount ELSE 0 END), 0) as total_sales,
                COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN po.platform_fee_amount ELSE 0 END), 0) as total_commission,
                COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN po.seller_payout_amount ELSE 0 END), 0) as net_sales,
                COUNT(CASE WHEN po.status = 'PENDING' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN po.status = 'COMPLETED' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN po.status = 'CANCELLED' THEN 1 END) as cancelled_orders
            FROM product_orders po
            LEFT JOIN payouts p
              ON p.order_id = po.id
             AND p.status = 'completed'
            WHERE po.seller_id = $1
        `, [id]);

    const productCountRes = await pool.query('SELECT COUNT(*) as total FROM products WHERE seller_id = $1', [id]);

    // Wishlist Count (All products belonging to this seller)
    const wishlistCountRes = await pool.query(`
            SELECT COUNT(*) as total 
            FROM wishlists w
            JOIN products p ON w.product_id = p.id
            WHERE p.seller_id = $1
        `, [id]);

    const recentOrdersRes = await pool.query(`
            SELECT id, order_number, buyer_name, total_amount, status, payment_status, created_at
            FROM product_orders WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 5
        `, [id]);

    const metrics = metricsRes.rows[0];

    return {
      ...seller,
      metrics: {
        totalOrders: parseInt(metrics.total_orders, 10),
        totalSales: parseFloat(metrics.total_sales),
        totalCommission: parseFloat(metrics.total_commission),
        netSales: parseFloat(metrics.net_sales),
        pendingOrders: parseInt(metrics.pending_orders, 10),
        completedOrders: parseInt(metrics.completed_orders, 10),
        cancelledOrders: parseInt(metrics.cancelled_orders, 10),
        totalProducts: parseInt(productCountRes.rows[0].total, 10),
        wishlistCount: parseInt(wishlistCountRes.rows[0].total, 10)
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
    const { rows } = await pool.query(`
      SELECT
        b.id,
        b.full_name AS name,
        b.email,
        b.mobile_payment AS phone,
        b.city,
        b.location,
        MAX(po.created_at) AS created_at,
        COUNT(po.id) AS order_count,
        COALESCE(SUM(CASE WHEN po.payment_status = 'completed' THEN po.total_amount ELSE 0 END), 0) AS total_spend,
        s.id AS seller_id,
        s.full_name AS seller_name,
        s.shop_name AS seller_shop_name
      FROM buyers b
      JOIN product_orders po ON po.buyer_id = b.id
      LEFT JOIN sellers s ON s.id = po.seller_id
      WHERE b.user_id IS NOT NULL
      GROUP BY b.id, s.id, s.full_name, s.shop_name
      ORDER BY MAX(po.created_at) DESC
      LIMIT 500
    `);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,
      location: row.location,
      created_at: row.created_at,
      orderCount: Number.parseInt(row.order_count, 10) || 0,
      totalSpend: Number.parseFloat(row.total_spend) || 0,
      sellerId: row.seller_id,
      sellerName: row.seller_shop_name || row.seller_name || 'Unassigned'
    }));
  }

  async deleteUser(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Identify user role
      const userRes = await client.query('SELECT id, role, email FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (userRes.rows.length === 0) throw new Error('User not found');
      const user = userRes.rows[0];
      const deletedEmail = `deleted-user-${userId}@bybloshq.local`;

      if (user.role === 'seller') {
        const sellerRes = await client.query('SELECT id FROM sellers WHERE user_id = $1 FOR UPDATE', [userId]);
        if (sellerRes.rows.length > 0) {
          const sellerId = sellerRes.rows[0].id;

          await client.query(`
            UPDATE sellers
            SET user_id = NULL,
                full_name = 'Deleted seller',
                email = $2,
                whatsapp_number = NULL,
                updated_at = NOW()
            WHERE id = $1
          `, [sellerId, deletedEmail]);

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

      const buyerRow = await client.query('SELECT id FROM buyers WHERE user_id = $1 FOR UPDATE', [userId]);
      if (buyerRow.rows.length > 0) {
        const buyerId = buyerRow.rows[0].id;
        await client.query('DELETE FROM wishlists WHERE buyer_id = $1', [buyerId]);
        await client.query(`
          UPDATE buyers
          SET user_id = NULL,
              full_name = 'Deleted buyer',
              email = $2,
              mobile_payment = CONCAT('deleted-', $1::text),
              whatsapp_number = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [buyerId, deletedEmail]);
      }

      // Now safe to delete the user row
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
      return { deletedUserId: Number(userId), preservedHistory: true };
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


