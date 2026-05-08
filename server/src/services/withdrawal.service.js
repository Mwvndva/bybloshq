import { pool } from '../shared/db/database.js';
import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import payoutService from './payout.service.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import { PaydErrorCodes } from '../shared/utils/PaydError.js';

const AMBIGUOUS_PAYOUT_ERROR_CODES = new Set([
    PaydErrorCodes.CONNECTION_FAILED,
    PaydErrorCodes.TIMEOUT,
    PaydErrorCodes.UNKNOWN_ERROR
]);

const PAYOUT_SUCCESS_STATUSES = new Set(['0', 'success', 'successful', 'completed', 'complete', 'paid', 'sent', 'delivered']);
const PAYOUT_FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'reversed', 'error']);

function normalizePayoutStatus(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function providerPayloadIndicatesSuccess(data = {}) {
    const normalizedStatus = normalizePayoutStatus(data.status || data.state || data.result || data.transaction_status);
    const resultCode = data.result_code ?? data.resultCode ?? data.code;
    return Number.parseInt(resultCode, 10) === 0
        || PAYOUT_SUCCESS_STATUSES.has(normalizedStatus)
        || data.success === true
        || String(data.success).toLowerCase() === 'true';
}

function providerPayloadIndicatesFailure(data = {}) {
    const normalizedStatus = normalizePayoutStatus(data.status || data.state || data.result || data.transaction_status);
    const resultCode = data.result_code ?? data.resultCode ?? data.code;
    const parsedResultCode = Number.parseInt(resultCode, 10);
    return (Number.isFinite(parsedResultCode) && parsedResultCode !== 0)
        || PAYOUT_FAILURE_STATUSES.has(normalizedStatus)
        || data.success === false
        || String(data.success).toLowerCase() === 'false';
}

function isAmbiguousPayoutProviderError(error) {
    const status = error?.statusCode || error?.response?.status;
    if (AMBIGUOUS_PAYOUT_ERROR_CODES.has(error?.code)) return true;
    if (!status && (error?.request || error?.code)) return true;
    return Number.isFinite(status) && status >= 500;
}

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
                narration: `Withdrawal for ${entity.full_name || 'ByblosHQ Seller'}`,
                idempotency_key: request.idempotency_key
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
                        (withdrawal_request_id, seller_id, idempotency_key, status, attempts, request_payload, last_attempt_at)
                     VALUES ($1, $2, $3, 'provider_call_started', 1, $4, NOW())`,
                    [request.id, request.seller_id, request.idempotency_key, JSON.stringify(requestPayload)]
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

        try {
            if (isInternalTransaction) {
                await client.query('BEGIN');
            }

            const { rows: [request] } = await client.query(
                `SELECT wr.*, s.whatsapp_number as entity_phone 
                 FROM withdrawal_requests wr 
                 LEFT JOIN sellers s ON wr.seller_id = s.id
                 WHERE wr.id = $1 FOR UPDATE OF wr`,
                [requestId]
            );

            if (!request) throw new Error('Withdrawal request not found');

            // FIXED BUG-WD-02: Lock sellers row to prevent race conditions during balance updates
            if (newStatus === 'failed') {
                await client.query('SELECT id FROM sellers WHERE id = $1 FOR UPDATE', [request.seller_id]);
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
                payd_callback: { remarks, third_party_trans_id: mpesa_receipt },
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
                logger.info(`[WithdrawalService] Request ${requestId} failed. Refunded KES ${request.amount} to seller ${request.seller_id}`);
            } else if (newStatus === 'failed') {
                logger.warn(`[WithdrawalService] Request ${requestId} marked failed without refund: ${remarks || 'skipRefund=true'}`);
            }

            if (isInternalTransaction) {
                await client.query('COMMIT');
            }

            setImmediate(() => {
                eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
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
            });

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
        const {
            providerReference = null,
            clientReference = null,
            providerAmount = null,
            remarks = 'Provider reported success after local refund/failure',
            mpesaReceipt = null
        } = refs;
        const referenceKey = String(providerReference || clientReference || `withdrawal:${requestId}`).slice(0, 255);
        const client = await pool.connect();
        let updatedRequest = null;
        let reconciliationEvent = null;

        try {
            await client.query('BEGIN');

            const { rows: [request] } = await client.query(
                `SELECT wr.*, s.whatsapp_number AS entity_phone
                 FROM withdrawal_requests wr
                 LEFT JOIN sellers s ON wr.seller_id = s.id
                 WHERE wr.id = $1
                 FOR UPDATE OF wr`,
                [requestId]
            );

            if (!request) {
                throw new Error('Withdrawal request not found');
            }

            if (!['failed', 'compensation_required'].includes(request.status)) {
                await client.query('ROLLBACK');
                logger.warn('[WithdrawalService] Ignored late-success compensation path for non-refunded withdrawal', {
                    requestId,
                    status: request.status
                });
                return request;
            }

            const metadata = {
                provider_success_after_refund: {
                    previous_status: request.status,
                    provider_reference: providerReference,
                    client_reference: clientReference,
                    provider_amount: providerAmount,
                    mpesa_receipt: mpesaReceipt,
                    remarks,
                    detected_at: new Date().toISOString()
                },
                manual_reconciliation_required: true,
                freeze_payout_retries: true
            };

            const eventInsert = await client.query(
                `INSERT INTO payout_reconciliation_events (
                     withdrawal_request_id,
                     seller_id,
                     event_type,
                     provider_reference,
                     client_reference,
                     reference_key,
                     amount,
                     payload,
                     metadata
                 )
                 VALUES ($1, $2, 'PROVIDER_SUCCESS_AFTER_REFUND', $3, $4, $5, $6, $7::jsonb, $8::jsonb)
                 ON CONFLICT (withdrawal_request_id, event_type, reference_key)
                 DO UPDATE SET
                     payload = EXCLUDED.payload,
                     metadata = payout_reconciliation_events.metadata || EXCLUDED.metadata
                 RETURNING *`,
                [
                    request.id,
                    request.seller_id,
                    providerReference,
                    clientReference,
                    referenceKey,
                    providerAmount,
                    JSON.stringify(providerPayload || {}),
                    JSON.stringify(metadata)
                ]
            );
            reconciliationEvent = eventInsert.rows[0];

            const { rows: [updated] } = await client.query(
                `UPDATE withdrawal_requests
                 SET status = 'compensation_required',
                     provider_reference = COALESCE($2, provider_reference),
                     mpesa_receipt = COALESCE($3, mpesa_receipt),
                     api_call_pending = FALSE,
                     retry_started_at = NULL,
                     retry_worker_id = NULL,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [
                    request.id,
                    providerReference,
                    mpesaReceipt,
                    JSON.stringify(metadata)
                ]
            );
            updatedRequest = updated;

            await client.query(
                `UPDATE payout_provider_attempts
                 SET provider_reference = COALESCE($2, provider_reference),
                     status = 'provider_success_after_refund',
                     response_payload = $3,
                     updated_at = NOW()
                 WHERE withdrawal_request_id = $1`,
                [request.id, providerReference, JSON.stringify(providerPayload || {})]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[WithdrawalService] Failed to record provider success after refund', {
                requestId,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }

        setImmediate(() => {
            eventBus.emit(AppEvents.WITHDRAWAL.COMPENSATION_REQUIRED, {
                eventId: `withdrawal.compensation_required:${requestId}:${referenceKey}`,
                withdrawal: updatedRequest,
                reconciliationEvent,
                reason: 'provider_success_after_refund'
            });
            eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
                eventId: `withdrawal.updated:${requestId}:compensation_required:${referenceKey}`,
                withdrawal: updatedRequest,
                reason: 'provider_success_after_refund',
                newBalance: null
            });
        });

        return updatedRequest;
    }

    async handleProviderCallback(providerPayload = {}, context = {}) {
        const data = providerPayload?.data || providerPayload || {};
        const transactionReference = data.transaction_reference || data.correlator_id || data.provider_reference || null;
        const clientReference = data.client_reference || data.idempotency_key || null;
        const isSuccess = providerPayloadIndicatesSuccess(data);
        const isFailure = providerPayloadIndicatesFailure(data);
        const finalStatus = isSuccess ? 'completed' : 'failed';
        const providerAmount = Number.parseFloat(data.amount);
        const mpesaReceipt = data.third_party_trans_id || data.mpesa_receipt || null;
        const remarks = data.remarks || data.message || (isSuccess ? 'Payout successful' : 'Payout failed');

        if (!transactionReference && !clientReference) {
            logger.warn('[WithdrawalService] Payout callback missing all references', { keys: Object.keys(data) });
            return { status: 'missing_reference', httpStatus: 400 };
        }

        const client = await pool.connect();
        const postCommitEvents = [];
        const postCommitEventIds = [];
        let withdrawalId = null;

        try {
            await client.query('BEGIN');

            const { rows: matchedRequests } = await client.query(
                `WITH matched_ids AS (
                    SELECT
                        wr.id,
                        MIN(CASE
                            WHEN wr.provider_reference = $1 THEN 0
                            WHEN ppa.provider_reference = $1 THEN 1
                            WHEN wr.idempotency_key = $2 THEN 2
                            WHEN ppa.idempotency_key = $2 THEN 3
                            ELSE 9
                        END) AS match_priority
                    FROM withdrawal_requests wr
                    LEFT JOIN payout_provider_attempts ppa ON ppa.withdrawal_request_id = wr.id
                    WHERE (
                           $1::text IS NOT NULL
                           AND (wr.provider_reference = $1 OR ppa.provider_reference = $1)
                        )
                        OR (
                           $2::text IS NOT NULL
                           AND (wr.idempotency_key = $2 OR ppa.idempotency_key = $2)
                        )
                    GROUP BY wr.id
                 )
                 SELECT wr.*, s.whatsapp_number AS entity_phone, matched_ids.match_priority
                 FROM matched_ids
                 JOIN withdrawal_requests wr ON wr.id = matched_ids.id
                 LEFT JOIN sellers s ON s.id = wr.seller_id
                 ORDER BY matched_ids.match_priority ASC, wr.created_at DESC
                 FOR UPDATE OF wr`,
                [transactionReference || null, clientReference || null]
            );

            if (matchedRequests.length > 1) {
                await this.recordAmbiguousPayoutCallbackLocked(client, matchedRequests, data, {
                    providerReference: transactionReference,
                    clientReference,
                    replayEventId: context.replayEventId,
                    providerAmount: Number.isNaN(providerAmount) ? null : providerAmount
                });
                await client.query('COMMIT');
                logger.error('[WithdrawalService] Ambiguous payout callback reference rejected before mutation', {
                    transactionReference,
                    clientReference,
                    matchedWithdrawalIds: matchedRequests.map(row => row.id)
                });
                return {
                    status: 'ambiguous_reference',
                    httpStatus: 202,
                    matchedWithdrawalIds: matchedRequests.map(row => row.id)
                };
            }

            const request = matchedRequests[0];

            if (!request) {
                await client.query('COMMIT');
                return { status: 'unmatched', httpStatus: 202 };
            }

            withdrawalId = request.id;
            const dbAmount = Number.parseFloat(request.amount || 0);

            if (!isSuccess && !isFailure) {
                await this.markPayoutCallbackRejected(client, request, 'unknown_provider_status', {
                    provider_reference: transactionReference,
                    client_reference: clientReference,
                    replay_event_id: context.replayEventId,
                    payload: data
                });
                await client.query('COMMIT');
                return { status: 'rejected_unknown_status', withdrawalId };
            }

            if (isSuccess && (Number.isNaN(providerAmount) || providerAmount <= 0)) {
                await this.markPayoutCallbackRejected(client, request, 'missing_valid_amount', {
                    provider_reference: transactionReference,
                    client_reference: clientReference,
                    replay_event_id: context.replayEventId,
                    payload: data
                });
                await client.query('COMMIT');
                return { status: 'rejected_missing_amount', withdrawalId };
            }

            if (isSuccess && Math.abs(providerAmount - dbAmount) > 0.01) {
                await this.markPayoutCallbackRejected(client, request, 'amount_mismatch', {
                    expected_amount: dbAmount,
                    provider_amount: providerAmount,
                    provider_reference: transactionReference,
                    client_reference: clientReference,
                    replay_event_id: context.replayEventId,
                    payload: data
                });
                await client.query('COMMIT');
                return { status: 'rejected_amount_mismatch', withdrawalId };
            }

            if (request.status === 'completed') {
                await this.updatePayoutProviderAttempt(client, request.id, transactionReference, 'callback_replayed_completed', data);
                await client.query('COMMIT');
                return { status: 'already_completed', withdrawalId };
            }

            if (request.status === 'compensation_required') {
                await this.updatePayoutProviderAttempt(client, request.id, transactionReference, isSuccess ? 'provider_success_after_refund' : 'callback_replayed_compensation_required', data);
                await client.query('COMMIT');
                return { status: 'compensation_required', withdrawalId };
            }

            if (isSuccess && request.status === 'failed') {
                const { updatedRequest, reconciliationEvent } = await this.recordProviderSuccessAfterRefundLocked(client, request, data, {
                    providerReference: transactionReference,
                    clientReference,
                    providerAmount,
                    remarks,
                    mpesaReceipt
                });
                const compensationEvent = await eventBus.enqueueInTransaction(
                    client,
                    AppEvents.WITHDRAWAL.COMPENSATION_REQUIRED,
                    {
                        eventId: `withdrawal.compensation_required:${request.id}:${transactionReference || clientReference}`,
                        withdrawal: updatedRequest,
                        reconciliationEvent,
                        reason: 'provider_success_after_refund'
                    }
                );
                const updatedEvent = await eventBus.enqueueInTransaction(
                    client,
                    AppEvents.WITHDRAWAL.UPDATED,
                    {
                        eventId: `withdrawal.updated:${request.id}:compensation_required:${transactionReference || clientReference}`,
                        withdrawal: updatedRequest,
                        seller: { whatsapp_number: request.entity_phone },
                        reason: 'provider_success_after_refund',
                        newBalance: null
                    }
                );
                postCommitEventIds.push(compensationEvent.eventId, updatedEvent.eventId);
                await client.query('COMMIT');
                postCommitEventIds.forEach(eventId => setImmediate(() => {
                    eventBus.dispatchOutboxEvent(eventId)
                        .catch(error => logger.error('[WithdrawalService] Durable withdrawal event dispatch failed', { eventId, error: error.message }));
                }));
                return { status: 'compensation_required', withdrawalId };
            }

            if (request.status !== 'processing') {
                await this.updatePayoutProviderAttempt(client, request.id, transactionReference, `callback_ignored_${request.status}`, data);
                await client.query('COMMIT');
                return { status: `ignored_${request.status}`, withdrawalId };
            }

            let newBalance = null;
            if (!isSuccess) {
                await client.query('SELECT id FROM sellers WHERE id = $1 FOR UPDATE', [request.seller_id]);
            }

            const { rows: [updatedRequest] } = await client.query(
                `UPDATE withdrawal_requests
                 SET status = $1,
                     processed_at = NOW(),
                     provider_reference = COALESCE($2, provider_reference),
                     mpesa_receipt = COALESCE($3, mpesa_receipt),
                     api_call_pending = FALSE,
                     retry_started_at = NULL,
                     retry_worker_id = NULL,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                     updated_at = NOW()
                 WHERE id = $5
                 RETURNING *`,
                [
                    finalStatus,
                    transactionReference,
                    mpesaReceipt,
                    JSON.stringify({
                        payd_callback: {
                            remarks,
                            third_party_trans_id: mpesaReceipt,
                            replay_event_id: context.replayEventId,
                            provider_reference: transactionReference,
                            client_reference: clientReference,
                            processed_at: new Date().toISOString()
                        }
                    }),
                    request.id
                ]
            );

            if (!isSuccess) {
                newBalance = await payoutService.refundToWallet(client, request);
            }

            await this.updatePayoutProviderAttempt(client, request.id, transactionReference, finalStatus, data);
            const updatedEvent = await eventBus.enqueueInTransaction(
                client,
                AppEvents.WITHDRAWAL.UPDATED,
                {
                    eventId: `withdrawal.updated:${request.id}:${finalStatus}`,
                    withdrawal: updatedRequest,
                    seller: { whatsapp_number: request.entity_phone },
                    reason: remarks,
                    newBalance
                }
            );
            const terminalEvent = await eventBus.enqueueInTransaction(
                client,
                isSuccess ? AppEvents.WITHDRAWAL.COMPLETED : AppEvents.WITHDRAWAL.FAILED,
                {
                    eventId: `withdrawal.${finalStatus}:${request.id}:${transactionReference || clientReference}`,
                    withdrawal: updatedRequest,
                    reason: remarks
                }
            );
            postCommitEventIds.push(updatedEvent.eventId, terminalEvent.eventId);
            await client.query('COMMIT');

            postCommitEventIds.forEach(eventId => setImmediate(() => {
                eventBus.dispatchOutboxEvent(eventId)
                    .catch(error => logger.error('[WithdrawalService] Durable withdrawal event dispatch failed', { eventId, error: error.message }));
            }));

            return { status: finalStatus, withdrawalId };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[WithdrawalService] handleProviderCallback failed', {
                withdrawalId,
                transactionReference,
                clientReference,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    }

    async recordAmbiguousPayoutCallbackLocked(client, matches, providerPayload = {}, refs = {}) {
        const referenceKey = String(refs.providerReference || refs.clientReference || refs.replayEventId || 'unknown').slice(0, 255);
        const metadata = {
            provider_reference: refs.providerReference || null,
            client_reference: refs.clientReference || null,
            replay_event_id: refs.replayEventId || null,
            matched_withdrawal_ids: matches.map(row => row.id),
            matched_seller_ids: matches.map(row => row.seller_id),
            detected_at: new Date().toISOString()
        };

        await client.query(
            `INSERT INTO payout_reconciliation_events (
                 withdrawal_request_id,
                 seller_id,
                 event_type,
                 provider_reference,
                 client_reference,
                 reference_key,
                 amount,
                 payload,
                 metadata
             )
             SELECT NULL, NULL, 'PAYOUT_REFERENCE_AMBIGUOUS', $1, $2, $3, $4, $5::jsonb, $6::jsonb
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM payout_reconciliation_events
                 WHERE withdrawal_request_id IS NULL
                   AND event_type = 'PAYOUT_REFERENCE_AMBIGUOUS'
                   AND reference_key = $3
             )`,
            [
                refs.providerReference || null,
                refs.clientReference || null,
                referenceKey,
                refs.providerAmount,
                JSON.stringify(providerPayload || {}),
                JSON.stringify(metadata)
            ]
        );
    }

    async updatePayoutProviderAttempt(client, requestId, providerReference, status, payload) {
        await client.query(
            `UPDATE payout_provider_attempts
             SET provider_reference = COALESCE($2, provider_reference),
                 status = $3,
                 response_payload = $4,
                 updated_at = NOW()
             WHERE withdrawal_request_id = $1`,
            [requestId, providerReference || null, status, JSON.stringify(payload || {})]
        );
    }

    async markPayoutCallbackRejected(client, request, reason, metadata) {
        await client.query(
            `UPDATE withdrawal_requests
             SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                 api_call_pending = FALSE,
                 retry_started_at = NULL,
                 retry_worker_id = NULL,
                 updated_at = NOW()
             WHERE id = $1
               AND status = 'processing'`,
            [
                request.id,
                JSON.stringify({
                    payout_callback_rejected: reason,
                    needs_manual_review: true,
                    ...metadata
                })
            ]
        );
        await this.updatePayoutProviderAttempt(client, request.id, metadata.provider_reference || null, 'callback_amount_rejected', metadata.payload || {});
    }

    async recordProviderSuccessAfterRefundLocked(client, request, providerPayload = {}, refs = {}) {
        const {
            providerReference = null,
            clientReference = null,
            providerAmount = null,
            remarks = 'Provider reported success after local refund/failure',
            mpesaReceipt = null
        } = refs;
        const referenceKey = String(providerReference || clientReference || `withdrawal:${request.id}`).slice(0, 255);
        const metadata = {
            provider_success_after_refund: {
                previous_status: request.status,
                provider_reference: providerReference,
                client_reference: clientReference,
                provider_amount: providerAmount,
                mpesa_receipt: mpesaReceipt,
                remarks,
                detected_at: new Date().toISOString()
            },
            manual_reconciliation_required: true,
            freeze_payout_retries: true
        };

        const eventInsert = await client.query(
            `INSERT INTO payout_reconciliation_events (
                 withdrawal_request_id,
                 seller_id,
                 event_type,
                 provider_reference,
                 client_reference,
                 reference_key,
                 amount,
                 payload,
                 metadata
             )
             VALUES ($1, $2, 'PROVIDER_SUCCESS_AFTER_REFUND', $3, $4, $5, $6, $7::jsonb, $8::jsonb)
             ON CONFLICT (withdrawal_request_id, event_type, reference_key)
             DO UPDATE SET
                 payload = EXCLUDED.payload,
                 metadata = payout_reconciliation_events.metadata || EXCLUDED.metadata
             RETURNING *`,
            [
                request.id,
                request.seller_id,
                providerReference,
                clientReference,
                referenceKey,
                providerAmount,
                JSON.stringify(providerPayload || {}),
                JSON.stringify(metadata)
            ]
        );

        const { rows: [updatedRequest] } = await client.query(
            `UPDATE withdrawal_requests
             SET status = 'compensation_required',
                 provider_reference = COALESCE($2, provider_reference),
                 mpesa_receipt = COALESCE($3, mpesa_receipt),
                 api_call_pending = FALSE,
                 retry_started_at = NULL,
                 retry_worker_id = NULL,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [request.id, providerReference, mpesaReceipt, JSON.stringify(metadata)]
        );

        await this.updatePayoutProviderAttempt(client, request.id, providerReference, 'provider_success_after_refund', providerPayload);
        return { updatedRequest, reconciliationEvent: eventInsert.rows[0] };
    }

    /**
     * Create and initiate a withdrawal request.
     *
     * @param {Object} params
     * @param {number}  params.entityId    - seller.id
     * @param {string}  params.entityType  - 'seller'
     * @returns {Promise<Object>} withdrawal_requests row
     */
    async createWithdrawalRequest({ entityId, entityType, amount, mpesaNumber, mpesaName, idempotencyKey }) {

        // --- Phase 1: Validate inputs before touching DB ---
        const validatedAmount = payoutService.validateAmount(amount);
        const normalizedPhone = payoutService.normalizePhoneForPayout(mpesaNumber);

        if (!mpesaName?.trim()) {
            throw new Error('M-Pesa registered name is required');
        }
        if (entityType !== 'seller') {
            throw new Error(`Invalid entityType: ${entityType}. Must be 'seller'.`);
        }
        if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
            throw new Error('Idempotency-Key header is required');
        }
        const normalizedIdempotencyKey = idempotencyKey.trim().slice(0, 120);

        // --- Phase 2: DB transaction — lock, check, deduct, insert ---
        const client = await pool.connect();
        let request;
        let entity;

        try {
            await client.query('BEGIN');

            // Lock entity row and fetch current balance
            const { rows } = await client.query(
                'SELECT id, balance, full_name, whatsapp_number FROM sellers WHERE id = $1 FOR UPDATE',
                [entityId]
            );
            const entityRow = rows[0];

            if (!entityRow) {
                throw new Error(`${entityType} not found or unauthorized`);
            }

            entity = entityRow;

            const { rows: existingRequests } = await client.query(
                `SELECT id, amount, seller_id, mpesa_number, mpesa_name, status, idempotency_key,
                        provider_reference, created_at
                 FROM withdrawal_requests
                 WHERE seller_id = $1
                   AND idempotency_key = $2
                 FOR UPDATE`,
                [entityId, normalizedIdempotencyKey]
            );
            if (existingRequests.length) {
                request = existingRequests[0];
                await client.query('COMMIT');
                logger.info('[WithdrawalService] Reused existing withdrawal request for idempotency key', {
                    sellerId: entityId,
                    withdrawalId: request.id
                });
                return request;
            }

            let deductionAmount = validatedAmount;

            const currentBalance = Number.parseFloat(entity.balance || 0);
            if (currentBalance < deductionAmount) {
                throw new Error(
                    `Insufficient balance. Available: KES ${currentBalance.toLocaleString()}, ` +
                    `Required: KES ${deductionAmount.toLocaleString()}`
                );
            }

            // Deduct from entity balance
            await client.query(
                `UPDATE sellers SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
                [deductionAmount, entityId]
            );

            const insertResult = await client.query(
                `INSERT INTO withdrawal_requests 
                    (seller_id, amount, mpesa_number, mpesa_name, status, api_call_pending, idempotency_key, created_at)
                 VALUES ($1, $2, $3, $4, 'processing', TRUE, $5, NOW())
                 RETURNING id, amount, seller_id, mpesa_number, mpesa_name, status, idempotency_key, created_at`,
                [
                    entityId,
                    validatedAmount,
                    normalizedPhone,
                    mpesaName.trim(),
                    normalizedIdempotencyKey
                ]
            );

            request = insertResult.rows[0];

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
        setImmediate(() => {
            eventBus.emit(AppEvents.WITHDRAWAL.CREATED, {
                eventId: `withdrawal.created:${request.id}`,
                withdrawal: request,
                seller: entity
            });
        });

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
            const attempt = await this.startPayoutProviderAttempt(request, entity, amount, phone);
            if (attempt.skip) {
                logger.warn(`[WithdrawalService] Skipping Payd call for request ${request.id}: ${attempt.reason}`);
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

            const paydResponse = await payoutService.initiatePayout({
                phone_number: phone,
                amount,
                narration: `Withdrawal for ${entity.full_name || 'ByblosHQ Seller'}`,
                idempotency_key: request.idempotency_key // PASS IDEMPOTENCY KEY
            });

            // Payd withdrawal response uses 'correlator_id'; the webhook uses 'transaction_reference'
            // They are the same value — store correlator_id as our provider_reference
            const reference = paydResponse.correlator_id || paydResponse.transaction_reference

            if (reference) {
                await pool.query(
                    `UPDATE withdrawal_requests 
                     SET provider_reference = $1, raw_response = $2, api_call_pending = FALSE
                     WHERE id = $3`,
                    [reference, JSON.stringify(paydResponse), request.id]
                );
                await this.markPayoutProviderAttemptAccepted(request.id, reference, paydResponse);
                logger.info(`[WithdrawalService] Request ${request.id} → Payd correlator_id: ${reference}`);
            } else {
                // Payd accepted but returned no reference — log raw response
                await pool.query(
                    'UPDATE withdrawal_requests SET raw_response = $1, api_call_pending = FALSE WHERE id = $2',
                    [JSON.stringify(paydResponse), request.id]
                );
                await this.markPayoutProviderAttemptAccepted(request.id, null, paydResponse);
                logger.warn(`[WithdrawalService] Request ${request.id}: Payd returned no transaction_reference`, paydResponse);
            }

            setImmediate(() => {
                eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
                    eventId: `withdrawal.updated:${request.id}:processing:${reference || 'no-reference'}`,
                    withdrawal: {
                        ...request,
                        status: 'processing',
                        provider_reference: reference || request.provider_reference
                    },
                    seller: entity,
                    reason: null,
                    newBalance: null
                });
            });

        } catch (apiError) {
            // Payd API call failed — refund the balance and mark as failed
            logger.error(`[WithdrawalService] Payd API failed for request ${request.id}: ${apiError.message} `);
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
                    logger.warn(`[WithdrawalService] Request ${request.id} has ambiguous Payd result; left processing for callback/manual review.`);
                    return;
                }

                await client.query('SELECT id FROM sellers WHERE id = $1 FOR UPDATE', [currentRequest.seller_id]);
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

                await client.query('COMMIT');
                logger.info(`[WithdrawalService] Request ${request.id} marked failed.Balance refunded.`);

                setImmediate(() => {
                    eventBus.emit(AppEvents.WITHDRAWAL.UPDATED, {
                        eventId: `withdrawal.updated:${request.id}:failed:api-call`,
                        withdrawal: {
                            ...currentRequest,
                            status: 'failed'
                        },
                        seller: entity,
                        reason: apiError.message,
                        newBalance
                    });
                });

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
            const workerId = `withdrawal-retry-${process.pid}-${Date.now()}-${crypto.randomUUID()}`;
            const claimClient = await pool.connect();
            let pending = [];
            try {
                await claimClient.query('BEGIN');
                const { rows } = await claimClient.query(
                    `WITH claimed AS (
                       SELECT wr.id
                       FROM withdrawal_requests wr
                       WHERE wr.status = 'processing'
                         AND wr.api_call_pending = TRUE
                         AND wr.created_at > NOW() - INTERVAL '7 days'
                         AND (
                           wr.retry_started_at IS NULL
                           OR wr.retry_started_at < NOW() - INTERVAL '10 minutes'
                         )
                       ORDER BY wr.created_at ASC
                       LIMIT 25
                       FOR UPDATE SKIP LOCKED
                     )
                     UPDATE withdrawal_requests wr
                     SET retry_started_at = NOW(),
                         retry_worker_id = $1,
                         updated_at = NOW()
                     FROM claimed
                     WHERE wr.id = claimed.id
                     RETURNING wr.*`,
                    [workerId]
                );
                if (rows.length) {
                    const ids = rows.map(row => row.id);
                    const joined = await claimClient.query(
                        `SELECT wr.*, s.full_name, s.whatsapp_number
                         FROM withdrawal_requests wr
                         JOIN sellers s ON wr.seller_id = s.id
                         WHERE wr.id = ANY($1::int[])`,
                        [ids]
                    );
                    pending = joined.rows;
                }
                await claimClient.query('COMMIT');
            } catch (claimErr) {
                await claimClient.query('ROLLBACK').catch(() => {});
                throw claimErr;
            } finally {
                claimClient.release();
            }

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

                await pool.query(
                    `UPDATE withdrawal_requests
                     SET retry_started_at = NULL,
                         retry_worker_id = NULL,
                         updated_at = NOW()
                     WHERE id = $1
                       AND retry_worker_id = $2
                       AND api_call_pending = TRUE`,
                    [request.id, workerId]
                );

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

        const { rows: stuck } = await pool.query(
            `SELECT wr.*, s.full_name as seller_name, s.whatsapp_number
             FROM withdrawal_requests wr
             LEFT JOIN sellers s ON wr.seller_id = s.id
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
                    // No correlator_id stored — Payd API may have failed silently
                    logger.warn(`[WithdrawalService] Request ${request.id} has no provider_reference.Marking needs_review.`);
                    await pool.query(
                        `UPDATE withdrawal_requests 
                         SET metadata = jsonb_set(COALESCE(metadata, '{}':: jsonb), '{reconciliation_flag}', '"no_provider_reference"':: jsonb)
                         WHERE id = $1`,
                        [request.id]
                    );
                    continue;
                }

                // Try provider reconciliation first; only flag for manual review when Payd cannot confirm a terminal state.
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
                 THEN COALESCE(wr.metadata->>'api_error', wr.metadata->'payd_callback'->>'remarks', 'Unknown error')
                 ELSE NULL
               END AS failure_reason,
               COALESCE(
                 wr.mpesa_receipt,
                 CASE
                   WHEN wr.status = 'completed'
                   THEN wr.metadata->'payd_callback'->>'third_party_trans_id'
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


