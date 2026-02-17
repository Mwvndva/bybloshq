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
    // Acknowledge immediately — Payd will retry if we return 5xx
    const client = await pool.connect();

    try {
        const payload = req.body;

        logger.info('[PAYOUT-CALLBACK] Received', {
            body: JSON.stringify(payload, null, 2),
            headers: req.headers
        });

        // --- Extract fields from Payd v2 webhook ---
        const transactionReference = payload.transaction_reference;
        const resultCode = payload.result_code;       // 0 = success, 1 = failed
        const paydStatus = payload.status;            // "success" | "failed"
        const remarks = payload.remarks || '';
        const mpesaReceipt = payload.third_party_trans_id || null;
        const callbackAmount = parseFloat(payload.amount || 0);

        logger.info(`[PAYOUT-CALLBACK] transaction_reference=${transactionReference}, result_code=${resultCode}, status=${paydStatus}`);

        if (!transactionReference) {
            logger.warn('[PAYOUT-CALLBACK] Missing transaction_reference in payload');
            return res.status(400).json({ status: 'error', message: 'Missing transaction_reference' });
        }

        // --- Determine outcome using BOTH result_code and status ---
        // Per Payd docs: resultCode 0 + status "success" = paid
        let finalStatus = null;
        if (resultCode === 0 && paydStatus === 'success') {
            finalStatus = 'completed';
        } else if (resultCode === 1 || paydStatus === 'failed') {
            finalStatus = 'failed';
        } else {
            logger.info(`[PAYOUT-CALLBACK] Unrecognised status — ignoring. result_code=${resultCode}, status=${paydStatus}`);
            return res.status(200).json({ status: 'ignored' });
        }

        await client.query('BEGIN');

        // --- Find the withdrawal request by provider_reference (= Payd correlator_id) ---
        const { rows: [request] } = await client.query(
            `SELECT 
                wr.id,
                wr.status,
                wr.amount,
                wr.seller_id,
                wr.organizer_id,
                wr.event_id,
                COALESCE(s.whatsapp_number, o.whatsapp_number) AS entity_phone
             FROM withdrawal_requests wr
             LEFT JOIN sellers    s ON wr.seller_id    = s.id
             LEFT JOIN organizers o ON wr.organizer_id = o.id
             WHERE wr.provider_reference = $1
             FOR UPDATE OF wr`,
            [transactionReference]
        );

        if (!request) {
            logger.warn(`[PAYOUT-CALLBACK] No request found for transaction_reference: ${transactionReference}`);
            await client.query('ROLLBACK');
            return res.status(200).json({ status: 'not_found' });
        }

        // --- Idempotency: skip if already finalized ---
        if (['completed', 'failed'].includes(request.status)) {
            await client.query('ROLLBACK');
            logger.info(`[PAYOUT-CALLBACK] Request ${request.id} already ${request.status} — skipping`);
            return res.status(200).json({ status: 'already_processed' });
        }

        // --- Update withdrawal request status ---
        await client.query(
            `UPDATE withdrawal_requests
             SET status       = $1,
                 processed_at = NOW(),
                 metadata     = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
             WHERE id = $3`,
            [
                finalStatus,
                JSON.stringify({
                    payd_callback: payload,
                    mpesa_receipt: mpesaReceipt,
                    remarks,
                    callback_amount: callbackAmount
                }),
                request.id
            ]
        );

        // --- On failure: refund the seller/organizer/event balance ---
        let newBalance = null;
        if (finalStatus === 'failed') {
            newBalance = await payoutService.refundToWallet(client, request);
            logger.info(`[PAYOUT-CALLBACK] Request ${request.id} FAILED — refunded KES ${request.amount}`);
        } else {
            logger.info(`[PAYOUT-CALLBACK] Request ${request.id} COMPLETED — M-Pesa receipt: ${mpesaReceipt}`);
        }

        await client.query('COMMIT');

        // --- WhatsApp notification ---
        if (request.entity_phone) {
            whatsappService.notifySellerWithdrawalUpdate(request.entity_phone, {
                amount: request.amount,
                status: finalStatus,
                reference: mpesaReceipt || transactionReference,
                reason: finalStatus === 'failed' ? remarks : null,
                newBalance
            }).catch(err => logger.error('[PAYOUT-CALLBACK] WhatsApp notify failed:', err));
        } else {
            logger.warn(`[PAYOUT-CALLBACK] No entity_phone for request ${request.id} — WhatsApp skipped`);
        }

        return res.status(200).json({ status: 'success' });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[PAYOUT-CALLBACK] Unhandled error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
};
