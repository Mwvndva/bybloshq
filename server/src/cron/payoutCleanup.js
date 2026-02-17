import cron from 'node-cron';
import logger from '../utils/logger.js';
import withdrawalService from '../services/withdrawal.service.js';

const schedulePayoutReconciliation = (options = {}) => {
    const schedule = options.schedule || '0 */2 * * *'; // Every 2 hours
    const hoursAgo = options.hoursAgo || 2;

    logger.info(`[PayoutCron] Scheduling reconciliation: ${schedule}`);

    return cron.schedule(schedule, async () => {
        const jobId = `reconcile-${Date.now()}`;
        logger.info(`[PayoutCron] ${jobId} starting`);
        const start = Date.now();
        try {
            await withdrawalService.reconcileStuckWithdrawals(hoursAgo);
            logger.info(`[PayoutCron] ${jobId} completed in ${((Date.now() - start) / 1000).toFixed(2)}s`);
        } catch (err) {
            logger.error(`[PayoutCron] ${jobId} failed:`, err.message);
        }
    }, { timezone: 'Africa/Nairobi' });
};

export { schedulePayoutReconciliation };
