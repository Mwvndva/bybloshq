import eventBus, { AppEvents } from './eventBus.js';
import logger from '../shared/utils/logger.js';
import whatsappService from '../services/whatsapp.service.js';
import LogisticsRequestService from '../services/logisticsRequest.service.js';
import PaymentReceiptService from '../services/paymentReceipt.service.js';

/**
 * Handle PAYMENT.COMPLETED event
 * Side effects that must NOT block the core payment transaction.
 */
eventBus.on(AppEvents.PAYMENT.COMPLETED, async ({ eventId, payment, order }) => {
    logger.info(`[Event:PaymentCompleted] Payment ${payment.id} for Order ${order?.id}`);
    const deliveryResult = await LogisticsRequestService.activateDoorDeliveryAfterPayment({
        payment,
        order,
        eventId: eventId || `payment.completed:${payment.id}`
    });

    if (deliveryResult.activated) {
        logger.info('[Event:PaymentCompleted] Door delivery activated', {
            paymentId: payment.id,
            orderId: order?.id,
            requestId: deliveryResult.requestId,
            deliveryLegId: deliveryResult.deliveryLegId
        });
    }

    const pickupResult = await LogisticsRequestService.activateSellerPickupAfterPayment({
        payment,
        order,
        eventId: eventId || `payment.completed:${payment.id}`
    });

    if (pickupResult.activated) {
        logger.info('[Event:PaymentCompleted] Seller pickup activated', {
            paymentId: payment.id,
            orderId: order?.id,
            requestId: pickupResult.requestId,
            pickupLegId: pickupResult.pickupLegId
        });
    }

    await PaymentReceiptService.sendBuyerEmailsAfterPayment({
        eventBus,
        eventId: eventId || `payment.completed:${payment.id}`,
        payment,
        order
    });

    await PaymentReceiptService.sendSellerPickupReceiptAfterPayment({
        eventBus,
        eventId: eventId || `payment.completed:${payment.id}`,
        payment,
        order
    });
});

/**
 * Handle PAYMENT.FAILED event
 */
eventBus.on(AppEvents.PAYMENT.FAILED, async ({ payment, order, reason }) => {
    logger.warn(`[Event:PaymentFailed] Payment ${payment.id} failed: ${reason}`);
    const result = await LogisticsRequestService.cancelPaymentPendingLegsAfterPaymentFailure({
        payment,
        order,
        reason
    });
    if (result.cancelled > 0) {
        logger.warn('[Event:PaymentFailed] Cancelled pending logistics legs for failed payment', {
            paymentId: payment.id,
            orderId: order?.id,
            cancelled: result.cancelled
        });
    }
});

/**
 * Handle WITHDRAWAL.INITIATED event
 */
eventBus.on(AppEvents.WITHDRAWAL.INITIATED, async ({ withdrawal }) => {
    logger.info(`[Event:WithdrawalInitiated] Withdrawal ${withdrawal.id} initiated`);
});

eventBus.on(AppEvents.WITHDRAWAL.CREATED, async ({ eventId, withdrawal, seller }) => {
    logger.info(`[Event:WithdrawalCreated] Withdrawal ${withdrawal.id} created`);
    if (seller?.whatsapp_number) {
        await eventBus.deliverRecipient(eventId, `withdrawal:${withdrawal.id}:seller:created`, () => whatsappService.notifySellerWithdrawalUpdate(seller.whatsapp_number, {
            amount: withdrawal.amount,
            status: withdrawal.status || 'processing',
            reference: withdrawal.provider_reference || `REQ-${withdrawal.id}`,
            reason: null,
            newBalance: null,
            mpesaNumber: withdrawal.mpesa_number,
            request_id: withdrawal.id
        }));
    }
});

eventBus.on(AppEvents.WITHDRAWAL.UPDATED, async ({ eventId, withdrawal, seller, reason, newBalance }) => {
    logger.info(`[Event:WithdrawalUpdated] Withdrawal ${withdrawal.id} updated to ${withdrawal.status}`);
    if (seller?.whatsapp_number) {
        await eventBus.deliverRecipient(eventId, `withdrawal:${withdrawal.id}:seller:${withdrawal.status}`, () => whatsappService.notifySellerWithdrawalUpdate(seller.whatsapp_number, {
            amount: withdrawal.amount,
            status: withdrawal.status,
            reference: withdrawal.mpesa_receipt || withdrawal.provider_reference || `REQ-${withdrawal.id}`,
            reason,
            newBalance,
            mpesaNumber: withdrawal.mpesa_number,
            request_id: withdrawal.id
        }));
    }
});

/**
 * Handle WITHDRAWAL.COMPLETED event
 */
eventBus.on(AppEvents.WITHDRAWAL.COMPLETED, async ({ withdrawal }) => {
    logger.info(`[Event:WithdrawalCompleted] Withdrawal ${withdrawal.id} completed`);
});

/**
 * Handle WITHDRAWAL.FAILED event
 */
eventBus.on(AppEvents.WITHDRAWAL.FAILED, async ({ withdrawal, reason }) => {
    logger.warn(`[Event:WithdrawalFailed] Withdrawal ${withdrawal.id} failed: ${reason}`);
});

eventBus.on(AppEvents.WITHDRAWAL.COMPENSATION_REQUIRED, async ({ withdrawal, reconciliationEvent, reason }) => {
    logger.error('[Event:WithdrawalCompensationRequired] Finance reconciliation required', {
        withdrawalId: withdrawal?.id,
        sellerId: withdrawal?.seller_id,
        reconciliationEventId: reconciliationEvent?.id,
        reason
    });
});

eventBus.on(AppEvents.REFUND.APPROVED, async ({ eventId, refund, buyer }) => {
    logger.info(`[Event:RefundApproved] Refund ${refund.id} approved`);
    if (buyer?.whatsapp_number) {
        await eventBus.deliverRecipient(eventId, `refund:${refund.id}:buyer:approved`, () => whatsappService.sendRefundApprovedNotification(buyer, Number(refund.amount || 0)));
    }
});

eventBus.on(AppEvents.REFUND.REJECTED, async ({ eventId, refund, buyer }) => {
    logger.info(`[Event:RefundRejected] Refund ${refund.id} rejected`);
    if (buyer?.whatsapp_number) {
        await eventBus.deliverRecipient(eventId, `refund:${refund.id}:buyer:rejected`, () => whatsappService.sendRefundRejectedNotification(buyer, Number(refund.amount || 0), refund.adminNotes));
    }
});

eventBus.on(AppEvents.REFERRAL.REWARD_CREATED, async ({ eventId, seller, reward }) => {
    logger.info(`[Event:ReferralRewardCreated] Seller ${seller?.id} reward ${reward?.amount}`);
    if (seller?.whatsapp_number) {
        const amount = Number(reward.amount || 0);
        const message = `Byblos: You earned KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${reward.referredShopName}'s sales this month. Keep building your squad!`;
        await eventBus.deliverRecipient(eventId, `referral:${reward.id || reward.referredSellerId || amount}:seller:${seller.id}`, () => whatsappService.sendMessage(seller.whatsapp_number, message));
    }
});

export default eventBus;
