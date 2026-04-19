import { pool } from '../config/database.js';

class Admin {
    static async getCounts() {
        const queries = {
            sellers: 'SELECT COUNT(*) FROM sellers',
            products: 'SELECT COUNT(*) FROM products',
            buyers: 'SELECT COUNT(*) FROM buyers WHERE user_id IS NOT NULL',
            clients: 'SELECT COUNT(*) FROM clients',
            orders: 'SELECT COUNT(*) FROM product_orders',
            wishlists: 'SELECT COUNT(*) FROM wishlists'
        };

        const stats = {};
        await Promise.all(
            Object.entries(queries).map(async ([key, query]) => {
                const { rows } = await pool.query(query);
                stats[key] = parseInt(rows[0].count, 10);
            })
        );
        return stats;
    }

    static async getTopShops(limit = 3) {
        const query = `
            SELECT s.id, s.full_name as name, s.shop_name, COUNT(c.id) as client_count
            FROM sellers s
            LEFT JOIN clients c ON s.id = c.seller_id
            GROUP BY s.id
            ORDER BY client_count DESC
            LIMIT $1
        `;
        const { rows } = await pool.query(query, [limit]);
        return rows;
    }

    static async getUserGrowth() {
        const query = `
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
        const { rows } = await pool.query(query);
        return rows;
    }

    static async getRevenueTrends() {
        const query = `
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
        const { rows } = await pool.query(query);
        return rows;
    }

    static async getSalesTrends() {
        const query = `
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
        const { rows } = await pool.query(query);
        return rows;
    }

    static async getProductStatusDistribution() {
        const query = `
            SELECT 
              CASE 
                WHEN status = 'available' THEN 'Available'
                WHEN status = 'sold' THEN 'Sold'
                ELSE INITCAP(status::text)
              END as name,
              COUNT(*) as value
            FROM products 
            WHERE status != 'draft'
            GROUP BY 1;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    static async getGeoDistribution() {
        const query = `
            SELECT COALESCE(NULLIF(city, ''), 'Unknown City') as name, COUNT(*) as value
            FROM buyers 
            GROUP BY 1
            ORDER BY value DESC 
            LIMIT 5;
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    static async getDashboardStats() {
        const [stats, topShops] = await Promise.all([
            this.getCounts(),
            this.getTopShops(3)
        ]);

        return {
            totalSellers: stats.sellers,
            totalBuyers: stats.buyers,
            totalClients: stats.clients,
            totalShops: stats.sellers,
            totalProducts: stats.products,
            totalOrders: stats.orders,
            totalWishlists: stats.wishlists,
            topShops: topShops.map(row => ({
                id: row.id,
                name: row.name,
                shopName: row.shop_name,
                clientCount: parseInt(row.client_count, 10)
            }))
        };
    }

    static async getAnalytics() {
        const [userGrowth, revenueTrends, salesTrends, productStatus, geoDist] = await Promise.all([
            this.getUserGrowth(),
            this.getRevenueTrends(),
            this.getSalesTrends(),
            this.getProductStatusDistribution(),
            this.getGeoDistribution()
        ]);

        return {
            userGrowth,
            revenueTrends,
            salesTrends,
            productStatus,
            geoDistribution: geoDist
        };
    }
}

export default Admin;
