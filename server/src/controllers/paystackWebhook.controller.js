import paymentController from './payment.controller.js';
import { handlePaystackTransferCallback } from './callback.controller.js';
import logger from '../shared/utils/logger.js';

const CHARGE_EVENTS = new Set([
    'charge.success',
    'charge.failed',
    'charge.abandoned'
]);

const TRANSFER_EVENTS = new Set([
    'transfer.success',
    'transfer.failed',
    'transfer.reversed'
]);

export const handleUnifiedPaystackWebhook = async (req, res, next) => {
    const eventType = String(req.body?.event || '').trim().toLowerCase();

    if (CHARGE_EVENTS.has(eventType)) {
        return paymentController.handlePaystackWebhook(req, res, next);
    }

    if (TRANSFER_EVENTS.has(eventType)) {
        return handlePaystackTransferCallback(req, res, next);
    }

    logger.info('[PAYSTACK-WEBHOOK] Ignored unsupported Paystack event', {
        event: req.body?.event || null,
        replayEventId: req.webhookSecurity?.replayEventId || null
    });

    return res.status(200).json({
        received: true,
        ignored: true,
        event: req.body?.event || null
    });
};

export default {
    handleUnifiedPaystackWebhook
};
