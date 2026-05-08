import logger from '../shared/utils/logger.js';
import WithdrawalService from '../services/withdrawal.service.js';

/**
 * Handles POST /api/callbacks/payd-payout.
 *
 * Cryptographic verification and replay protection are enforced by the route
 * middleware before this controller can touch financial state.
 */
export const handlePaydPayoutCallback = async (req, res) => {
    if (!req.webhookSecurity?.hmacVerified) {
        logger.error('[PAYOUT-CALLBACK] HMAC verification metadata missing; rejecting before mutation', {
            ip: req.ip,
            path: req.path
        });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = req.body?.data || req.body || {};
    logger.info('[PAYOUT-CALLBACK] Authenticated callback received', {
        transaction_reference: data.transaction_reference || data.correlator_id,
        client_reference: data.client_reference || data.idempotency_key,
        status: data.status,
        replayEventId: req.webhookSecurity.replayEventId
    });

    try {
        const result = await WithdrawalService.handleProviderCallback(data, {
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
