// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../utils/logger.js';
import ReferralService from '../services/referral.service.js';

/**
 * Schedule the monthly referral rewards payout.
 * Runs at 02:00 AM on the 1st of every month (Africa/Nairobi).
 *
 * Pattern mirrors paymentCron.js exactly.
 * @param {{ schedule?: string }} [options]
 */
const scheduleReferralRewards = (options = {}) => {
    const schedule = /** @type {string} */ (options.schedule || '0 2 1 * *'); // 02:00 on the 1st

    logger.info(`[REFERRAL-CRON] Scheduling monthly referral rewards cron: ${schedule}`);

    return cron.schedule(schedule, async () => {
        const startTime = Date.now();
        const now = new Date();

        // Calculate the PREVIOUS calendar month
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const year = lastMonth.getFullYear();
        const month = lastMonth.getMonth() + 1; // 1-based

        const jobId = `referral-rewards-${year}-${String(month).padStart(2, '0')}`;
        logger.info(`[${jobId}] Starting monthly referral rewards job for ${year}-${String(month).padStart(2, '0')}`);

        try {
            const result = await ReferralService.processMonthlyReferralRewards(year, month);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            logger.info(`[${jobId}] Completed in ${duration}s`, {
                processed: result.processed,
                totalCredited: `KES ${result.totalCredited}`,
                duration: `${duration}s`
            });

            return result;
        } catch (err) {
            const error = /** @type {Error} */ (err);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.error(`[${jobId}] Referral rewards job failed after ${duration}s`, {
                error: error.message,
                stack: error.stack,
                duration: `${duration}s`
            });
            throw error;
        }
    }, {
        timezone: 'Africa/Nairobi'
    });
};

export { scheduleReferralRewards };
