import eventBus, { AppEvents } from './eventBus.js';
import logger from '../shared/utils/logger.js';

/**
 * Handle PAYMENT.COMPLETED event
 * Side effects that must NOT block the core payment transaction.
 */
eventBus.on(AppEvents.PAYMENT.COMPLETED, async ({ payment, order }) => {
    try {
        logger.info(`[Event:PaymentCompleted] Payment ${payment.id} for Order ${order?.id}`);
        // Further side effects (analytics, email receipts) go here.
    } catch (err) {
        logger.error(`[Event:PaymentCompleted] Listener failed: ${err.message}`);
    }
});

/**
 * Handle PAYMENT.FAILED event
 */
eventBus.on(AppEvents.PAYMENT.FAILED, async ({ payment, reason }) => {
    try {
        logger.warn(`[Event:PaymentFailed] Payment ${payment.id} failed: ${reason}`);
    } catch (err) {
        logger.error(`[Event:PaymentFailed] Listener failed: ${err.message}`);
    }
});

/**
 * Handle WITHDRAWAL.INITIATED event
 */
eventBus.on(AppEvents.WITHDRAWAL.INITIATED, async ({ withdrawal }) => {
    try {
        logger.info(`[Event:WithdrawalInitiated] Withdrawal ${withdrawal.id} initiated`);
    } catch (err) {
        logger.error(`[Event:WithdrawalInitiated] Listener failed: ${err.message}`);
    }
});

/**
 * Handle WITHDRAWAL.COMPLETED event
 */
eventBus.on(AppEvents.WITHDRAWAL.COMPLETED, async ({ withdrawal }) => {
    try {
        logger.info(`[Event:WithdrawalCompleted] Withdrawal ${withdrawal.id} completed`);
    } catch (err) {
        logger.error(`[Event:WithdrawalCompleted] Listener failed: ${err.message}`);
    }
});

/**
 * Handle WITHDRAWAL.FAILED event
 */
eventBus.on(AppEvents.WITHDRAWAL.FAILED, async ({ withdrawal, reason }) => {
    try {
        logger.warn(`[Event:WithdrawalFailed] Withdrawal ${withdrawal.id} failed: ${reason}`);
    } catch (err) {
        logger.error(`[Event:WithdrawalFailed] Listener failed: ${err.message}`);
    }
});

export default eventBus;
