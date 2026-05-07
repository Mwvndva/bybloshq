/**
 * paymentCron.js
 *
 * This cron originally called PaymentService.processPendingPayments which could race
 * with CorePaymentService.handlePaydWebhook for the same payment row.
 *
 * P0-4 FIX: The cron now ONLY calls legacy PaymentService.processPendingPayments which
 * already uses the legacy handlePaydCallback. The critical safety guard is that
 * handlePaydCallback has an idempotency check (status === 'completed' → skip).
 * We add FOR UPDATE SKIP LOCKED at the DB level (inside processPendingPayments) to
 * prevent simultaneous processing from the webhook path.
 *
 * P1-1 FIX: The completionRetryCron is kept here as a second cron that uses the
 * unified key 'needs_fulfillment' (not the old 'needs_completion') to retry
 * any orders where fulfillment failed post-payment.
 */

// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../shared/utils/logger.js';
import PaymentService from '../services/payment.service.js';
import { pool } from '../shared/db/database.js';
import OrderService from '../services/order.service.js';

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

/**
 * P1-1 FIX: Unified fulfillment-retry cron.
 * Replaces the old completionRetryCron.js `needs_completion` key with `needs_fulfillment`.
 * Both keys are checked for backward compatibility with the legacy path.
 *
 * @param {Object} [options]
 * @param {string} [options.schedule]
 */
const scheduleFulfillmentRetry = (options = {}) => {
  const schedule = options.schedule || '*/2 * * * *';

  return cron.schedule(schedule, async () => {
    const jobId = `fulfillment-retry-${Date.now()}`;
    try {
      // P1-1: Check BOTH keys for backward compat during the transition period
      const { rows } = await pool.query(
        `SELECT * FROM payments
         WHERE status = 'completed'
           AND (
             metadata->>'needs_fulfillment' = 'true'
             OR metadata->>'needs_completion' = 'true'
           )
           AND updated_at > NOW() - INTERVAL '24 hours'
         ORDER BY updated_at ASC
         LIMIT 20`
      );

      if (rows.length === 0) return;
      logger.info(`[${jobId}] Found ${rows.length} payment(s) needing fulfillment retry`);

      for (const payment of rows) {
        try {
          await OrderService.completeOrder(payment);

          // P1-1: Clear BOTH keys on success
          await pool.query(
            `UPDATE payments
             SET metadata = metadata - 'needs_fulfillment' - 'needs_completion'
             WHERE id = $1`,
            [payment.id]
          );
          logger.info(`[${jobId}] Successfully retried fulfillment for payment ${payment.id}`);
        } catch (err) {
          const e = /** @type {Error} */ (err);
          logger.error(`[${jobId}] Retry failed for payment ${payment.id}:`, e.message);
        }
      }
    } catch (err) {
      const e = /** @type {Error} */ (err);
      logger.error(`[${jobId}] Cron query error:`, e.message);
    }
  }, { timezone: 'Africa/Nairobi' });
};

export { schedulePaymentProcessing, scheduleFulfillmentRetry };



