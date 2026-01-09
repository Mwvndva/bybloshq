// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../utils/logger.js';
import OrderDeadlineService from '../services/orderDeadline.service.js';

/**
 * @typedef {Object} CronOptions
 * @property {string} [schedule] - Cron schedule pattern
 */

/**
 * @param {CronOptions} [options]
 */
const scheduleOrderDeadlineChecks = (options = {}) => {
    // Run every 30 minutes
    const schedule = options.schedule || '*/30 * * * *';

    logger.info(`Scheduling order deadline checks with schedule: ${schedule}`);

    return cron.schedule(schedule, async () => {
        const startTime = Date.now();
        const jobId = `order-deadline-${startTime}`;

        logger.info(`[${jobId}] Starting order deadline checks`);

        try {
            const results = await OrderDeadlineService.runAllChecks();
            const duration = (Date.now() - startTime) / 1000;

            const totalProcessed =
                results.sellerDeadlines.processedCount +
                results.buyerDeadlines.processedCount +
                results.servicePayments.processedCount;

            if (totalProcessed > 0) {
                logger.info(`[${jobId}] Order deadline checks completed in ${duration.toFixed(2)}s`, {
                    sellerCancellations: results.sellerDeadlines.processedCount,
                    buyerCancellations: results.buyerDeadlines.processedCount,
                    servicePaymentReleases: results.servicePayments.processedCount,
                    duration: `${duration.toFixed(2)}s`
                });
            }

            return results;
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[${jobId}] Order deadline checks failed after ${duration.toFixed(2)}s`, {
                error: err.message,
                stack: err.stack,
                duration: `${duration.toFixed(2)}s`
            });
            throw error;
        }
    }, {
        timezone: 'Africa/Nairobi'
    });
};

export { scheduleOrderDeadlineChecks };
