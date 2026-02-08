import { pool } from '../src/config/database.js';
import logger from '../src/utils/logger.js';

async function monitorPaydConnections() {
    try {
        const { rows } = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as total_attempts,
                COUNT(*) FILTER (WHERE status = 'completed') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE metadata::text LIKE '%ECONNRESET%') as conn_reset_errors
            FROM payments
            WHERE created_at > NOW() - INTERVAL '24 hours'
            AND provider_reference IS NOT NULL
            GROUP BY hour
            ORDER BY hour DESC
        `);

        console.log('Payd Connection Health (Last 24 Hours):');
        console.table(rows);

        // Alert if connection reset rate is high
        const totalResets = rows.reduce((sum, r) => sum + parseInt(r.conn_reset_errors), 0);
        const totalAttempts = rows.reduce((sum, r) => sum + parseInt(r.total_attempts), 0);

        if (totalAttempts > 0) {
            const resetRate = (totalResets / totalAttempts) * 100;
            console.log(`\nOverall Connection Reset Rate: ${resetRate.toFixed(2)}%`);

            if (resetRate > 5) {
                logger.error(`HIGH ECONNRESET RATE: ${resetRate.toFixed(2)}%`, {
                    totalResets,
                    totalAttempts
                });
            }
        } else {
            console.log('\nNo payment attempts in the last 24 hours.');
        }
    } catch (error) {
        console.error('Monitoring failed:', error);
    }
}

monitorPaydConnections().then(() => process.exit(0));
