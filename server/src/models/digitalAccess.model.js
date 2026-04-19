import { pool } from '../config/database.js';

class DigitalAccess {
    /**
     * Grant digital entitlement for a user.
     */
    static async grant(client, { userId, productId, orderId }) {
        const executor = client || pool;
        const query = `
            INSERT INTO user_digital_access (user_id, product_id, order_id, access_status)
            VALUES ($1, $2, $3, 'ACTIVE')
            ON CONFLICT (user_id, product_id) DO UPDATE
            SET 
              access_status = 'ACTIVE',
              updated_at = NOW()
            RETURNING id
        `;
        const { rows } = await executor.query(query, [userId, productId, orderId]);
        return rows[0];
    }

    /**
     * Check if a user has access to a digital product.
     */
    static async checkAccess(userId, productId) {
        const query = `
            SELECT id FROM user_digital_access
            WHERE user_id = $1 AND product_id = $2 AND access_status = 'ACTIVE'
        `;
        const { rows } = await pool.query(query, [userId, productId]);
        return rows.length > 0;
    }
}

export default DigitalAccess;
