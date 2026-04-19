import { pool } from '../config/database.js';

class Wishlist {
    static async getCountBySellerId(sellerId) {
        const query = `
            SELECT COUNT(*) as total 
            FROM wishlists w
            JOIN products p ON w.product_id = p.id
            WHERE p.seller_id = $1
        `;
        const { rows } = await pool.query(query, [sellerId]);
        return parseInt(rows[0].total, 10);
    }

    static async deleteBySellerId(client, sellerId) {
        const query = 'DELETE FROM wishlists WHERE product_id IN (SELECT id FROM products WHERE seller_id = $1)';
        const executor = client || pool;
        await executor.query(query, [sellerId]);
    }

    static async deleteByBuyerId(client, buyerId) {
        const query = 'DELETE FROM wishlists WHERE buyer_id = $1';
        const executor = client || pool;
        await executor.query(query, [buyerId]);
    }

    static async deleteByUserId(client, userId) {
        const query = 'DELETE FROM wishlists WHERE buyer_id IN (SELECT id FROM buyers WHERE user_id = $1)';
        const executor = client || pool;
        await executor.query(query, [userId]);
    }
}

export default Wishlist;
