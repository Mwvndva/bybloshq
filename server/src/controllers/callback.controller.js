import logger from '../shared/utils/logger.js';
import PayoutCallbackStateMachineService from '../services/payoutCallbackStateMachine.service.js';
import PaystackTransferClient from '../providers/PaystackTransferClient.js';

const paystackTransferClient = new PaystackTransferClient();

export const handlePaystackTransferCallback = async (req, res) => {
    if (!req.webhookSecurity?.hmacVerified) {
        logger.error('[PAYOUT-CALLBACK] HMAC verification metadata missing; rejecting before mutation', {
            ip: req.ip,
            path: req.path
        });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        logger.error('[PAYOUT-CALLBACK] Invalid payload structure; expected JSON object', {
            ip: req.ip,
            path: req.path
        });
        return res.status(400).json({ error: 'Invalid payload structure' });
    }

    const data = paystackTransferClient.normalizePaystackTransferPayload(req.body);

    logger.info('[PAYOUT-CALLBACK] Authenticated Paystack transfer callback received', {
        transaction_reference: data.transaction_reference,
        client_reference: data.client_reference,
        status: data.status,
        replayEventId: req.webhookSecurity.replayEventId
    });

    try {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback(data, {
            replayEventId: req.webhookSecurity.replayEventId,
            clientIp: req.ip
        });

        return res.status(result.httpStatus || 200).json({
            received: true,
            status: result.status,
            withdrawalId: result.withdrawalId || null
        });
    } catch (error) {
        logger.error('[PAYOUT-CALLBACK] Error processing callback:', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
