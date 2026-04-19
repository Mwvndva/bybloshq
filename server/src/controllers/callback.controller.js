import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import WithdrawalService from '../services/withdrawal.service.js';

/**
 * handlePaydPayoutCallback
 * 
 * Handles POST /api/callbacks/payd-payout
 * Called by Payd after a withdrawal completes or fails.
 * 
 * Payd webhook fields (v2):
 *   transaction_reference  — Payd's correlator_id (matches our provider_reference)
 *   result_code            — 0 = success, 1 = failed
 *   status                 — "success" | "failed"
 *   amount                 — amount sent
 *   remarks                — human-readable result
 *   third_party_trans_id   — Safaricom M-Pesa receipt (on success)
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

    // NOTE: We do NOT open a transaction here. updateStatusWithSideEffects
    // manages its own atomic transaction internally with row-level locking.
    // Opening an outer transaction here would create lock contention.
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

            // Transaction and locking are handled in the service layer to ensure atomicity
            // across status updates and wallet refunds. We only fetch the ID here.
            const { rows: [request] } = await pool.query(
                `SELECT id FROM withdrawal_requests WHERE provider_reference = $1`,
                [transactionReference]
            );

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
