import logger from '../../utils/logger.js';

/**
 * JobQueue - Infrastructure abstraction for background processing.
 * Currently uses node-cron for scheduling but designed to be replaced by BullMQ.
 */
export class JobQueue {
    constructor(name) {
        this.name = name;
        this.handlers = new Map();
    }

    /**
     * Register a handler for a job type
     */
    process(jobName, handler) {
        this.handlers.set(jobName, handler);
        logger.info(`[Queue: ${this.name}] Registered handler for job: ${jobName}`);
    }

    /**
     * Add a job to the queue
     */
    async add(jobName, data, opts = {}) {
        logger.info(`[Queue: ${this.name}] Adding job ${jobName}`, { data, opts });

        // In a real BullMQ implementation, this would push to Redis.
        // For now, if it's immediate, we execute it.
        if (!opts.repeat) {
            this._execute(jobName, data);
        }
    }

    async _execute(jobName, data) {
        const handler = this.handlers.get(jobName);
        if (!handler) {
            logger.error(`[Queue: ${this.name}] No handler for job ${jobName}`);
            return;
        }

        try {
            await handler({ data });
        } catch (err) {
            logger.error(`[Queue: ${this.name}] Job ${jobName} failed:`, err.message);
        }
    }
}

export const defaultQueue = new JobQueue('default');
