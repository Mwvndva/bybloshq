import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

class AdminService {
    async getDashboardStats() {
        // Parallel queries
        const queries = {
            sellers: 'SELECT COUNT(*) FROM sellers',
            products: 'SELECT COUNT(*) FROM products',
            organizers: 'SELECT COUNT(*) FROM organizers',
            events: 'SELECT COUNT(*) FROM events',
            buyers: 'SELECT COUNT(*) FROM buyers',
            orders: 'SELECT COUNT(*) FROM product_orders', // Assuming product_orders table exists
            wishlists: 'SELECT COUNT(*) FROM wishlists' // Assuming wishlists table exists
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

        // Map to expected frontend keys
        return {
            totalSellers: stats.total_sellers,
            totalBuyers: stats.total_buyers, // Total Clients
            totalShops: stats.total_sellers, // Same as sellers
            totalEvents: stats.total_events,
            totalProducts: stats.total_products,
            totalOrders: stats.total_orders,
            totalOrganizers: stats.total_organizers,
            totalWishlists: stats.total_wishlists
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

            // 2. Revenue Trends (Last 6 months)
            // Using payments table if available, else product_orders
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
                COALESCE(SUM(amount), 0) as revenue,
                COUNT(id) as orders
              FROM months m
              LEFT JOIN payments p ON date_trunc('month', p.created_at) = m.month AND p.status = 'completed'
              GROUP BY m.month
              ORDER BY m.month;
            `;

            // 3. Product Status Distribution
            const productStatusQuery = `
              SELECT 
                CASE 
                  WHEN stock > 0 THEN 'In Stock' 
                  ELSE 'Out of Stock' 
                END as name,
                COUNT(*) as value
              FROM products 
              GROUP BY 
                CASE 
                  WHEN stock > 0 THEN 'In Stock' 
                  ELSE 'Out of Stock' 
                END;
            `;

            // 4. Geographic Distribution (Top 5 Cities)
            const geoQuery = `
              SELECT COALESCE(NULLIF(city, ''), 'Unknown') as name, COUNT(*) as value
              FROM buyers 
              GROUP BY COALESCE(NULLIF(city, ''), 'Unknown')
              ORDER BY value DESC 
              LIMIT 5;
            `;

            const [userGrowth, revenueTrends, productStatus, geoDist] = await Promise.all([
                pool.query(userGrowthQuery).catch(e => ({ rows: [] })),
                pool.query(revenueQuery).catch(e => ({ rows: [] })),
                pool.query(productStatusQuery).catch(e => ({ rows: [] })),
                pool.query(geoQuery).catch(e => ({ rows: [] }))
            ]);

            return {
                userGrowth: userGrowth.rows,
                revenueTrends: revenueTrends.rows,
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
            SELECT id, full_name as name, email, whatsapp_number as phone, status, city, location, created_at, shop_name, is_active, balance
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

    // Organizers
    async getAllOrganizers() {
        const query = `
            SELECT o.id, o.full_name as name, o.email, o.whatsapp_number as phone, o.status, o.created_at, COUNT(e.id) as events_count
            FROM organizers o
            LEFT JOIN events e ON o.id = e.organizer_id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    async updateOrganizerStatus(id, status) {
        const res = await pool.query('UPDATE organizers SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        return res.rows[0];
    }
}

export default new AdminService();
