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
            buyers: 'SELECT COUNT(*) FROM buyers'
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

        // Mock revenue and growth (as per original controller)
        stats.total_revenue = 0;
        stats.monthly_growth = {
            sellers: 0, products: 0, organizers: 0, events: 0, buyers: 0, revenue: 0
        };
        stats.recent_activities = [{
            id: 1, type: 'info', message: 'System active', timestamp: new Date().toISOString()
        }];

        return stats;
    }

    async getAllSellers() {
        const query = `
            SELECT id, full_name as name, email, phone, status, city, location, created_at, shop_name, is_active, balance
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
            SELECT o.id, o.full_name as name, o.email, o.phone, o.status, o.created_at, COUNT(e.id) as events_count
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
