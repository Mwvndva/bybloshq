import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import payoutService from './payout.service.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import Fees from '../config/fees.js';
import PayoutCallbackStateMachineService, {
    providerPayloadIndicatesSuccess,
    providerPayloadIndicatesFailure
} from './payoutCallbackStateMachine.service.js';
import WithdrawalRetryWorkerService from './withdrawalRetryWorker.service.js';
import { getWithdrawalReservedAmount } from '../shared/utils/withdrawalUtils.js';

const AMBIGUOUS_PAYOUT_ERROR_CODES = new Set([
    'CONNECTION_FAILED',
    'TIMEOUT',
    'UNKNOWN_ERROR',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'ECONNABORTED'
]);

function isAmbiguousPayoutProviderError(error) {
    const status = error?.statusCode || error?.response?.status;
    if (AMBIGUOUS_PAYOUT_ERROR_CODES.has(error?.code)) return true;
    if (!status && (error?.request || error?.code)) return true;
    return Number.isFinite(status) && status >= 500;
}

function getEntityType(requestOrEntity = {}) {
    if (requestOrEntity.buyer_id || requestOrEntity.entity_type === 'buyer_refund') return 'buyer_refund';
    if (requestOrEntity.creator_id || requestOrEntity.entity_type === 'creator') return 'creator';
    return 'seller';
}

function getEntityLabel(entity = {}) {
    const entityType = getEntityType(entity);
    if (entity.full_name || entity.name || entity.mpesa_name) {
        return entity.full_name || entity.name || entity.mpesa_name;
    }
    if (entityType === 'buyer_refund') return 'Byblos Buyer';
    if (entityType === 'creator') return 'Byblos Creator';
    return 'ByblosHQ Seller';
}

function getEntityPhone(entity = {}) {
    return entity.whatsapp_number || entity.mpesa_number || entity.mobile_payment || null;
}

/**
 * WithdrawalService
 * 
 * Flow:
 * 1. Validate inputs
 * 2. Lock entity row, check balance
 * 3. Move available balance into withdrawal reserve
 * 4. Insert withdrawal_requests record (status: 'processing')
 * 5. Commit DB transaction
 * 6. Call payout provider asynchronously (non-blocking to caller)
 *    - On API success: store provider reference
 *    - On API failure: refund balance, mark request 'failed'
 * 7. Paystack sends webhook to /api/webhooks/paystack
 *    - callback.controller handles final status update
 */
