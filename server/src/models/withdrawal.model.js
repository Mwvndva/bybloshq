import { pool } from '../config/database.js';
import { toJsonb } from '../utils/order.utils.js';

class Withdrawal {
    /**
     * Static insert for withdrawal requests (Rule 10).
     */
    static async insert(client, data) {
        const query = `
      INSERT INTO withdrawal_requests (
        seller_id, amount, mpesa_number, mpesa_name, status, api_call_pending, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

        const values = [
            data.seller_id,
            data.amount,
            data.mpesa_number,
            data.mpesa_name,
            data.status || 'processing',
            data.api_call_pending ?? true
        ];

        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    /**
     * Static status update with metadata (Rule 1).
     */
    static async updateStatus(client, requestId, status, metadataUpdate = {}) {
        const query = `
      UPDATE withdrawal_requests 
      SET status = $1, 
          processed_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          api_call_pending = FALSE,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

        const values = [status, toJsonb(metadataUpdate), requestId];
        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    /**
     * Static reference update.
     */
    static async updateReference(client, requestId, reference, rawResponse = null) {
        const query = `
      UPDATE withdrawal_requests 
      SET provider_reference = $1, 
          raw_response = COALESCE($2::jsonb, raw_response),
          api_call_pending = FALSE,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

        const values = [reference, toJsonb(rawResponse), requestId];
        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    static async findById(id) {
        const query = 'SELECT * FROM withdrawal_requests WHERE id = $1';
        const { rows } = await pool.query(query, [id]);
        return rows[0];
    }

    static async deleteBySellerId(client, sellerId) {
        const query = 'DELETE FROM withdrawal_requests WHERE seller_id = $1';
        const executor = client || pool;
        await executor.query(query, [sellerId]);
    }

    static async findByReference(reference) {
        const query = 'SELECT * FROM withdrawal_requests WHERE provider_reference = $1';
        const { rows } = await pool.query(query, [reference]);
        return rows[0];
    }

    static async findBySellerId(sellerId, { limit = 20, offset = 0, status = null } = {}) {
        const params = [sellerId];
        const clauses = ['seller_id = $1'];

        if (status) {
            params.push(status);
            clauses.push(`status = $${params.length}`);
        }

        const where = clauses.join(' AND ');
        const query = `
            SELECT * FROM withdrawal_requests 
            WHERE ${where} 
            ORDER BY created_at DESC 
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const countQuery = `SELECT COUNT(*) FROM withdrawal_requests WHERE ${where}`;

        const [data, count] = await Promise.all([
            pool.query(query, [...params, limit, offset]),
            pool.query(countQuery, params)
        ]);

        return {
            rows: data.rows,
            total: parseInt(count.rows[0].count, 10)
        };
    }

    static async findPending() {
        const query = `
            SELECT wr.*, s.full_name, s.whatsapp_number
            FROM withdrawal_requests wr
            JOIN sellers s ON wr.seller_id = s.id
            WHERE wr.status = 'processing' 
              AND wr.api_call_pending = TRUE 
              AND wr.created_at > NOW() - INTERVAL '7 days'
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    static async findStuck(hoursAgo = 2) {
        const query = `
            SELECT wr.*, s.full_name as seller_name, s.whatsapp_number
            FROM withdrawal_requests wr
            LEFT JOIN sellers s ON wr.seller_id = s.id
            WHERE wr.status = 'processing'
              AND wr.created_at < NOW() - ($1 * INTERVAL '1 hour')
              AND wr.created_at > NOW() - INTERVAL '48 hours'
            ORDER BY wr.created_at ASC
        `;
        const { rows } = await pool.query(query, [hoursAgo]);
        return rows;
    }

    static async findByProviderReference(reference) {
        const query = 'SELECT id FROM withdrawal_requests WHERE provider_reference = $1';
        const { rows } = await pool.query(query, [reference]);
        return rows[0];
    }

    static async updateMetadata(requestId, metadataUpdate) {
        const query = `
            UPDATE withdrawal_requests 
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `;
        const { rows } = await pool.query(query, [toJsonb(metadataUpdate), requestId]);
        return rows[0];
    }
}

export default Withdrawal;
