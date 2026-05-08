import cron from 'node-cron';
import logger from '../shared/utils/logger.js';
import withdrawalService from '../services/withdrawal.service.js';
import { pool } from '../shared/db/database.js';

const PAYOUT_RECONCILIATION_LOCK_KEY = 'byblos:payout-reconciliation';

const schedulePayoutReconciliation = (options = {}) => {
    const schedule = options.schedule || '0 */2 * * *'; // Every 2 hours
    const hoursAgo = options.hoursAgo || 2;

    logger.info(`[PayoutCron] Scheduling reconciliation: ${schedule}`);

    return cron.schedule(schedule, async () => {
        const jobId = `reconcile-${Date.now()}`;
        logger.info(`[PayoutCron] ${jobId} starting`);
        const start = Date.now();
        const client = await pool.connect();
        let lockAcquired = false;
        try {
            const { rows: [lock] } = await client.query(
                'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
                [PAYOUT_RECONCILIATION_LOCK_KEY]
            );
            lockAcquired = lock?.locked === true;
            if (!lockAcquired) {
                logger.info(`[PayoutCron] ${jobId} skipped; another instance owns the reconciliation lock`);
                return;
            }
            await withdrawalService.reconcileStuckWithdrawals(hoursAgo);
            logger.info(`[PayoutCron] ${jobId} completed in ${((Date.now() - start) / 1000).toFixed(2)}s`);
        } catch (err) {
            logger.error(`[PayoutCron] ${jobId} failed:`, err.message);
        } finally {
            if (lockAcquired) {
                await client.query('SELECT pg_advisory_unlock(hashtext($1))', [PAYOUT_RECONCILIATION_LOCK_KEY])
                    .catch(error => logger.error(`[PayoutCron] ${jobId} failed to release lock:`, error.message));
            }
            client.release();
        }
    }, { timezone: 'Africa/Nairobi' });
};

export { schedulePayoutReconciliation };

