import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

class FulfillmentQueueService {
    /**
     * Enqueue a new fulfillment job after payment success.
     */
    static async enqueue(client, orderId) {
        const query = `
            INSERT INTO fulfillment_jobs (order_id, status)
            VALUES ($1, 'PENDING')
            ON CONFLICT (order_id) DO UPDATE
            SET status = 'PENDING',
                attempts = CASE
                    WHEN fulfillment_jobs.status = 'FAILED' THEN 0
                    ELSE fulfillment_jobs.attempts
                END,
                error_message = NULL,
                updated_at = NOW()
            WHERE fulfillment_jobs.status IN ('PENDING', 'FAILED')
               OR (
                    fulfillment_jobs.status = 'PROCESSING'
                    AND fulfillment_jobs.updated_at < NOW() - INTERVAL '10 minutes'
                  )
            RETURNING *
        `;
        const executor = client || pool;
        const { rows } = await executor.query(query, [orderId]);
        if (rows.length > 0) {
            logger.info(`[QUEUE] Enqueued fulfillment job for order ${orderId}`);
            return rows[0];
        }

        const { rows: existingRows } = await executor.query(
            'SELECT * FROM fulfillment_jobs WHERE order_id = $1',
            [orderId]
        );
        logger.info(`[QUEUE] Fulfillment job for order ${orderId} already terminal or actively processing.`);
        return existingRows[0];
    }

    /**
     * Pick and process the next batch of jobs.
     * Designed to be called by a cron or loop.
     */
    static async processJobs(limit = 5) {
        const claimQuery = `
            WITH claimed AS (
                SELECT id
                FROM fulfillment_jobs
                WHERE (
                    status IN ('PENDING', 'FAILED')
                    OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes')
                  )
                  AND attempts < max_attempts
                  AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '1 minute' * POWER(2, attempts))
                ORDER BY created_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE fulfillment_jobs fj
            SET status = 'PROCESSING',
                last_attempt_at = NOW(),
                attempts = attempts + 1,
                updated_at = NOW()
            FROM claimed
            WHERE fj.id = claimed.id
            RETURNING fj.*
        `;

        const { rows: jobs } = await pool.query(claimQuery, [limit]);
        if (jobs.length === 0) return;

        logger.info(`[QUEUE] Found ${jobs.length} jobs to process`);

        const concurrency = Math.max(1, Number.parseInt(process.env.FULFILLMENT_WORKER_CONCURRENCY || '5', 10));
        for (let i = 0; i < jobs.length; i += concurrency) {
            const batch = jobs.slice(i, i + concurrency);
            const results = await Promise.allSettled(batch.map(job => this.processJob(job)));
            for (const result of results) {
                if (result.status === 'rejected') {
                    logger.error('[QUEUE] Fulfillment job processing promise rejected:', result.reason);
                }
            }
        }
    }

    static async processJob(job) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Verify this claimed job is still processing under a row lock.
            const { rows: claimedJobs } = await client.query(
                `SELECT *
                 FROM fulfillment_jobs
                 WHERE id = $1
                   AND status = 'PROCESSING'
                 FOR UPDATE`,
                [job.id]
            );

            if (claimedJobs.length === 0) {
                await client.query('ROLLBACK');
                logger.info(`[QUEUE] Job ${job.id} was already claimed or is no longer eligible.`);
                return;
            }
            job = claimedJobs[0];

            // 3. Fetch Order details
            const { rows: orders } = await client.query(
                `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                [job.order_id]
            );

            if (orders.length === 0) {
                throw new Error(`Order ${job.order_id} not found`);
            }

            let order = orders[0];
            let fulfilledItems = [];

            // 4. Delegate to order completion logic based on type
            // (Circular dependency alert: use dynamic import or move logic to a shared helper)
            const { default: OrderService } = await import('./order.service.js');

            logger.info(`[QUEUE] Processing fulfillment for Order ${order.id} (Type: ${order.order_type})`);

            // This call should be updated to strictly follow the new transitions
            await OrderService.executeFulfillment(client, order);
            const { rows: [updatedOrder] } = await client.query(
                'SELECT * FROM product_orders WHERE id = $1',
                [order.id]
            );
            order = updatedOrder || order;

            const { rows: items } = await client.query(
                `SELECT oi.*, p.product_type::text as product_type, p.is_digital
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = $1`,
                [order.id]
            );
            fulfilledItems = items;

            // 5. Mark job as completed
            await client.query(
                `UPDATE fulfillment_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
                [job.id]
            );

            const durableEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.FULFILLED, {
                eventId: `order.fulfilled:${order.id}`,
                order,
                items: fulfilledItems
            });

            await client.query('COMMIT');
            logger.info(`[QUEUE] Job ${job.id} (Order ${order.id}) COMPLETED`);

            setImmediate(() => {
                eventBus.dispatchOutboxEvent(durableEvent.eventId)
                    .catch(error => logger.error('[QUEUE] Durable fulfillment event dispatch failed', {
                        eventId: durableEvent.eventId,
                        error: error.message
                    }));
            });

        } catch (err) {
            await client.query('ROLLBACK');
            logger.error(`[QUEUE] Job ${job.id} FAILED:`, err.message);

            // Update job status to FAILED
            await pool.query(
                `UPDATE fulfillment_jobs 
                 SET status = 'FAILED', 
                     error_message = $1, 
                     updated_at = NOW() 
                 WHERE id = $2`,
                [err.message, job.id]
            );

            // If max attempts reached, log a system issue
            if (job.attempts >= job.max_attempts) {
                await this.logSystemIssue(job.order_id, 'FULFILLMENT_FAILURE', 'HIGH', {
                    error: err.message,
                    job_id: job.id
                });
            }
        } finally {
            client.release();
        }
    }

    static async logSystemIssue(orderId, type, severity, details) {
        const query = `
            INSERT INTO system_issues (order_id, issue_type, severity, details)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(query, [orderId, type, severity, JSON.stringify(details)]);
        logger.error(`[SYSTEM-ISSUE] ${type} for Order ${orderId}: ${details.error}`);
    }
}

export default FulfillmentQueueService;
