import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import payoutService from './payout.service.js';
import whatsappService from './whatsapp.service.js';

/**
 * WithdrawalService
 * 
 * Flow:
 * 1. Validate inputs
 * 2. Lock entity row, check balance
 * 3. Deduct balance from entity wallet
 * 4. Insert withdrawal_requests record (status: 'processing')
 * 5. Commit DB transaction
 * 6. Call Payd API asynchronously (non-blocking to caller)
 *    - On API success: store correlator_id as provider_reference
 *    - On API failure: refund balance, mark request 'failed'
 * 7. Payd sends webhook to /api/callbacks/payd-payout
 *    - callback.controller handles final status update
 */
class WithdrawalService {

    /**
     * Create and initiate a withdrawal request.
     *
     * @param {Object} params
     * @param {number}  params.entityId    - seller.id, organizer.id, or event.id
     * @param {string}  params.entityType  - 'seller' | 'organizer' | 'event'
     * @param {number}  params.amount      - KES amount requested
     * @param {string}  params.mpesaNumber - Raw phone number (any format, will be normalized)
     * @param {string}  params.mpesaName   - Registered M-Pesa name
     * @param {number}  [params.organizerId] - Required when entityType is 'event'
     * @returns {Promise<Object>} withdrawal_requests row
     */
    async createWithdrawalRequest({ entityId, entityType, amount, mpesaNumber, mpesaName, organizerId }) {

        // --- Phase 1: Validate inputs before touching DB ---
        const validatedAmount = payoutService.validateAmount(amount);
        const normalizedPhone = payoutService.normalizePhoneForPayout(mpesaNumber);

        if (!mpesaName?.trim()) {
            throw new Error('M-Pesa registered name is required');
        }
        if (!['seller', 'organizer', 'event'].includes(entityType)) {
            throw new Error(`Invalid entityType: ${entityType}`);
        }
        if (entityType === 'event' && !organizerId) {
            throw new Error('organizerId is required for event withdrawals');
        }

        // --- Phase 2: DB transaction — lock, check, deduct, insert ---
        const client = await pool.connect();
        let request;
        let entity;

        try {
            await client.query('BEGIN');

            // Lock entity row and fetch current balance
            let entityRow;
            if (entityType === 'seller') {
                const { rows } = await client.query(
                    'SELECT id, balance, full_name, whatsapp_number FROM sellers WHERE id = $1 FOR UPDATE',
                    [entityId]
                );
                entityRow = rows[0];
            } else if (entityType === 'organizer') {
                const { rows } = await client.query(
                    'SELECT id, balance, full_name, whatsapp_number FROM organizers WHERE id = $1 FOR UPDATE',
                    [entityId]
                );
                entityRow = rows[0];
            } else if (entityType === 'event') {
                const { rows } = await client.query(
                    'SELECT id, balance, name AS full_name FROM events WHERE id = $1 AND organizer_id = $2 FOR UPDATE',
                    [entityId, organizerId]
                );
                entityRow = rows[0];
            }

            if (!entityRow) {
                throw new Error(`${entityType} not found or unauthorized`);
            }

            entity = entityRow;

            // Calculate the amount to deduct from balance
            // For event withdrawals: gross up to cover the 6% platform fee
            let deductionAmount = validatedAmount;
            if (entityType === 'event') {
                deductionAmount = validatedAmount / (1 - 0.06); // e.g. withdraw 1000 → deduct 1063.83
            }

            const currentBalance = parseFloat(entity.balance || 0);
            if (currentBalance < deductionAmount) {
                throw new Error(
                    `Insufficient balance. Available: KES ${currentBalance.toLocaleString()}, ` +
                    `Required: KES ${deductionAmount.toLocaleString()}`
                );
            }

            // Deduct from entity balance
            const balanceTable = entityType === 'event' ? 'events' : entityType === 'organizer' ? 'organizers' : 'sellers';
            await client.query(
                `UPDATE ${balanceTable} SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
                [deductionAmount, entityId]
            );

            // Insert withdrawal request record
            const insertResult = await client.query(
                `INSERT INTO withdrawal_requests 
                    (seller_id, organizer_id, event_id, amount, mpesa_number, mpesa_name, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'processing', NOW())
                 RETURNING id, amount, mpesa_number, mpesa_name, status, created_at`,
                [
                    entityType === 'seller' ? entityId : null,
                    entityType === 'organizer' ? entityId : (entityType === 'event' ? organizerId : null),
                    entityType === 'event' ? entityId : null,
                    validatedAmount,
                    normalizedPhone,
                    mpesaName.trim()
                ]
            );

            request = insertResult.rows[0];

            await client.query('COMMIT');
            logger.info(`[WithdrawalService] Request ${request.id} created. Deducted KES ${deductionAmount} from ${entityType} ${entityId}`);

        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('[WithdrawalService] Failed to create withdrawal request:', err.message);
            throw err;
        } finally {
            client.release();
        }

        // --- Phase 3: Call Payd API asynchronously ---
        // Do NOT await — return the request immediately to caller
        this._callPaydAndUpdate(request, entity, validatedAmount, normalizedPhone)
            .catch(err => logger.error(`[WithdrawalService] _callPaydAndUpdate failed for request ${request.id}:`, err));

        return request;
    }

    /**
     * Private: Call Payd, store correlator_id, or refund on failure.
     * Runs asynchronously after the DB transaction is committed.
     */
    async _callPaydAndUpdate(request, entity, amount, phone) {
        try {
            logger.info(`[WithdrawalService] Calling Payd for request ${request.id}`);

            const paydResponse = await payoutService.initiatePayout({
                phone_number: phone,
                amount,
                narration: `Withdrawal for ${entity.full_name || 'ByblosHQ Seller'}`
            });

            // Store Payd's correlator_id as our provider_reference
            // This is what the webhook callback will reference via transaction_reference
            const correlatorId = paydResponse.correlator_id;

            if (correlatorId) {
                await pool.query(
                    `UPDATE withdrawal_requests 
                     SET provider_reference = $1, raw_response = $2
                     WHERE id = $3`,
                    [correlatorId, JSON.stringify(paydResponse), request.id]
                );
                logger.info(`[WithdrawalService] Request ${request.id} → Payd correlator_id: ${correlatorId}`);
            } else {
                // Payd accepted but returned no correlator_id — log raw response
                await pool.query(
                    'UPDATE withdrawal_requests SET raw_response = $1 WHERE id = $2',
                    [JSON.stringify(paydResponse), request.id]
                );
                logger.warn(`[WithdrawalService] Request ${request.id}: Payd returned no correlator_id`, paydResponse);
            }

            // Notify entity: payout is processing
            if (entity.whatsapp_number) {
                whatsappService.notifySellerWithdrawalUpdate(entity.whatsapp_number, {
                    amount,
                    status: 'processing',
                    reference: correlatorId || `REQ-${request.id}`,
                    reason: null,
                    newBalance: null
                }).catch(err => logger.error('[WithdrawalService] WhatsApp notify failed:', err));
            }

        } catch (apiError) {
            // Payd API call failed — refund the balance and mark as failed
            logger.error(`[WithdrawalService] Payd API failed for request ${request.id}: ${apiError.message}`);

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const newBalance = await payoutService.refundToWallet(client, request);

                await client.query(
                    `UPDATE withdrawal_requests 
                     SET status = 'failed',
                         metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{api_error}', $1::jsonb),
                         processed_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify(apiError.message), request.id]
                );

                await client.query('COMMIT');
                logger.info(`[WithdrawalService] Request ${request.id} marked failed. Balance refunded.`);

                if (entity.whatsapp_number) {
                    whatsappService.notifySellerWithdrawalUpdate(entity.whatsapp_number, {
                        amount,
                        status: 'failed',
                        reference: `REQ-${request.id}`,
                        reason: apiError.message,
                        newBalance
                    }).catch(() => { });
                }

            } catch (refundErr) {
                await client.query('ROLLBACK');
                logger.error(`[WithdrawalService] CRITICAL: Refund failed for request ${request.id}:`, refundErr);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Reconcile withdrawal requests stuck in 'processing' for over hoursAgo hours.
     * Called by cron job hourly.
     * Note: Payd does NOT expose a status-check endpoint in the v2 docs.
     * This marks long-stuck requests for manual review rather than auto-resolving.
     */
    async reconcileStuckWithdrawals(hoursAgo = 2) {
        logger.info(`[WithdrawalService] Reconciling requests stuck > ${hoursAgo} hours`);

        const { rows: stuck } = await pool.query(
            `SELECT wr.*, 
                    s.whatsapp_number as seller_phone,
                    o.whatsapp_number as organizer_phone
             FROM withdrawal_requests wr
             LEFT JOIN sellers s ON wr.seller_id = s.id
             LEFT JOIN organizers o ON wr.organizer_id = o.id
             WHERE wr.status = 'processing'
               AND wr.created_at < NOW() - ($1 * INTERVAL '1 hour')
               AND wr.created_at > NOW() - INTERVAL '48 hours'
             ORDER BY wr.created_at ASC`,
            [hoursAgo]  // Parameterized — no SQL injection
        );

        logger.info(`[WithdrawalService] Found ${stuck.length} stuck request(s)`);

        for (const request of stuck) {
            try {
                if (!request.provider_reference) {
                    // No correlator_id stored — Payd API may have failed silently
                    logger.warn(`[WithdrawalService] Request ${request.id} has no provider_reference. Marking needs_review.`);
                    await pool.query(
                        `UPDATE withdrawal_requests 
                         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{reconciliation_flag}', '"no_provider_reference"'::jsonb)
                         WHERE id = $1`,
                        [request.id]
                    );
                    continue;
                }

                // Mark for manual review — Payd v2 has no status-check endpoint documented
                await pool.query(
                    `UPDATE withdrawal_requests 
                     SET metadata = jsonb_set(
                         COALESCE(metadata, '{}'::jsonb), 
                         '{reconciliation_flag}', 
                         '"needs_manual_review"'::jsonb
                     )
                     WHERE id = $1 AND metadata->>'reconciliation_flag' IS NULL`,
                    [request.id]
                );

                logger.info(`[WithdrawalService] Request ${request.id} (ref: ${request.provider_reference}) flagged for manual review`);

            } catch (err) {
                logger.error(`[WithdrawalService] Reconcile error for request ${request.id}:`, err.message);
            }
        }
    }
}

export default new WithdrawalService();
