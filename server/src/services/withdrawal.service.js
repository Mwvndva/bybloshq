import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import payoutService from './payout.service.js';
import whatsappService from './whatsapp.service.js';
import Withdrawal from '../models/withdrawal.model.js';
import Seller from '../models/seller.model.js';
import { toJsonb } from '../utils/order.utils.js';

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
     * Update withdrawal status with side effects (refunds, notifications)
     * 
     * @param {number} requestId
     * @param {string} newStatus
     * @param {Object} opts
     * @param {Object} externalClient - Optional external DB client for transaction management
     */
    async updateStatusWithSideEffects(requestId, newStatus, opts = {}, externalClient = null) {
        const { remarks = null, provider_reference = null, mpesa_receipt = null } = opts;

        // If an externalClient is provided, we use it and let the caller manage COMMIT/ROLLBACK.
        // Otherwise, we obtain a new client from the pool and manage our own transaction.
        const client = externalClient || await pool.connect();
        const isInternalTransaction = !externalClient;

        try {
            if (isInternalTransaction) {
                await client.query('BEGIN');
            }

            const request = await Withdrawal.findById(requestId);

            if (!request) throw new Error('Withdrawal request not found');

            // Lock sellers row to prevent race conditions during balance updates
            if (newStatus === 'failed') {
                await Seller.findByIdForUpdate(client, request.seller_id);
            }

            // Prevent re-processing terminal states
            if (['completed', 'failed'].includes(request.status)) {
                if (isInternalTransaction) {
                    await client.query('ROLLBACK');
                }
                return request;
            }

            const metadataUpdate = {
                payd_callback: { remarks, third_party_trans_id: mpesa_receipt },
                mpesa_receipt,
                remarks
            };

            await Withdrawal.updateStatus(client, requestId, newStatus, metadataUpdate);
            if (provider_reference) {
                await Withdrawal.updateReference(client, requestId, provider_reference);
            }

            let newBalance = null;
            if (newStatus === 'failed') {
                // ENSURE: refundToWallet uses the SAME client for atomicity
                newBalance = await payoutService.refundToWallet(client, request);
                logger.info(`[WithdrawalService] Request ${requestId} failed. Refunded KES ${request.amount} to seller ${request.seller_id}`);
            }

            if (isInternalTransaction) {
                await client.query('COMMIT');
            }

            // Notify via WhatsApp (Non-blocking)
            const seller = await Seller.findById(request.seller_id);
            if (seller?.whatsappNumber) {
                whatsappService.notifySellerWithdrawalUpdate(seller.whatsappNumber, {
                    amount: request.amount,
                    status: newStatus,
                    reference: mpesa_receipt || provider_reference || request.provider_reference || `REQ-${request.id}`,
                    reason: remarks,
                    newBalance,
                    mpesaNumber: request.mpesa_number,
                    request_id: request.id
                }).catch(err => logger.error(`[WithdrawalService] WhatsApp notification failed for request ${requestId}:`, err));
            }

            return { ...request, status: newStatus };
        } catch (error) {
            if (isInternalTransaction) {
                await client.query('ROLLBACK');
            }
            logger.error(`[WithdrawalService] updateStatusWithSideEffects failed for ${requestId}:`, error.message);
            throw error;
        } finally {
            if (isInternalTransaction) {
                client.release();
            }
        }
    }

    /**
     * Create and initiate a withdrawal request.
     *
     * @param {Object} params
     * @param {number}  params.entityId    - seller.id
     * @param {string}  params.entityType  - 'seller'
     * @returns {Promise<Object>} withdrawal_requests row
     */
    async createWithdrawalRequest({ entityId, entityType, amount, mpesaNumber, mpesaName }) {

        // --- Phase 1: Validate inputs before touching DB ---
        const validatedAmount = payoutService.validateAmount(amount);
        const normalizedPhone = payoutService.normalizePhoneForPayout(mpesaNumber);

        if (!mpesaName?.trim()) {
            throw new Error('M-Pesa registered name is required');
        }
        if (entityType !== 'seller') {
            throw new Error(`Invalid entityType: ${entityType}. Must be 'seller'.`);
        }

        // --- Phase 2: DB transaction — lock, check, deduct, insert ---
        const client = await pool.connect();
        let request;
        let entity;

        try {
            await client.query('BEGIN');

            // Lock entity row and fetch current balance
            const entityRow = await Seller.findByIdForUpdate(client, entityId);

            if (!entityRow) {
                throw new Error(`${entityType} not found or unauthorized`);
            }

            entity = entityRow;

            let deductionAmount = validatedAmount;

            const currentBalance = Number.parseFloat(entity.balance || 0);
            if (currentBalance < deductionAmount) {
                throw new Error(
                    `Insufficient balance. Available: KES ${currentBalance.toLocaleString()}, ` +
                    `Required: KES ${deductionAmount.toLocaleString()}`
                );
            }

            // Deduct from entity balance
            await Seller.adjustWalletBalance(client, entityId, -deductionAmount);

            // Insert withdrawal request record
            request = await Withdrawal.insert(client, {
                seller_id: entityId,
                amount: validatedAmount,
                mpesa_number: normalizedPhone,
                mpesa_name: mpesaName.trim(),
                status: 'processing',
                api_call_pending: true
            });

            await client.query('COMMIT');
            logger.info(`[WithdrawalService] Request ${request.id} created.Deducted KES ${deductionAmount} from ${entityType} ${entityId}`);

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
            .catch(err => logger.error(`[WithdrawalService] _callPaydAndUpdate failed for request ${request.id}: `, err));

        return request;
    }

    /**
     * Private: Call Payd, store correlator_id, or refund on failure.
     * Runs asynchronously after the DB transaction is committed.
     */
    async _callPaydAndUpdate(request, entity, amount, phone) {
        try {
            // IDEMPOTENCY CHECK: Before initiating a new payout, check if we already have a reference
            // and if that payout was already successfully processed by the provider.
            if (request.provider_reference) {
                try {
                    const statusCheck = await payoutService.checkPayoutStatus(request.provider_reference);
                    // Status strings may vary, 'success' and 'completed' are terminal success states
                    if (statusCheck.success && (statusCheck.status === 'success' || statusCheck.status === 'completed')) {
                        logger.info(`[WithdrawalService] Request ${request.id} already successful on Payd (${statusCheck.status}). Syncing state.`);
                        await this.updateStatusWithSideEffects(request.id, 'completed', {
                            provider_reference: request.provider_reference,
                            remarks: 'Payout confirmed via status check'
                        });
                        return; // Exit early, no need to re-initiate
                    }
                } catch (statusError) {
                    // Status check might fail if endpoint is unavailable; log and proceed cautiously
                    logger.warn(`[WithdrawalService] Status check failed for request ${request.id}: ${statusError.message}`);
                }
            }

            logger.info(`[WithdrawalService] Calling Payd for request ${request.id}`);

            const paydResponse = await payoutService.initiatePayout({
                phone_number: phone,
                amount,
                narration: `Withdrawal for ${entity.full_name || 'ByblosHQ Seller'}`
            });

            // Payd withdrawal response uses 'correlator_id'; the webhook uses 'transaction_reference'
            // They are the same value — store correlator_id as our provider_reference
            const reference = paydResponse.correlator_id || paydResponse.transaction_reference

            if (reference) {
                await Withdrawal.updateReference(pool, request.id, reference, paydResponse);
                logger.info(`[WithdrawalService] Request ${request.id} → Payd correlator_id: ${reference}`);
            } else {
                // Payd accepted but returned no reference — log raw response
                await Withdrawal.updateMetadata(request.id, { raw_response: paydResponse, api_call_pending: false });
                logger.warn(`[WithdrawalService] Request ${request.id}: Payd returned no transaction_reference`, paydResponse);
            }

            // Notify entity: payout is processing
            if (entity.whatsapp_number) {
                whatsappService.notifySellerWithdrawalUpdate(entity.whatsapp_number, {
                    amount,
                    status: 'processing',
                    reference: reference || `REQ-${request.id}`,
                    reason: null,
                    newBalance: null
                }).catch(err => logger.error('[WithdrawalService] WhatsApp notify failed:', err));
            }

        } catch (apiError) {
            // Payd API call failed — refund the balance and mark as failed
            logger.error(`[WithdrawalService] Payd API failed for request ${request.id}: ${apiError.message} `);

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const newBalance = await payoutService.refundToWallet(client, request);

                await Withdrawal.updateStatus(client, request.id, 'failed', { api_error: apiError.message });

                await client.query('COMMIT');
                logger.info(`[WithdrawalService] Request ${request.id} marked failed.Balance refunded.`);

                if (entity.whatsapp_number) {
                    whatsappService.notifySellerWithdrawalUpdate(entity.whatsapp_number, {
                        amount,
                        status: 'failed',
                        reference: `REQ - ${request.id} `,
                        reason: apiError.message,
                        newBalance
                    }).catch(() => { });
                }

            } catch (refundErr) {
                await client.query('ROLLBACK');
                logger.error(`[WithdrawalService] CRITICAL: Refund failed for request ${request.id}: `, refundErr);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Retry any withdrawals that were left in api_call_pending = TRUE state.
     * Called on server startup.
     */
    async retryPendingApiCalls() {
        try {
            logger.info('[WithdrawalService] Checking for pending API calls to retry...');
            const pending = await Withdrawal.findPending();

            if (pending.length === 0) {
                logger.info('[WithdrawalService] No pending API calls found.');
                return;
            }

            logger.info(`[WithdrawalService] Found ${pending.length} pending requests to retry.`);

            // FIXED BUG-WD-04: Batching avoids overwhelming Payd API (Max 3 concurrent)
            for (let i = 0; i < pending.length; i++) {
                const request = pending[i];
                const entity = {
                    id: request.seller_id,
                    full_name: request.full_name,
                    whatsapp_number: request.whatsapp_number
                };

                // Sequential but could be concurrent-in-batches if i % 3 == 0
                await this._callPaydAndUpdate(request, entity, Number.parseFloat(request.amount), request.mpesa_number)
                    .catch(err => logger.error(`[WithdrawalService] Retry failed for request ${request.id}:`, err));

                // Delay between every 3rd request to stay within rate limits
                if ((i + 1) % 3 === 0 && (i + 1) < pending.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            logger.error('[WithdrawalService] Error during pending API call retry:', error);
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

        const stuck = await Withdrawal.findStuck(hoursAgo);

        logger.info(`[WithdrawalService] Found ${stuck.length} stuck request(s)`);

        for (const request of stuck) {
            try {
                if (!request.provider_reference) {
                    // No correlator_id stored — Payd API may have failed silently
                    logger.warn(`[WithdrawalService] Request ${request.id} has no provider_reference. Marking needs_review.`);
                    await Withdrawal.updateMetadata(request.id, { reconciliation_flag: 'no_provider_reference' });
                    continue;
                }

                // Mark for manual review — Payd v2 has no status-check endpoint documented
                await Withdrawal.updateMetadata(request.id, { reconciliation_flag: 'needs_manual_review' });

                logger.info(`[WithdrawalService] Request ${request.id} (ref: ${request.provider_reference}) flagged for manual review`);

            } catch (err) {
                logger.error(`[WithdrawalService] Reconcile error for request ${request.id}: `, err.message);
            }
        }
    }

    /**
     * Return paginated withdrawal history for a seller.
     * @param {number} sellerId
     * @param {{ limit: number, offset: number, status: string|null }} opts
     * @returns {Promise<{ rows: Object[], total: number }>}
     */
    async getWithdrawalsForSeller(sellerId, { limit = 20, offset = 0, status = null } = {}) {
        return await Withdrawal.findBySellerId(sellerId, { limit, offset, status });
    }

    /**
     * Return a single withdrawal request, enforcing seller ownership.
     * @param {number} requestId
     * @param {number} sellerId
     * @returns {Promise<Object|null>}
     */
    async getWithdrawalById(requestId, sellerId) {
        const request = await Withdrawal.findById(requestId);
        if (request && String(request.seller_id) === String(sellerId)) {
            return request;
        }
        return null;
    }
}

export default new WithdrawalService();
