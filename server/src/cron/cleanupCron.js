import cron from 'node-cron';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

export const scheduleCleanupJobs = () => {
    // Run daily at 3am Nairobi time
    cron.schedule('0 3 * * *', async () => {
        try {
            const result = await pool.query(
                `DELETE FROM pending_registrations WHERE expires_at < NOW()`
            );
            logger.info(`[CLEANUP] Deleted ${result.rowCount} expired pending registrations`);
        } catch (err) {
            logger.error('[CLEANUP] Failed to clean pending_registrations:', err.message);
        }
    }, { timezone: 'Africa/Nairobi' });
};


