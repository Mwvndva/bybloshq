import cron from 'node-cron';
import orderDeadlineService from '../services/orderDeadline.service.js';
import logger from '../shared/utils/logger.js';

function scheduleOrderDeadlineChecks(options = {}) {
    const schedule = options.schedule || process.env.ORDER_DEADLINE_CRON || '*/15 * * * *';

    logger.info(`[OrderDeadlineCron] Scheduling order deadline checks: ${schedule}`);
    return cron.schedule(schedule, async () => {
        try {
            await orderDeadlineService.runAllChecks();
        } catch (error) {
            logger.error('[OrderDeadlineCron] Scheduled order deadline check failed:', error.message);
        }
    }, { timezone: 'Africa/Nairobi' });
}

export { scheduleOrderDeadlineChecks };
