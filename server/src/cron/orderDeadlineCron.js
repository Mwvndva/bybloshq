// @ts-check
'use strict';

import cron from 'node-cron';
import logger from '../shared/utils/logger.js';
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

    // P1-6 FIX: Use per-row FOR UPDATE SKIP LOCKED to prevent race with webhook handler.
    // A bare bulk UPDATE without a lock can overwrite a PAID status with FAILED
    // if the Payd callback arrives and commits concurrently.
    const checkExpiredPendingOrders = async () => {
        const { pool: dbPool } = await import('../shared/db/database.js');

        // Find candidates (no lock yet — just a quick scan)
        const { rows: candidates } = await dbPool.query(
            `SELECT id FROM product_orders
             WHERE status = 'PENDING'
               AND created_at < NOW() - INTERVAL '30 minutes'
             LIMIT 50`
        );

        if (candidates.length === 0) return;

        for (const candidate of candidates) {
            const client = await dbPool.connect();
            try {
                await client.query('BEGIN');

                // Lock the row; SKIP if another transaction holds it (e.g. webhook)
                const { rows: locked } = await client.query(
                    `SELECT id, status FROM product_orders
                     WHERE id = $1 AND status = 'PENDING'
                     FOR UPDATE SKIP LOCKED`,
                    [candidate.id]
                );

                if (locked.length === 0) {
                    // Row is locked by another transaction (likely the webhook) — safe to skip
                    await client.query('ROLLBACK');
                    continue;
                }

                await client.query(
                    `UPDATE product_orders
                     SET status = 'FAILED',
                         payment_status = 'failed',
                         metadata = COALESCE(metadata, '{}'::jsonb) || '{"reason": "Payd STK push expired or never completed"}'::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [candidate.id]
                );

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK').catch(() => { });
            } finally {
                client.release();
            }
        }
    };


    return cron.schedule(schedule, async () => {
        const startTime = Date.now();
        const jobId = `order-deadline-${startTime}`;

        logger.info(`[${jobId}] Starting order deadline checks`);

        try {
            await checkExpiredPendingOrders();
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


