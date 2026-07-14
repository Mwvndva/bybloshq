import eventBus, { AppEvents } from './eventBus.js';
import logger from '../shared/utils/logger.js';
import LogisticsRequestService from '../services/logisticsRequest.service.js';
import PaymentReceiptService from '../services/paymentReceipt.service.js';
import notificationService from '../services/notification.service.js';
import { pool } from '../shared/db/database.js';

// --- In-app feed helpers (additive, best-effort; never throw, skip accountless) ---
async function buyerUserIdById(buyerId) {
    if (!buyerId) return null;
    try { const { rows } = await pool.query('SELECT user_id FROM buyers WHERE id = $1 LIMIT 1', [Number(buyerId)]); return rows[0]?.user_id || null; }
    catch (error) { logger.warn('[Feed] buyer userId lookup failed', { buyerId, error: error.message }); return null; }
}
async function sellerUserIdById(sellerId) {
    if (!sellerId) return null;
    try { const { rows } = await pool.query('SELECT user_id FROM sellers WHERE id = $1 LIMIT 1', [Number(sellerId)]); return rows[0]?.user_id || null; }
    catch (error) { logger.warn('[Feed] seller userId lookup failed', { sellerId, error: error.message }); return null; }
}
function feedSend(recipientUserId, recipientRole, notif) {
    if (!recipientUserId) return Promise.resolve();
    return notificationService.send({
        recipientUserId, recipientRole,
        type: notif.type, title: notif.title, body: notif.body,
        data: notif.data || {}, channels: ['in_app', 'push']
    }).catch(error => logger.warn('[Feed] in-app notification write failed', { type: notif.type, error: error.message }));
}

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

    const physicalOnlineRequestResult = await LogisticsRequestService.ensurePhysicalOnlineRequestAfterPayment({
        payment,
        order,
        eventId: eventId || `payment.completed:${payment.id}`
    });

    if (physicalOnlineRequestResult.ensured) {
        logger.info('[Event:PaymentCompleted] Physical online logistics request ensured', {
            paymentId: payment.id,
            orderId: order?.id,
            requestId: physicalOnlineRequestResult.requestId,
            status: physicalOnlineRequestResult.status
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
    const sellerUserId = await sellerUserIdById(seller?.id);
    if (sellerUserId) {
        const amount = Number(withdrawal.amount || 0).toLocaleString('en-KE');
        await eventBus.deliverRecipient(eventId, `withdrawal:${withdrawal.id}:seller:created:feed`, () => feedSend(sellerUserId, 'seller', {
            type: 'withdrawal_created',
            title: 'Withdrawal processing',
            body: `Your withdrawal of KES ${amount} is being processed.`,
            data: { path: '/seller', withdrawalId: withdrawal.id }
        }));
    }
});

eventBus.on(AppEvents.WITHDRAWAL.UPDATED, async ({ eventId, withdrawal, seller, reason, newBalance }) => {
    logger.info(`[Event:WithdrawalUpdated] Withdrawal ${withdrawal.id} updated to ${withdrawal.status}`);
    const sellerUserId = await sellerUserIdById(seller?.id);
    if (sellerUserId) {
        const amount = Number(withdrawal.amount || 0).toLocaleString('en-KE');
        const status = String(withdrawal.status || 'updated');
        const body = status.toLowerCase() === 'completed'
            ? `Your withdrawal of KES ${amount} has been paid out${newBalance != null ? `. New balance: KES ${Number(newBalance).toLocaleString('en-KE')}` : ''}.`
            : (reason ? `Withdrawal ${status}: ${reason}` : `Your withdrawal of KES ${amount} is now ${status}.`);
        await eventBus.deliverRecipient(eventId, `withdrawal:${withdrawal.id}:seller:${withdrawal.status}:feed`, () => feedSend(sellerUserId, 'seller', {
            type: 'withdrawal_updated',
            title: 'Withdrawal update',
            body,
            data: { path: '/seller', withdrawalId: withdrawal.id }
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
    const buyerUserId = await buyerUserIdById(buyer?.id || refund?.buyer_id);
    if (buyerUserId) {
        await eventBus.deliverRecipient(eventId, `refund:${refund.id}:buyer:approved:feed`, () => feedSend(buyerUserId, 'buyer', { type: 'refund_approved', title: 'Refund approved', body: `KES ${Number(refund.amount || 0).toLocaleString('en-KE')} is on its way back to you.`, data: { path: '/buyer', refundId: refund.id } }));
    }
});

eventBus.on(AppEvents.REFUND.REJECTED, async ({ eventId, refund, buyer }) => {
    logger.info(`[Event:RefundRejected] Refund ${refund.id} rejected`);
    const buyerUserId = await buyerUserIdById(buyer?.id || refund?.buyer_id);
    if (buyerUserId) {
        await eventBus.deliverRecipient(eventId, `refund:${refund.id}:buyer:rejected:feed`, () => feedSend(buyerUserId, 'buyer', { type: 'refund_rejected', title: 'Refund update', body: refund.adminNotes ? String(refund.adminNotes) : 'Your refund request was not approved. Tap for details.', data: { path: '/buyer', refundId: refund.id } }));
    }
});

eventBus.on(AppEvents.REFERRAL.REWARD_CREATED, async ({ eventId, seller, reward }) => {
    logger.info(`[Event:ReferralRewardCreated] Seller ${seller?.id} reward ${reward?.amount}`);
    const amount = Number(reward.amount || 0);
    const sellerUserId = await sellerUserIdById(seller?.id);
    if (sellerUserId) {
        await eventBus.deliverRecipient(eventId, `referral:${reward.id || reward.referredSellerId || amount}:seller:${seller.id}:feed`, () => feedSend(sellerUserId, 'seller', { type: 'referral_reward', title: `You earned KES ${amount.toLocaleString('en-KE')}`, body: `From ${reward.referredShopName || 'a referred shop'} this month. Keep building your squad!`, data: { path: '/seller' } }));
    }
});

export default eventBus;
