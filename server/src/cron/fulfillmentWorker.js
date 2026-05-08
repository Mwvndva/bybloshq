import cron from 'node-cron';
import logger from '../shared/utils/logger.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';

/**
 * FulfillmentWorker: background process to consume the fulfillment queue.
 * The queue service owns row claiming so all worker instances use one locking path.
 */
class FulfillmentWorker {
    static async start() {
        cron.schedule('* * * * *', async () => {
            logger.info('[WORKER] Starting fulfillment queue processing run...');
            try {
                await this.processQueue();
            } catch (err) {
                logger.error('[WORKER] Fulfillment processing run failed:', err);
            }
        });

        logger.info('[WORKER] Fulfillment Worker initialized (1-minute schedule).');
    }

    static async processQueue() {
        const batchSize = Number.parseInt(process.env.FULFILLMENT_WORKER_BATCH_SIZE || '25', 10);
        await FulfillmentQueueService.processJobs(batchSize);
    }
}

export default FulfillmentWorker;
