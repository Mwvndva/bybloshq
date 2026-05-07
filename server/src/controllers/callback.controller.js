import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import WithdrawalService from '../services/withdrawal.service.js';
import PayoutService from '../services/payout.service.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

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
    // 1. Signature Verification (CRITICAL FIX: DETE-HMAC-VERIFICATION)
    const signature = req.headers['x-payd-signature'];
    const isValid = PayoutService.verifyWebhookSignature(signature, req.rawBody);

    if (!isValid) {
        logger.error('[PAYOUT-CALLBACK] Invalid signature or forge attempt detected', {
            signature: signature || 'missing',
            ip: req.ip,
            path: req.path
        });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Payd might wrap payload in 'data' object
    const data = req.body.data || req.body;

    logger.info('[PAYOUT-CALLBACK] Authenticated webhook received', {
        transaction_reference: data.transaction_reference,
        status: data.status
    });

    try {
            // Payd v2 payout callback uses 'transaction_reference' or 'correlator_id'
            const transactionReference = data.transaction_reference || data.correlator_id;

            if (!transactionReference) {
                logger.warn('[PAYOUT-CALLBACK] Missing transaction reference in payload', { keys: Object.keys(data) });
                return res.status(400).json({ error: 'Missing transaction reference' });
            }

            // result_code 0 usually means success. success flag might be string "true" or boolean true
            const resultCodeNum = Number.parseInt(data.result_code, 10);
            const isSuccess = resultCodeNum === 0 ||
                data.status === 'success' ||
                data.success === true ||
                data.success === 'true';

            const finalStatus = isSuccess ? 'completed' : 'failed';

            const { rows: [request] } = await pool.query(
                `SELECT id, amount, status FROM withdrawal_requests WHERE provider_reference = $1`,
                [transactionReference]
            );

            if (!request) {
                logger.warn(`[PAYOUT-CALLBACK] No request found for: ${transactionReference}`);
                return res.status(202).json({ received: true, status: 'unmatched' });
            }

            // 🛠️ FRAUD GUARD: Verify amount matches DB record (CRITICAL FIX: PRICE-TRUST)
            const providerAmount = Number.parseFloat(data.amount);
            const dbAmount = Number.parseFloat(request.amount);
            if (isSuccess && (isNaN(providerAmount) || providerAmount <= 0)) {
                logger.error('[PAYOUT-CALLBACK] FRAUD ALERT: Successful payout callback missing valid amount', {
                    requestId: request.id,
                    received: data.amount
                });
                await WithdrawalService.updateStatusWithSideEffects(request.id, 'failed', {
                    remarks: 'FRAUD ALERT: Successful payout callback missing valid amount',
                    skipRefund: true
                });
                return res.status(200).json({ received: true, status: 'rejected' });
            }

            if (isSuccess && Math.abs(providerAmount - dbAmount) > 0.01) {
                logger.error('[PAYOUT-CALLBACK] FRAUD ALERT: Amount mismatch!', {
                    orderId: request.id,
                    expected: dbAmount,
                    received: providerAmount
                });
                await WithdrawalService.updateStatusWithSideEffects(request.id, 'failed', {
                    remarks: `FRAUD ALERT: Paid ${providerAmount} but expected ${dbAmount}`,
                    skipRefund: true
                });
                return res.status(200).json({ received: true, status: 'rejected' });
            }

            await WithdrawalService.updateStatusWithSideEffects(request.id, finalStatus, {
                remarks: data.remarks || data.message || (isSuccess ? 'Payout successful' : 'Payout failed'),
                mpesa_receipt: data.third_party_trans_id || data.mpesa_receipt || null,
                provider_reference: transactionReference
            });

            // P1-3 FIX: Emit WITHDRAWAL.COMPLETED only here — after Payd has confirmed the payout.
            // NEVER emit this from initiateWithdrawal (that emits WITHDRAWAL.INITIATED).
            if (isSuccess) {
                setImmediate(() => {
                    eventBus.emit(AppEvents.WITHDRAWAL.COMPLETED, {
                        withdrawal: { id: request.id, amount: request.amount, status: 'completed' }
                    });
                });
            }

            logger.info(`[PAYOUT-CALLBACK] Processed request ${request.id}. Status: ${finalStatus}`);
        return res.status(200).json({ received: true });
    } catch (error) {
        logger.error('[PAYOUT-CALLBACK] Processing error:', error);
        return res.status(500).json({ error: 'Callback processing failed' });
    }
};


