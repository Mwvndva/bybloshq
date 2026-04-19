import { pool } from '../config/database.js';

class Refund {
    static async requestRefund(data) {
        const query = `
            INSERT INTO refund_requests (
                buyer_id, amount, status, payment_method, payment_details, requested_at, updated_at
            ) VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())
            RETURNING *
        `;
        const values = [
            data.buyer_id,
            data.amount,
            data.payment_method || 'M-Pesa',
            data.payment_details // Should be JSONB string/object
        ];
        const { rows } = await pool.query(query, values);
        return rows[0];
    }

    static async findPendingByBuyerId(buyerId) {
        const query = `
            SELECT id, amount, status, requested_at
            FROM refund_requests
            WHERE buyer_id = $1 AND status = 'pending'
            ORDER BY requested_at DESC
        `;
        const { rows } = await pool.query(query, [buyerId]);
        return rows;
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT 
                rr.*,
                b.id as buyer_id,
                b.full_name as buyer_name,
                b.email as buyer_email,
                b.whatsapp_number as buyer_phone,
                b.refunds as buyer_current_refunds
            FROM refund_requests rr
            JOIN buyers b ON rr.buyer_id = b.id
        `;
        const params = [];
        if (filters.status) {
            query += ` WHERE rr.status = $1`;
            params.push(filters.status);
        }

        query += ` ORDER BY rr.requested_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(filters.limit || 20, filters.offset || 0);

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async countAll(status = null) {
        const query = status
            ? 'SELECT COUNT(*) FROM refund_requests WHERE status = $1'
            : 'SELECT COUNT(*) FROM refund_requests';
        const params = status ? [status] : [];
        const { rows } = await pool.query(query, params);
        return parseInt(rows[0].count, 10);
    }

    static async findById(id) {
        const query = `
            SELECT 
                rr.*,
                b.id as buyer_id,
                b.full_name as buyer_name,
                b.email as buyer_email,
                b.whatsapp_number as buyer_phone,
                b.refunds as buyer_current_refunds
            FROM refund_requests rr
            JOIN buyers b ON rr.buyer_id = b.id
            WHERE rr.id = $1
        `;
        const { rows } = await pool.query(query, [id]);
        return rows[0];
    }

    static async findByIdForUpdate(client, id) {
        const query = 'SELECT * FROM refund_requests WHERE id = $1 FOR UPDATE';
        const executor = client || pool;
        const { rows } = await executor.query(query, [id]);
        return rows[0];
    }

    static async updateStatus(client, id, data) {
        const query = `
            UPDATE refund_requests
            SET status = $1,
                admin_notes = $2,
                processed_by = $3,
                processed_at = NOW(),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `;
        const values = [data.status, data.admin_notes, data.processed_by, id];
        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }
}

export default Refund;
