import { schedulePaymentProcessing } from '../cron/paymentCron.js';
import { schedulePayoutReconciliation } from '../cron/payoutCleanup.js';
import logger from '../utils/logger.js';

export default async () => {
    // 1. Payment Processing (every 5 min)
    if (process.env.ENABLE_PAYMENT_CRON !== 'false') {
        try {
            schedulePaymentProcessing({ schedule: '1-56/5 * * * *', hoursAgo: 24, limit: 50 });
            logger.info('✅ Payment processing cron started');
        } catch (err) {
            logger.error('❌ Failed to start payment cron:', err.message);
        }
    }

    // 2. Order Deadline (every 30 min)
    if (process.env.ENABLE_ORDER_DEADLINE_CRON !== 'false') {
        try {
            const { scheduleOrderDeadlineChecks } = await import('../cron/orderDeadlineCron.js');
            scheduleOrderDeadlineChecks({ schedule: '7,37 * * * *' });
            logger.info('✅ Order deadline cron started');
        } catch (err) {
            logger.error('❌ Failed to start order deadline cron:', err.message);
        }
    }

    // 3. Payout Reconciliation (every hour)
    if (process.env.ENABLE_PAYOUT_RECONCILIATION_CRON !== 'false') {
        try {
            schedulePayoutReconciliation({ schedule: '3 * * * *', hoursAgo: 1 });
            logger.info('✅ Payout reconciliation cron started');
        } catch (err) {
            logger.error('❌ Failed to start payout reconciliation cron:', err.message);
        }
    }

    // 4. Referral Rewards (monthly)
    if (process.env.ENABLE_REFERRAL_CRON !== 'false') {
        try {
            const { scheduleReferralRewards } = await import('../cron/referralCron.js');
            scheduleReferralRewards();
            logger.info('✅ Referral rewards cron started');
        } catch (err) {
            logger.error('❌ Failed to start referral cron:', err.message);
        }
    }

    // 5. Completion Retry (every 2 min)
    if (process.env.ENABLE_COMPLETION_RETRY_CRON !== 'false') {
        try {
            const { scheduleCompletionRetry } = await import('../cron/completionRetryCron.js');
            scheduleCompletionRetry();
            logger.info('✅ Completion retry cron started');
        } catch (err) {
            logger.error('❌ Failed to start completion retry cron:', err.message);
        }
    }
};
