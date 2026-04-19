import { pool } from '../config/database.js';

class WebhookLog {
    static async insert(reference, ip, payload) {
        const query = `
            INSERT INTO webhook_logs 
            (reference, client_ip, payload, created_at) 
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        `;
        const { rows } = await pool.query(query, [reference, ip, JSON.stringify(payload)]);
        return rows[0];
    }

    static async getIpCount(ip, hours = 1) {
        const query = `
            SELECT COUNT(*) as count 
            FROM webhook_logs 
            WHERE client_ip = $1 
            AND created_at > NOW() - ($2 * INTERVAL '1 hour')
        `;
        const { rows } = await pool.query(query, [ip, hours]);
        return parseInt(rows[0]?.count || 0, 10);
    }

    static async getReferenceCount(reference, hours = 1) {
        const query = `
            SELECT COUNT(*) as count 
            FROM webhook_logs 
            WHERE reference = $1 
            AND created_at > NOW() - ($2 * INTERVAL '1 hour')
        `;
        const { rows } = await pool.query(query, [reference, hours]);
        return parseInt(rows[0]?.count || 0, 10);
    }

    static async getPatterns(hours = 24) {
        const query = `
            SELECT
                client_ip,
                COUNT(*)                  AS webhook_count,
                COUNT(DISTINCT reference) AS unique_transactions,
                MIN(created_at)           AS first_seen,
                MAX(created_at)           AS last_seen
            FROM webhook_logs
            WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
            GROUP BY client_ip
            ORDER BY webhook_count DESC
            LIMIT 20
        `;
        const { rows } = await pool.query(query, [hours]);
        return rows;
    }

    static async deleteOld(daysToKeep = 30) {
        const query = `
            DELETE FROM webhook_logs
            WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
        `;
        const { rowCount } = await pool.query(query, [daysToKeep]);
        return rowCount;
    }
}

export default WebhookLog;
