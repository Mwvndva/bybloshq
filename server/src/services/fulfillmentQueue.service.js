import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

class FulfillmentQueueService {
    /**
     * Enqueue a new fulfillment job after payment success.
     */
    static async enqueue(client, orderId) {
        const query = `
            INSERT INTO fulfillment_jobs (order_id, status)
            VALUES ($1, 'PENDING')
            ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', attempts = 0
            RETURNING *
        `;
        const executor = client || pool;
        const { rows } = await executor.query(query, [orderId]);
        logger.info(`[QUEUE] Enqueued fulfillment job for order ${orderId}`);
        return rows[0];
    }

    /**
     * Pick and process the next batch of jobs.
     * Designed to be called by a cron or loop.
     */
    static async processJobs(limit = 5) {
        // Find candidate jobs. The actual claim happens inside processJob's transaction.
        const findQuery = `
            SELECT * FROM fulfillment_jobs
            WHERE (
                status = 'PENDING'
                OR status = 'FAILED'
                OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes')
              )
              AND attempts < max_attempts
              AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '1 minute' * POWER(2, attempts))
            LIMIT $1
        `;

        const { rows: jobs } = await pool.query(findQuery, [limit]);
        if (jobs.length === 0) return;

        logger.info(`[QUEUE] Found ${jobs.length} jobs to process`);

        for (const job of jobs) {
            await this.processJob(job);
        }
    }

    static async processJob(job) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Claim the job under lock before processing.
            const { rows: claimedJobs } = await client.query(
                `SELECT *
                 FROM fulfillment_jobs
                 WHERE id = $1
                   AND (
                     status IN ('PENDING', 'FAILED')
                     OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes')
                   )
                   AND attempts < max_attempts
                 FOR UPDATE SKIP LOCKED`,
                [job.id]
            );

            if (claimedJobs.length === 0) {
                await client.query('ROLLBACK');
                logger.info(`[QUEUE] Job ${job.id} was already claimed or is no longer eligible.`);
                return;
            }
            job = claimedJobs[0];

            // 2. Mark as processing
            await client.query(
                `UPDATE fulfillment_jobs SET status = 'PROCESSING', last_attempt_at = NOW(), attempts = attempts + 1 WHERE id = $1`,
                [job.id]
            );

            // 3. Fetch Order details
            const { rows: orders } = await client.query(
                `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                [job.order_id]
            );

            if (orders.length === 0) {
                throw new Error(`Order ${job.order_id} not found`);
            }

            const order = orders[0];

            // 4. Delegate to order completion logic based on type
            // (Circular dependency alert: use dynamic import or move logic to a shared helper)
            const { default: OrderService } = await import('./order.service.js');

            logger.info(`[QUEUE] Processing fulfillment for Order ${order.id} (Type: ${order.order_type})`);

            // This call should be updated to strictly follow the new transitions
            await OrderService.executeFulfillment(client, order);

            // 5. Mark job as completed
            await client.query(
                `UPDATE fulfillment_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
                [job.id]
            );

            await client.query('COMMIT');
            logger.info(`[QUEUE] Job ${job.id} (Order ${order.id}) COMPLETED`);

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
            if (job.attempts + 1 >= job.max_attempts) {
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
