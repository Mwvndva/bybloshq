// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../utils/logger.js';
import PaymentService from '../services/payment.service.js';

/**
 * @typedef {Object} CronOptions
 * @property {string} [schedule]
 * @property {number} [hoursAgo]
 * @property {number} [limit]
 */

/**
 * @param {CronOptions} [options]
 */
const schedulePaymentProcessing = (options = {}) => {
  const schedule = options.schedule || '*/5 * * * *';
  const hoursAgo = options.hoursAgo || 24;
  const limit = options.limit || 50;

  logger.info(`Scheduling payment processing cron job with schedule: ${schedule}`);

  return cron.schedule(schedule, async () => {
    const startTime = Date.now();
    const jobId = `payment-process-${startTime}`;

    logger.info(`[${jobId}] Starting payment processing job`);

    try {
      const result = await PaymentService.processPendingPayments(hoursAgo, limit);
      const duration = (Date.now() - startTime) / 1000;

      if (result.processedCount > 0) {
        logger.info(`[${jobId}] Payment processing completed in ${duration.toFixed(2)}s`, {
          processed: result.processedCount,
          successful: result.successCount,
          failed: result.errorCount,
          duration: `${duration.toFixed(2)}s`
        });
      }

      return result;
    } catch (err) {
      const error = /** @type {Error} */ (err);
      const duration = (Date.now() - startTime) / 1000;
      logger.error(`[${jobId}] Payment processing job failed after ${duration.toFixed(2)}s`, {
        error: error.message,
        stack: error.stack,
        duration: `${duration.toFixed(2)}s`
      });
      throw error;
    }
  }, {
    timezone: 'Africa/Nairobi'
  });
};

export { schedulePaymentProcessing };
