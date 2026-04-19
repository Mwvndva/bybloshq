import { pool } from '../config/database.js';

class SecurityAlert {
    static async insert(type, details) {
        const query = `
            INSERT INTO security_alerts 
            (alert_type, details, created_at) 
            VALUES ($1, $2, NOW())
            RETURNING *
        `;
        const { rows } = await pool.query(query, [type, JSON.stringify(details)]);
        return rows[0];
    }

    static async getStats(hours = 24) {
        const query = `
            SELECT
                alert_type,
                COUNT(*)        AS count,
                MAX(created_at) AS last_occurrence
            FROM security_alerts
            WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
            GROUP BY alert_type
            ORDER BY count DESC
        `;
        const { rows } = await pool.query(query, [hours]);
        return rows;
    }

    static async markReviewed(alertId, reviewedBy) {
        const query = `
            UPDATE security_alerts 
            SET reviewed = true, 
                reviewed_by = $1, 
                reviewed_at = NOW() 
            WHERE id = $2
        `;
        await pool.query(query, [reviewedBy, alertId]);
    }
}

export default SecurityAlert;