class WithdrawalService {
    async startPayoutProviderAttempt(request, entity, amount, phone) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: existingRows } = await client.query(
                `SELECT *
                 FROM payout_provider_attempts
                 WHERE withdrawal_request_id = $1
                 FOR UPDATE`,
                [request.id]
            );
            const existing = existingRows[0];

            if (existing?.provider_reference && ['provider_accepted', 'completed'].includes(existing.status)) {
                await client.query('COMMIT');
                return { skip: true, reason: 'provider_attempt_already_accepted', providerReference: existing.provider_reference };
            }

            if (
                existing?.status === 'provider_call_started'
                && existing.last_attempt_at
                && (Date.now() - new Date(existing.last_attempt_at).getTime()) < 10 * 60 * 1000
            ) {
                await client.query('COMMIT');
                return { skip: true, reason: 'provider_attempt_active' };
            }

            const requestPayload = {
                phone_number: phone,
                amount,
                narration: `Withdrawal for ${getEntityLabel(entity)}`,
                idempotency_key: request.idempotency_key,
                recipient_name: request.mpesa_name || getEntityLabel(entity)
            };

            if (existing) {
                await client.query(
                    `UPDATE payout_provider_attempts
                     SET status = 'provider_call_started',
                         attempts = attempts + 1,
                         request_payload = $2,
                         last_attempt_at = NOW(),
                         updated_at = NOW()
                     WHERE withdrawal_request_id = $1`,
                    [request.id, JSON.stringify(requestPayload)]
                );
            } else {
                await client.query(
                    `INSERT INTO payout_provider_attempts
                        (withdrawal_request_id, seller_id, creator_id, buyer_id, idempotency_key, status, attempts, request_payload, last_attempt_at)
                     VALUES ($1, $2, $3, $4, $5, 'provider_call_started', 1, $6, NOW())`,
                    [request.id, request.seller_id || null, request.creator_id || null, request.buyer_id || null, request.idempotency_key, JSON.stringify(requestPayload)]
                );
            }

            await client.query('COMMIT');
            return { skip: false, requestPayload };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async markPayoutProviderAttemptAccepted(requestId, providerReference, responsePayload) {
        await pool.query(
            `UPDATE payout_provider_attempts
             SET provider_reference = COALESCE($2, provider_reference),
                 status = 'provider_accepted',
                 response_payload = $3,
                 updated_at = NOW()
             WHERE withdrawal_request_id = $1`,
            [requestId, providerReference || null, JSON.stringify(responsePayload || {})]
        );
    }

    async markPayoutProviderAttemptFailed(requestId, errorPayload) {
        await pool.query(
            `UPDATE payout_provider_attempts
             SET status = 'provider_call_failed',
                 error_payload = $2,
                 updated_at = NOW()
             WHERE withdrawal_request_id = $1`,
            [requestId, JSON.stringify(errorPayload || {})]
        );
    }

    async markPayoutProviderAttemptAmbiguous(requestId, errorPayload) {
        await pool.query(
            `UPDATE payout_provider_attempts
             SET status = 'provider_result_ambiguous',
                 error_payload = $2,
                 updated_at = NOW()
             WHERE withdrawal_request_id = $1`,
            [requestId, JSON.stringify(errorPayload || {})]
        );
    }

    /**
     * Update withdrawal status with side effects (refunds, notifications)
     * 
     * @param {number} requestId
     * @param {string} newStatus
     * @param {Object} opts
     * @param {Object} externalClient - Optional external DB client for transaction management
     */
    async updateStatusWithSideEffects(requestId, newStatus, opts = {}, externalClient = null) {
        const { remarks = null, provider_reference = null, mpesa_receipt = null, skipRefund = false } = opts;

        // If an externalClient is provided, we use it and let the caller manage COMMIT/ROLLBACK.
        // Otherwise, we obtain a new client from the pool and manage our own transaction.
        const client = externalClient || await pool.connect();
        const isInternalTransaction = !externalClient;
        let updatedEventId = null;

        try {
            if (isInternalTransaction) {
                await client.query('BEGIN');
            }

            const { rows: [request] } = await client.query(
                `SELECT wr.*,
                        COALESCE(s.whatsapp_number, c.whatsapp_number, c.mpesa_number) as entity_phone
                 FROM withdrawal_requests wr 
                 LEFT JOIN sellers s ON wr.seller_id = s.id
                 LEFT JOIN creators c ON wr.creator_id = c.id
                 WHERE wr.id = $1 FOR UPDATE OF wr`,
                [requestId]
            );

            if (!request) throw new Error('Withdrawal request not found');

            // Lock wallet owner row to prevent race conditions during balance updates.
            if (['completed', 'failed'].includes(newStatus)) {
                if (request.seller_id) {
                    await client.query('SELECT id FROM sellers WHERE id = $1 FOR UPDATE', [request.seller_id]);
                } else if (request.creator_id) {
                    await client.query('SELECT id FROM creators WHERE id = $1 FOR UPDATE', [request.creator_id]);
                } else if (request.buyer_id) {
                    await client.query('SELECT id FROM buyers WHERE id = $1 FOR UPDATE', [request.buyer_id]);
                }
            }

            // Prevent re-processing terminal states (CRITICAL FIX: STATE-TRANSITIONS)
            if (['completed', 'failed', 'compensation_required'].includes(request.status)) {
                logger.warn(`[WithdrawalService] Ignoring update for terminal request ${requestId} (Status: ${request.status})`);
                if (isInternalTransaction) {
                    await client.query('ROLLBACK');
                }
                return request;
            }

            const metadataUpdate = {
                provider_callback: { remarks, third_party_trans_id: mpesa_receipt },
                paystack_callback: { remarks, third_party_trans_id: mpesa_receipt },
                mpesa_receipt,
                remarks
            };

            await client.query(
                `UPDATE withdrawal_requests 
                 SET status = $1, 
                     processed_at = NOW(),
                     provider_reference = COALESCE($2, provider_reference),
                     metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
                 WHERE id = $4`,
                [newStatus, provider_reference, JSON.stringify(metadataUpdate), requestId]
            );

            let newBalance = null;
            if (newStatus === 'failed' && !skipRefund) {
                // ENSURE: refundToWallet uses the SAME client for atomicity
                newBalance = await payoutService.refundToWallet(client, request);
                logger.info(`[WithdrawalService] Request ${requestId} failed. Refunded KES ${request.amount} to ${getEntityType(request)} ${request.seller_id || request.creator_id}`);
            } else if (newStatus === 'failed') {
                logger.warn(`[WithdrawalService] Request ${requestId} marked failed without refund: ${remarks || 'skipRefund=true'}`);
            } else if (newStatus === 'completed') {
                const reservedAmount = getWithdrawalReservedAmount(request);
                if (request.seller_id) {
                    await client.query(
                        `UPDATE sellers
                         SET withdrawal_reserved_balance = GREATEST(COALESCE(withdrawal_reserved_balance, 0) - $1, 0),
                             updated_at = NOW()
                         WHERE id = $2`,
                        [reservedAmount, request.seller_id]
                    );
                } else if (request.creator_id) {
                    await client.query(
                        `UPDATE creators
                         SET withdrawal_reserved_balance = GREATEST(COALESCE(withdrawal_reserved_balance, 0) - $1, 0),
                             updated_at = NOW()
                         WHERE id = $2`,
                        [reservedAmount, request.creator_id]
                    );
                } else if (request.buyer_id) {
                    await client.query(
                        `UPDATE buyers
                         SET refund_withdrawal_reserved_balance = GREATEST(COALESCE(refund_withdrawal_reserved_balance, 0) - $1, 0),
                             updated_at = NOW()
                         WHERE id = $2`,
                        [reservedAmount, request.buyer_id]
                    );
                }
            }

            const updatedEvent = await eventBus.enqueueInTransaction(client, AppEvents.WITHDRAWAL.UPDATED, {
                eventId: `withdrawal.updated:${request.id}:${newStatus}`,
                withdrawal: {
                    ...request,
                    status: newStatus,
                    provider_reference: provider_reference || request.provider_reference,
                    mpesa_receipt
                },
                seller: { whatsapp_number: request.entity_phone },
                reason: remarks,
                newBalance
            });
            updatedEventId = updatedEvent.eventId;

            if (isInternalTransaction) {
                await client.query('COMMIT');
                eventBus.dispatchAfterCommit(updatedEventId, 'WithdrawalService.updateStatusWithSideEffects');
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

    async recordProviderSuccessAfterRefund(requestId, providerPayload = {}, refs = {}) {
        return PayoutCallbackStateMachineService.recordProviderSuccessAfterRefund(requestId, providerPayload, refs);
    }

    async handleProviderCallback(providerPayload = {}, context = {}) {
        return PayoutCallbackStateMachineService.handleProviderCallback(providerPayload, context);
    }

    /**
     * Create and initiate a withdrawal request.
     *
     * @param {Object} params
     * @param {number}  params.entityId    - seller.id, creator.id, or buyer.id
     * @param {string}  params.entityType  - 'seller' | 'creator' | 'buyer_refund'
     * @returns {Promise<Object>} withdrawal_requests row
     */
    async createWithdrawalRequest({ entityId, entityType, amount, mpesaNumber, mpesaName, idempotencyKey }) {

        // --- Phase 1: Validate inputs before touching DB ---
        const validatedAmount = payoutService.validateAmount(amount);

        if (!['seller', 'creator', 'buyer_refund'].includes(entityType)) {
            throw new Error(`Invalid entityType: ${entityType}. Must be 'seller', 'creator', or 'buyer_refund'.`);
        }
        if (entityType === 'seller' && !mpesaName?.trim()) {
            throw new Error('M-Pesa registered name is required');
        }
        if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
            throw new Error('Idempotency-Key header is required');
        }
        const normalizedIdempotencyKey = idempotencyKey.trim().slice(0, 120);

        // --- Phase 2: DB transaction — lock, check, deduct, insert ---
        const client = await pool.connect();
        let request;
        let entity;
        let createdEventId = null;
        let normalizedPhone = null;

        try {
            await client.query('BEGIN');

            // Lock entity row and fetch current balance
            const entityQuery = entityType === 'buyer_refund'
                ? `SELECT id,
                          refunds AS balance,
                          refund_withdrawal_reserved_balance AS withdrawal_reserved_balance,
                          full_name,
                          mobile_payment,
                          whatsapp_number,
                          NULL::text AS mpesa_number,
                          'buyer_refund' AS entity_type
                   FROM buyers
                   WHERE id = $1
                   FOR UPDATE`
                : entityType === 'creator'
                ? `SELECT id, balance, withdrawal_reserved_balance,
                          CONCAT_WS(' ', first_name, last_name) AS full_name,
                          mpesa_number,
                          whatsapp_number,
                          'creator' AS entity_type
                   FROM creators
                   WHERE id = $1 AND status = 'active'
                   FOR UPDATE`
                : `SELECT id, balance, pending_settlement_balance, withdrawal_reserved_balance,
                          full_name,
                          whatsapp_number,
                          NULL::text AS mpesa_number,
                          'seller' AS entity_type
                   FROM sellers
                   WHERE id = $1
                   FOR UPDATE`;
            const { rows } = await client.query(entityQuery, [entityId]);
            const entityRow = rows[0];

            if (!entityRow) {
                throw new Error(`${entityType} not found or unauthorized`);
            }

            entity = entityRow;
            const payoutPhone = entityType === 'creator'
                ? entity.mpesa_number
                : entityType === 'buyer_refund'
                    ? entity.mobile_payment || entity.whatsapp_number
                    : mpesaNumber;
            normalizedPhone = payoutService.normalizePhoneForPayout(payoutPhone);
            const normalizedName = entityType === 'creator'
                ? getEntityLabel(entity)
                : entityType === 'buyer_refund'
                    ? getEntityLabel(entity)
                : mpesaName.trim();

            const { rows: existingRequests } = await client.query(
                `SELECT id, amount, seller_id, creator_id, buyer_id, mpesa_number, mpesa_name, status, idempotency_key,
                        provider_reference, metadata, created_at
                 FROM withdrawal_requests
                 WHERE ${entityType === 'buyer_refund' ? 'buyer_id' : entityType === 'creator' ? 'creator_id' : 'seller_id'} = $1
                   AND idempotency_key = $2
                 FOR UPDATE`,
                [entityId, normalizedIdempotencyKey]
            );
            if (existingRequests.length) {
                request = existingRequests[0];
                await client.query('COMMIT');
                logger.info('[WithdrawalService] Reused existing withdrawal request for idempotency key', {
                    entityId,
                    entityType,
                    withdrawalId: request.id
                });
                return request;
            }

            const withdrawalFee = Fees.calculateWithdrawalFee(validatedAmount);
            const deductionAmount = validatedAmount + withdrawalFee;

            const currentBalance = Number.parseFloat(entity.balance || 0);
            if (currentBalance < deductionAmount) {
                throw new Error(
                    `Insufficient balance. Available: KES ${currentBalance.toLocaleString()}, ` +
                    `Required: KES ${deductionAmount.toLocaleString()} including withdrawal charge. ` +
                    (entityType === 'seller'
                        ? 'Recent sales may still be preparing for withdrawal.'
                        : entityType === 'buyer_refund'
                            ? 'Some refund funds may already be reserved for another withdrawal.'
                            : 'Some earnings may already be reserved for another withdrawal.')
                );
            }

            // Reserve available funds while Paystack processes the transfer.
            const reserveSql = entityType === 'buyer_refund'
                ? `UPDATE buyers
                   SET refunds = refunds - $1,
                       refund_withdrawal_reserved_balance = COALESCE(refund_withdrawal_reserved_balance, 0) + $1,
                       updated_at = NOW()
                   WHERE id = $2`
                : entityType === 'creator'
                ? `UPDATE creators
                   SET balance = balance - $1,
                       withdrawal_reserved_balance = COALESCE(withdrawal_reserved_balance, 0) + $1,
                       updated_at = NOW()
                   WHERE id = $2`
                : `UPDATE sellers
                 SET balance = balance - $1,
                     withdrawal_reserved_balance = COALESCE(withdrawal_reserved_balance, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2`;
            await client.query(reserveSql, [deductionAmount, entityId]);

            const insertResult = await client.query(
                `INSERT INTO withdrawal_requests 
                    (seller_id, creator_id, buyer_id, amount, mpesa_number, mpesa_name, status, api_call_pending, idempotency_key, metadata, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'processing', TRUE, $7, $8::jsonb, NOW())
                 RETURNING id, amount, seller_id, creator_id, buyer_id, mpesa_number, mpesa_name, status, idempotency_key, metadata, created_at`,
                [
                    entityType === 'seller' ? entityId : null,
                    entityType === 'creator' ? entityId : null,
                    entityType === 'buyer_refund' ? entityId : null,
                    validatedAmount,
                    normalizedPhone,
                    normalizedName,
                    normalizedIdempotencyKey,
                    JSON.stringify({
                        withdrawal_fee: withdrawalFee,
                        total_deducted: deductionAmount,
                        entity_type: entityType,
                        source: entityType === 'buyer_refund' ? 'buyer_refund_withdrawal' : undefined
                    })
                ]
            );

            request = insertResult.rows[0];

            const createdEvent = await eventBus.enqueueInTransaction(client, AppEvents.WITHDRAWAL.CREATED, {
                eventId: `withdrawal.created:${request.id}`,
                withdrawal: request,
                seller: { whatsapp_number: getEntityPhone(entity) }
            });
            createdEventId = createdEvent.eventId;

            await client.query('COMMIT');
            logger.info(`[WithdrawalService] Request ${request.id} created.Deducted KES ${deductionAmount} from ${entityType} ${entityId}`);

        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('[WithdrawalService] Failed to create withdrawal request:', err.message);
            throw err;
        } finally {
            client.release();
        }

        // --- Phase 3: Call payout provider asynchronously ---
        // Do NOT await — return the request immediately to caller
        eventBus.dispatchAfterCommit(createdEventId, 'WithdrawalService.createWithdrawalRequest');

        this._callProviderAndUpdate(request, entity, validatedAmount, normalizedPhone)
            .catch(err => logger.error(`[WithdrawalService] _callProviderAndUpdate failed for request ${request.id}: `, err));

        return request;
    }

    /**
     * Private: call payout provider, store provider reference, or refund on failure.
     * Runs asynchronously after the DB transaction is committed.
     */
    async _callProviderAndUpdate(request, entity, amount, phone) {
        try {
            // IDEMPOTENCY CHECK: Before initiating a new payout, check if we already have a reference
            // and if that payout was already successfully processed by the provider.
            if (request.provider_reference) {
                try {
                    const statusCheck = await payoutService.checkPayoutStatus(request.provider_reference);
                    // Status strings may vary, 'success' and 'completed' are terminal success states
                    if (statusCheck.success && (statusCheck.status === 'success' || statusCheck.status === 'completed')) {
                        logger.info(`[WithdrawalService] Request ${request.id} already successful at payout provider (${statusCheck.status}). Syncing state.`);
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

            logger.info(`[WithdrawalService] Calling payout provider for request ${request.id}`);
            const attempt = await this.startPayoutProviderAttempt(request, entity, amount, phone);
            if (attempt.skip) {
                logger.warn(`[WithdrawalService] Skipping payout provider call for request ${request.id}: ${attempt.reason}`);
                if (attempt.providerReference && !request.provider_reference) {
                    await pool.query(
                        `UPDATE withdrawal_requests
                         SET provider_reference = $1,
                             api_call_pending = FALSE,
                             updated_at = NOW()
                         WHERE id = $2`,
                        [attempt.providerReference, request.id]
                    );
                }
                return;
            }

            const providerResponse = await payoutService.initiatePayout({
                phone_number: phone,
                amount,
                narration: `Withdrawal for ${getEntityLabel(entity)}`,
                idempotency_key: request.idempotency_key,
                recipient_name: request.mpesa_name || getEntityLabel(entity)
            });

            // Store the provider reference for webhook reconciliation.
            const reference = providerResponse.correlator_id
                || providerResponse.transaction_reference
                || providerResponse.provider_reference
                || providerResponse.reference;

            if (reference) {
                await pool.query(
                    `UPDATE withdrawal_requests 
                     SET provider_reference = $1, raw_response = $2, api_call_pending = FALSE
                     WHERE id = $3`,
                    [reference, JSON.stringify(providerResponse), request.id]
                );
                await this.markPayoutProviderAttemptAccepted(request.id, reference, providerResponse);
                logger.info(`[WithdrawalService] Request ${request.id} provider reference: ${reference}`);
            } else {
                // Provider accepted but returned no reference; log raw response.
                await pool.query(
                    'UPDATE withdrawal_requests SET raw_response = $1, api_call_pending = FALSE WHERE id = $2',
                    [JSON.stringify(providerResponse), request.id]
                );
                await this.markPayoutProviderAttemptAccepted(request.id, null, providerResponse);
                logger.warn(`[WithdrawalService] Request ${request.id}: payout provider returned no transaction_reference`, providerResponse);
            }

            try {
                await eventBus.enqueueAndDispatch(AppEvents.WITHDRAWAL.UPDATED, {
                    eventId: `withdrawal.updated:${request.id}:processing:${reference || 'no-reference'}`,
                    withdrawal: {
                        ...request,
                        status: 'processing',
                        provider_reference: reference || request.provider_reference
                    },
                    seller: entity,
                    reason: null,
                    newBalance: null
                }, 'WithdrawalService._callProviderAndUpdate');
            } catch (eventError) {
                logger.error('[WithdrawalService] Failed to persist provider-accepted withdrawal event', {
                    withdrawalId: request.id,
                    error: eventError.message
                });
            }

        } catch (apiError) {
            // Provider call failed; refund the balance and mark as failed when safe.
            logger.error(`[WithdrawalService] Payout provider API failed for request ${request.id}: ${apiError.message} `);
            const errorPayload = {
                message: apiError.message,
                code: apiError.code,
                status: apiError.response?.status,
                data: apiError.response?.data
            };
            const ambiguousProviderResult = isAmbiguousPayoutProviderError(apiError);
            const attemptMarker = ambiguousProviderResult
                ? this.markPayoutProviderAttemptAmbiguous(request.id, errorPayload)
                : this.markPayoutProviderAttemptFailed(request.id, errorPayload);
            await attemptMarker.catch(error => logger.error(`[WithdrawalService] Failed to persist payout attempt failure for ${request.id}:`, error.message));

            const client = await pool.connect();
            let failureEventId = null;
            try {
                await client.query('BEGIN');

                const { rows: [currentRequest] } = await client.query(
                    `SELECT *
                     FROM withdrawal_requests
                     WHERE id = $1
                     FOR UPDATE`,
                    [request.id]
                );

                if (!currentRequest) {
                    await client.query('ROLLBACK');
                    logger.error(`[WithdrawalService] Request ${request.id} disappeared before API failure handling.`);
                    return;
                }

                if (['completed', 'failed'].includes(currentRequest.status)) {
                    await client.query('ROLLBACK');
                    logger.warn(`[WithdrawalService] Request ${request.id} is already ${currentRequest.status}; skipping API-failure refund.`);
                    return;
                }

                if (currentRequest.provider_reference || ambiguousProviderResult) {
                    await client.query(
                        `UPDATE withdrawal_requests
                         SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                             api_call_pending = FALSE,
                             retry_started_at = NULL,
                             retry_worker_id = NULL,
                             updated_at = NOW()
                         WHERE id = $2`,
                        [
                            JSON.stringify({
                                api_error: apiError.message,
                                api_error_code: apiError.code,
                                provider_reference: currentRequest.provider_reference || null,
                                reconciliation_flag: currentRequest.provider_reference
                                    ? 'provider_reference_present_after_api_error'
                                    : 'provider_result_ambiguous_manual_review_required',
                                needs_manual_review: true
                            }),
                            request.id
                        ]
                    );
                    await client.query('COMMIT');
                    logger.warn(`[WithdrawalService] Request ${request.id} has ambiguous payout provider result; left processing for callback/manual review.`);
                    return;
                }

                if (currentRequest.seller_id) {
                    await client.query('SELECT id FROM sellers WHERE id = $1 FOR UPDATE', [currentRequest.seller_id]);
                } else if (currentRequest.creator_id) {
                    await client.query('SELECT id FROM creators WHERE id = $1 FOR UPDATE', [currentRequest.creator_id]);
                } else if (currentRequest.buyer_id) {
                    await client.query('SELECT id FROM buyers WHERE id = $1 FOR UPDATE', [currentRequest.buyer_id]);
                }
                const newBalance = await payoutService.refundToWallet(client, currentRequest);

                await client.query(
                    `UPDATE withdrawal_requests 
                     SET status = 'failed',
                         metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{api_error}', $1::jsonb),
                         processed_at = NOW(),
                         api_call_pending = FALSE
                     WHERE id = $2`,
                    [JSON.stringify(apiError.message), request.id]
                );

                const failureEvent = await eventBus.enqueueInTransaction(client, AppEvents.WITHDRAWAL.UPDATED, {
                    eventId: `withdrawal.updated:${request.id}:failed:api-call`,
                    withdrawal: {
                        ...currentRequest,
                        status: 'failed'
                    },
                    seller: entity,
                    reason: apiError.message,
                    newBalance
                });
                failureEventId = failureEvent.eventId;

                await client.query('COMMIT');
                logger.info(`[WithdrawalService] Request ${request.id} marked failed.Balance refunded.`);

                eventBus.dispatchAfterCommit(failureEventId, 'WithdrawalService._callProviderAndUpdate.failure');

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
        // WithdrawalRetryWorkerService owns retry_started_at/retry_worker_id leases with FOR UPDATE SKIP LOCKED.
        return WithdrawalRetryWorkerService.retryPendingApiCalls(this);
    }

    /**
     * Reconcile withdrawal requests stuck in 'processing' for over hoursAgo hours.
     * Called by cron job hourly.
     * Status checks are best-effort; unresolved stuck requests require manual review.
     */
    async reconcileStuckWithdrawals(hoursAgo = 2) {
        logger.info(`[WithdrawalService] Reconciling requests stuck > ${hoursAgo} hours`);

        const { rows: stuck } = await pool.query(
            `SELECT wr.*,
                    COALESCE(s.full_name, CONCAT_WS(' ', c.first_name, c.last_name), b.full_name) AS entity_name,
                    COALESCE(s.whatsapp_number, c.whatsapp_number, c.mpesa_number, b.whatsapp_number, b.mobile_payment) AS whatsapp_number
             FROM withdrawal_requests wr
             LEFT JOIN sellers s ON wr.seller_id = s.id
             LEFT JOIN creators c ON wr.creator_id = c.id
             LEFT JOIN buyers b ON wr.buyer_id = b.id
             WHERE wr.status = 'processing'
               AND wr.created_at < NOW() - ($1 * INTERVAL '1 hour')
               AND wr.created_at > NOW() - INTERVAL '48 hours'
             ORDER BY wr.created_at ASC
             LIMIT 50`,
            [hoursAgo]
        );

        logger.info(`[WithdrawalService] Found ${stuck.length} stuck request(s)`);

        for (const request of stuck) {
            try {
                if (!request.provider_reference) {
                    // No provider reference stored; provider API may have failed silently.
                    logger.warn(`[WithdrawalService] Request ${request.id} has no provider_reference.Marking needs_review.`);
                    await pool.query(
                        `UPDATE withdrawal_requests 
                         SET metadata = jsonb_set(COALESCE(metadata, '{}':: jsonb), '{reconciliation_flag}', '"no_provider_reference"':: jsonb)
                         WHERE id = $1`,
                        [request.id]
                    );
                    continue;
                }

                // Try provider reconciliation first; only flag for manual review when the provider cannot confirm a terminal state.
                try {
                    const statusCheck = await payoutService.checkPayoutStatus(request.provider_reference);
                    const statusPayload = statusCheck?.raw_response || statusCheck || {};
                    const providerAmount = Number.parseFloat(statusPayload.amount ?? statusCheck?.amount);
                    const expectedAmount = Number.parseFloat(request.amount || 0);

                    if (statusCheck?.success && providerPayloadIndicatesSuccess(statusPayload)) {
                        if (!Number.isNaN(providerAmount) && Math.abs(providerAmount - expectedAmount) > 0.01) {
                            await pool.query(
                                `UPDATE withdrawal_requests
                                 SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                                     updated_at = NOW()
                                 WHERE id = $2`,
                                [JSON.stringify({
                                    reconciliation_flag: 'provider_success_amount_mismatch',
                                    expected_amount: expectedAmount,
                                    provider_amount: providerAmount,
                                    needs_manual_review: true
                                }), request.id]
                            );
                            continue;
                        }

                        await this.updateStatusWithSideEffects(request.id, 'completed', {
                            provider_reference: request.provider_reference,
                            mpesa_receipt: statusPayload.third_party_trans_id || statusPayload.mpesa_receipt || null,
                            remarks: 'Payout confirmed by provider status reconciliation'
                        });
                        continue;
                    }

                    if (statusCheck?.success && providerPayloadIndicatesFailure(statusPayload)) {
                        await this.updateStatusWithSideEffects(request.id, 'failed', {
                            provider_reference: request.provider_reference,
                            remarks: statusPayload.message || 'Payout failed by provider status reconciliation'
                        });
                        continue;
                    }
                } catch (statusError) {
                    logger.warn(`[WithdrawalService] Status reconciliation unavailable for request ${request.id}: ${statusError.message}`);
                }

                await pool.query(
                    `UPDATE withdrawal_requests 
                     SET metadata = jsonb_set(
                COALESCE(metadata, '{}':: jsonb),
                '{reconciliation_flag}',
                '"needs_manual_review"':: jsonb
            )
                     WHERE id = $1 AND metadata ->> 'reconciliation_flag' IS NULL`,
                    [request.id]
                );

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
        const params = [sellerId];
        const clauses = ['wr.seller_id = $1'];

        if (status) {
            params.push(status);
            clauses.push(`wr.status = $${params.length}`);
        }

        const where = clauses.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            pool.query(
                `SELECT
               wr.id,
               wr.amount,
               wr.mpesa_number,
               wr.mpesa_name,
               wr.status,
               wr.provider_reference,
               wr.created_at,
               wr.processed_at,
               wr.processed_by,
               wr.updated_at,
               CASE
                 WHEN wr.status = 'failed'
                 THEN COALESCE(wr.metadata->>'api_error', wr.metadata->'provider_callback'->>'remarks', wr.metadata->'paystack_callback'->>'remarks', 'Unknown error')
                 ELSE NULL
               END AS failure_reason,
               COALESCE(
                 wr.mpesa_receipt,
                 CASE
                   WHEN wr.status = 'completed'
                   THEN COALESCE(wr.metadata->'provider_callback'->>'third_party_trans_id', wr.metadata->'paystack_callback'->>'third_party_trans_id')
                   ELSE NULL
                 END
               ) AS mpesa_receipt
             FROM withdrawal_requests wr
             WHERE ${where}
             ORDER BY wr.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset],
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM withdrawal_requests wr WHERE ${where}`,
                params,
            ),
        ]);

        return {
            rows: dataResult.rows,
            total: Number.parseInt(countResult.rows[0].total, 10),
        };
    }

    /**
     * Return paginated withdrawal history for a creator.
     * @param {number} creatorId
     * @param {{ limit: number, offset: number, status: string|null }} opts
     * @returns {Promise<{ rows: Object[], total: number }>}
     */
    async getWithdrawalsForCreator(creatorId, { limit = 10, offset = 0, status = null } = {}) {
        const params = [creatorId];
        const clauses = ['wr.creator_id = $1'];

        if (status) {
            params.push(status);
            clauses.push(`wr.status = $${params.length}`);
        }

        const where = clauses.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            pool.query(
                `SELECT
                   wr.id,
                   wr.amount,
                   (wr.metadata->>'withdrawal_fee')::numeric AS withdrawal_fee,
                   (wr.metadata->>'total_deducted')::numeric AS total_deducted,
                   wr.mpesa_number,
                   wr.mpesa_name,
                   wr.status,
                   wr.provider_reference,
                   wr.created_at,
                   wr.processed_at,
                   wr.processed_by,
                   wr.updated_at,
                   wr.mpesa_receipt
                 FROM withdrawal_requests wr
                 WHERE ${where}
                 ORDER BY wr.created_at DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM withdrawal_requests wr WHERE ${where}`,
                params
            )
        ]);

        return {
            rows: dataResult.rows,
            total: Number.parseInt(countResult.rows[0].total, 10)
        };
    }

    /**
     * Return paginated refund withdrawal history for a buyer.
     * @param {number} buyerId
     * @param {{ limit: number, offset: number, status: string|null }} opts
     * @returns {Promise<{ rows: Object[], total: number }>}
     */
    async getRefundWithdrawalsForBuyer(buyerId, { limit = 20, offset = 0, status = null } = {}) {
        const params = [buyerId];
        const clauses = ['wr.buyer_id = $1'];

        if (status) {
            params.push(status);
            clauses.push(`wr.status = $${params.length}`);
        }

        const where = clauses.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            pool.query(
                `SELECT
                   wr.id,
                   wr.amount,
                   (wr.metadata->>'withdrawal_fee')::numeric AS withdrawal_fee,
                   (wr.metadata->>'total_deducted')::numeric AS total_deducted,
                   wr.mpesa_number,
                   wr.mpesa_name,
                   wr.status,
                   wr.provider_reference,
                   wr.created_at,
                   wr.processed_at,
                   wr.processed_by,
                   wr.updated_at,
                   wr.mpesa_receipt
                 FROM withdrawal_requests wr
                 WHERE ${where}
                 ORDER BY wr.created_at DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM withdrawal_requests wr WHERE ${where}`,
                params
            )
        ]);

        return {
            rows: dataResult.rows,
            total: Number.parseInt(countResult.rows[0].total, 10)
        };
    }

    /**
     * Return a single withdrawal request, enforcing seller ownership.
     * @param {number} requestId
     * @param {number} sellerId
     * @returns {Promise<Object|null>}
     */
    async getWithdrawalById(requestId, sellerId) {
        const { rows } = await pool.query(
            `SELECT
           wr.id, wr.amount, wr.mpesa_number, wr.mpesa_name,
            wr.status, wr.provider_reference, wr.created_at,
            wr.processed_at, wr.processed_by, wr.mpesa_receipt, wr.updated_at, wr.metadata
         FROM withdrawal_requests wr
         WHERE wr.id = $1 AND wr.seller_id = $2`,
            [requestId, sellerId],
        );
        return rows[0] ?? null;
    }
}

export default new WithdrawalService();


