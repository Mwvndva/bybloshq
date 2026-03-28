import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import whatsappService from '../services/whatsapp.service.js';
import payoutService from '../services/payout.service.js';

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
            const resultCode = payload.result_code;
            const paydStatus = payload.status;
            const mpesaReceipt = payload.third_party_trans_id || null;

            if (!transactionReference) {
                logger.warn('[PAYOUT-CALLBACK] Missing transaction_reference');
                return;
            }

            // Payd docs: SUCCESS = result_code===0 AND (status==="success" OR success===true)
            // Both result_code AND status/success must confirm success
            const resultCodeNum = parseInt(resultCode, 10);
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

            await client.query(
                `UPDATE withdrawal_requests
           SET status = $1,
               processed_at = NOW(),
               metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
           WHERE id = $3`,
                [
                    finalStatus,
                    JSON.stringify({
                        payd_callback: payload,
                        mpesa_receipt: mpesaReceipt,
                        remarks: payload.remarks,
                    }),
                    request.id
                ]
            );

            let newBalance = null;
            if (!isSuccess) {
                newBalance = await payoutService.refundToWallet(client, request);
                logger.info(`[PAYOUT-CALLBACK] Failed — refunded KES ${request.amount}`);
            } else {
                logger.info(`[PAYOUT-CALLBACK] Completed — receipt: ${mpesaReceipt}`);
            }

            await client.query('COMMIT');

            // WhatsApp notification (fire-and-forget)
            if (request.entity_phone) {
                payoutService.refundToWallet && whatsappService.notifySellerWithdrawalUpdate(
                    request.entity_phone,
                    {
                        amount: request.amount,
                        status: finalStatus,
                        reference: mpesaReceipt || transactionReference,
                        reason: !isSuccess ? payload.remarks : null,
                        newBalance
                    }
                ).catch(err => logger.error('[PAYOUT-CALLBACK] WhatsApp notify failed:', err));
            }

        } catch (error) {
            await client.query('ROLLBACK').catch(() => { });
            logger.error('[PAYOUT-CALLBACK] Processing error:', error);
        } finally {
            client.release();
        }
    });
};
