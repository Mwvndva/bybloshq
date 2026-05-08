import crypto from 'crypto';
import cron from 'node-cron';
import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';

/**
 * Deprecated shadow cron.
 *
 * This module is not booted by the active loader. Runtime fulfillment repair is
 * handled by paymentCron.scheduleFulfillmentRetry() and FulfillmentWorker, both
 * of which enqueue through FulfillmentQueueService.
 */
export const scheduleCompletionRetry = (options = {}) => {
    const schedule = options.schedule || '*/2 * * * *';

    // Stagger startup by 0-60 seconds to prevent thundering herd on multi-instance
    // Using crypto.randomInt for secure randomness (SonarQube compliance)
    const jitterMs = crypto.randomInt(0, 60000);

    setTimeout(() => {
        logger.info(`[COMPLETION-RETRY] Scheduling completion retry cron (${jitterMs}ms jitter applied): ${schedule}`);

        cron.schedule(schedule, async () => {
            const jobId = `completion-retry-${Date.now()}`;
            try {
                const { rows } = await pool.query(
                    `SELECT * FROM payments
                     WHERE status = 'completed'
                     AND metadata->>'needs_completion' = 'true'
                     AND updated_at > NOW() - INTERVAL '24 hours'
                     ORDER BY updated_at ASC
                     LIMIT 20`
                );

                if (rows.length === 0) return;

                logger.info(`[${jobId}] Found ${rows.length} payment(s) needing completion retry`);

                for (const payment of rows) {
                    try {
                        const orderId = payment.order_id
                            || payment.product_order_id
                            || payment.metadata?.order_id
                            || payment.metadata?.product_order_id;

                        if (!orderId) {
                            throw new Error(`Payment ${payment.id} is missing order id for fulfillment retry`);
                        }

                        await FulfillmentQueueService.enqueue(null, orderId);

                        // Clear the flag on success
                        await pool.query(
                            `UPDATE payments
                             SET metadata = metadata - 'needs_completion'
                             WHERE id = $1`,
                            [payment.id]
                        );
                        logger.info(`[${jobId}] Successfully completed payment ${payment.id}`);
                    } catch (err) {
                        logger.error(`[${jobId}] Retry failed for payment ${payment.id}:`, err.message);
                    }
                }
            } catch (err) {
                logger.error(`[${jobId}] Cron query error:`, err.message);
            }
        }, { timezone: 'Africa/Nairobi' });
    }, jitterMs);
};


