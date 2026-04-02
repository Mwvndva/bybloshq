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

    // Process asynchronously
    setImmediate(async () => {
        const client = await pool.connect();
        try {
            const transactionReference = payload.transaction_reference;
            logger.info(`[PAYOUT-CALLBACK] Matching webhook transaction_reference: ${transactionReference}`);
            const resultCode = payload.result_code;
            const paydStatus = payload.status;
            const mpesaReceipt = payload.third_party_trans_id || null;

            if (!transactionReference) {
                logger.warn('[PAYOUT-CALLBACK] Missing transaction_reference');
                return;
            }

            // Payd docs: SUCCESS = result_code===0 AND (status==="success" OR success===true)
            // Both result_code AND status/success must confirm success
            const resultCodeNum = Number.parseInt(resultCode, 10);
            const isSuccess = resultCodeNum === 0 &&
                (paydStatus === 'success' || payload.success === true);

            let finalStatus = isSuccess ? 'completed' : 'failed';

            await client.query('BEGIN');

            const { rows: [request] } = await client.query(
                `SELECT wr.id, wr.status, wr.amount, wr.seller_id,
                  s.whatsapp_number AS entity_phone
           FROM withdrawal_requests wr
           LEFT JOIN sellers s ON wr.seller_id = s.id
           WHERE wr.provider_reference = $1
           FOR UPDATE OF wr`,
                [transactionReference]
            );

            if (!request) {
                logger.warn(`[PAYOUT-CALLBACK] No request found for: ${transactionReference}`);
                await client.query('ROLLBACK');
                return;
            }

            if (['completed', 'failed'].includes(request.status)) {
                await client.query('ROLLBACK');
                logger.info(`[PAYOUT-CALLBACK] Already processed: ${request.id}`);
                return;
            }

            const updated = await WithdrawalService.updateStatusWithSideEffects(request.id, finalStatus, {
                remarks: payload.remarks,
                mpesa_receipt: mpesaReceipt,
                provider_reference: transactionReference
            });

            logger.info(`[PAYOUT-CALLBACK] Processed request ${request.id} using WithdrawalService. Status: ${finalStatus}`);


        } catch (error) {
            await client.query('ROLLBACK').catch(() => { });
            logger.error('[PAYOUT-CALLBACK] Processing error:', error);
        } finally {
            client.release();
        }
    });
};
