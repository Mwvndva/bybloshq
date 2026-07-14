import cron from 'node-cron';
import WithdrawalService from '../services/withdrawal.service.js';
import eventBus from '../events/eventBus.js';
import logger from '../shared/utils/logger.js';

export default async () => {
    WithdrawalService.retryPendingApiCalls().catch(err => {
        logger.error('Withdrawal startup retry failed:', err.message);
    });

    if (process.env.ENABLE_WITHDRAWAL_RETRY_CRON !== 'false') {
        cron.schedule('*/5 * * * *', async () => {
            try {
                await WithdrawalService.retryPendingApiCalls();
            } catch (err) {
                logger.error('Withdrawal scheduled retry failed:', err.message);
            }
        });
        logger.info('Withdrawal retry worker scheduled (5-minute cadence).');
    }

    if (process.env.ENABLE_EVENT_OUTBOX_REPLAY !== 'false') {
        cron.schedule('* * * * *', async () => {
            try {
                await eventBus.replayPendingOutbox(Number.parseInt(process.env.EVENT_OUTBOX_REPLAY_LIMIT || '50', 10));
            } catch (err) {
                logger.error('Event outbox replay failed:', err.message);
            }
        });
        logger.info('Event outbox replay worker scheduled (1-minute cadence).');
    }
};
