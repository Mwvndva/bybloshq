import cron from 'node-cron';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import OrderService from '../services/order.service.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';

/**
 * FulfillmentWorker: Background process to consume the fulfillment queue.
 * Runs every minute to process pending or failed jobs.
 */
class FulfillmentWorker {
    static async start() {
        // Run every minute
        cron.schedule('* * * * *', async () => {
            logger.info('🔄 [WORKER] Starting fulfillment queue processing run...');
            try {
                await this.processQueue();
            } catch (err) {
                logger.error('❌ [WORKER] Fulfillment processing run failed:', err);
            }
        });

        logger.info('🚀 [WORKER] Fulfillment Worker initialized (1-minute schedule).');
    }

    static async processQueue() {
        // Fetch pending or failed jobs that haven't exceeded max attempts
        const query = `
            SELECT fj.*, po.status as order_current_status, po.order_type
            FROM fulfillment_jobs fj
            JOIN product_orders po ON fj.order_id = po.id
            WHERE fj.status IN ('PENDING', 'FAILED')
              AND fj.attempts < fj.max_attempts
            ORDER BY fj.created_at ASC
            LIMIT 10
        `;

        const { rows: jobs } = await pool.query(query);

        if (jobs.length === 0) {
            logger.debug('[WORKER] No pending fulfillment jobs.');
            return;
        }

        for (const job of jobs) {
            await this.executeJob(job);
        }
    }

    static async executeJob(job) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Mark as processing
            await client.query(
                `UPDATE fulfillment_jobs 
                 SET status = 'PROCESSING', attempts = attempts + 1, last_attempt_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [job.id]
            );

            // 2. Load the order (fresh lock)
            const { rows: orders } = await client.query(
                'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
                [job.order_id]
            );

            if (orders.length === 0) {
                throw new Error(`Order ${job.order_id} not found`);
            }
            const order = orders[0];

            // 3. Execute OrderService Fulfillment
            await OrderService.executeFulfillment(client, order);

            // 4. Mark job as completed
            await client.query(
                `UPDATE fulfillment_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
                [job.id]
            );

            await client.query('COMMIT');
            logger.info(`✅ [WORKER] Job ${job.id} (Order ${job.order_id}) completed successfully.`);

        } catch (err) {
            await client.query('ROLLBACK');
            logger.error(`❌ [WORKER] Job ${job.id} (Order ${job.order_id}) failed:`, err.message);

            // Mark as failed for retry
            await pool.query(
                `UPDATE fulfillment_jobs 
                 SET status = 'FAILED', error_message = $1, updated_at = NOW()
                 WHERE id = $2`,
                [err.message, job.id]
            );
        } finally {
            client.release();
        }
    }
}

export default FulfillmentWorker;
