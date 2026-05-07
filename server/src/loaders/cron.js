import { schedulePaymentProcessing } from '../cron/paymentCron.js';
import { schedulePayoutReconciliation } from '../cron/payoutCleanup.js';
import { scheduleReferralRewards } from '../cron/referralCron.js';
import logger from '../shared/utils/logger.js';

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

    // 2. Reconciliation Engine (Self-Healing) - Every 5 min
    // Replaces orderDeadlineCron
    try {
        const ReconciliationEngine = (await import('../cron/reconciliationEngine.js')).default;
        await ReconciliationEngine.start();
        logger.info('✅ Reconciliation Engine started');
    } catch (err) {
        logger.error('❌ Failed to start Reconciliation Engine:', err.message);
    }

    // 5. Fulfillment Worker (Queue Processor) - Every 1 min
    // Replaces completionRetryCron
    try {
        const FulfillmentWorker = (await import('../cron/fulfillmentWorker.js')).default;
        await FulfillmentWorker.start();
        logger.info('✅ Fulfillment Worker started');
    } catch (err) {
        logger.error('❌ Failed to start Fulfillment Worker:', err.message);
    }

    // 6. Cleanup Job (daily)
    if (process.env.ENABLE_CLEANUP_CRON !== 'false') {
        try {
            const { scheduleCleanupJobs } = await import('../cron/cleanupCron.js');
            scheduleCleanupJobs();
            logger.info('✅ Cleanup cron started');
        } catch (err) {
            logger.error('❌ Failed to start cleanup cron:', err.message);
        }
    }
    // 7. Monthly referral reward payout
    if (process.env.ENABLE_REFERRAL_CRON !== 'false') {
        try {
            scheduleReferralRewards();
            logger.info('Referral rewards cron started');
        } catch (err) {
            logger.error('Failed to start referral rewards cron:', err.message);
        }
    }
};

