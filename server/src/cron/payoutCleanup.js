// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../utils/logger.js';
import WithdrawalService from '../services/withdrawal.service.js';

/**
 * @typedef {Object} CronOptions
 * @property {string} [schedule]
 * @property {number} [hoursAgo]
 */

/**
 * @param {CronOptions} [options]
 */
const schedulePayoutReconciliation = (options = {}) => {
    const schedule = options.schedule || '0 * * * *'; // Every hour
    const hoursAgo = options.hoursAgo || 1;

    logger.info(`Scheduling payout reconciliation cron job with schedule: ${schedule}`);

    return cron.schedule(schedule, async () => {
        const startTime = Date.now();
        const jobId = `payout-cleanup-${startTime}`;

        logger.info(`[${jobId}] Starting payout reconciliation job`);

        try {
            await WithdrawalService.reconcileStuckWithdrawals(hoursAgo);
            const duration = (Date.now() - startTime) / 1000;
            logger.info(`[${jobId}] Payout reconciliation completed in ${duration.toFixed(2)}s`);
        } catch (err) {
            const error = /** @type {Error} */ (err);
            const duration = (Date.now() - startTime) / 1000;
            logger.error(`[${jobId}] Payout reconciliation job failed after ${duration.toFixed(2)}s`, {
                error: error.message,
                stack: error.stack
            });
        }
    }, {
        timezone: 'Africa/Nairobi'
    });
};

export { schedulePayoutReconciliation };
