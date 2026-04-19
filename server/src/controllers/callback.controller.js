import logger from '../utils/logger.js';
import WithdrawalService from '../services/withdrawal.service.js';
import Withdrawal from '../models/withdrawal.model.js';

/**
 * handlePaydPayoutCallback
 * 
 * Handles POST /api/callbacks/payd-payout
 * Called by Payd after a withdrawal completes or fails.
 */
export const handlePaydPayoutCallback = async (req, res) => {
    const payload = req.body;

    logger.info('[PAYOUT-CALLBACK] Received', {
        transaction_reference: payload.transaction_reference,
        result_code: payload.result_code,
        status: payload.status,
        success: payload.success,
    });

    // RESPOND 200 IMMEDIATELY as required by Payd docs
    res.status(200).json({ received: true });

    setImmediate(async () => {
        try {
            const transactionReference = payload.transaction_reference;
            if (!transactionReference) {
                logger.warn('[PAYOUT-CALLBACK] Missing transaction_reference');
                return;
            }

            const resultCodeNum = Number.parseInt(payload.result_code, 10);
            const isSuccess = resultCodeNum === 0 &&
                (payload.status === 'success' || payload.success === true);
            const finalStatus = isSuccess ? 'completed' : 'failed';

            // Lookup withdrawal request ID via Model
            const request = await Withdrawal.findByProviderReference(transactionReference);

            if (!request) {
                logger.warn(`[PAYOUT-CALLBACK] No request found for: ${transactionReference}`);
                return;
            }

            await WithdrawalService.updateStatusWithSideEffects(request.id, finalStatus, {
                remarks: payload.remarks,
                mpesa_receipt: payload.third_party_trans_id || null,
                provider_reference: transactionReference
            });

            logger.info(`[PAYOUT-CALLBACK] Processed request ${request.id}. Status: ${finalStatus}`);
        } catch (error) {
            logger.error('[PAYOUT-CALLBACK] Processing error:', error);
        }
    });
};
