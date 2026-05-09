import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import payoutService from './payout.service.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

const PAYOUT_SUCCESS_STATUSES = new Set(['0', 'success', 'successful', 'completed', 'complete', 'paid', 'sent', 'delivered']);
const PAYOUT_FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'rejected', 'reversed', 'error']);

function normalizePayoutStatus(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function providerPayloadIndicatesSuccess(data = {}) {
    const normalizedStatus = normalizePayoutStatus(data.status || data.state || data.result || data.transaction_status);
    const resultCode = data.result_code ?? data.resultCode ?? data.code;
    return Number.parseInt(resultCode, 10) === 0
        || PAYOUT_SUCCESS_STATUSES.has(normalizedStatus)
        || data.success === true
        || String(data.success).toLowerCase() === 'true';
}

export function providerPayloadIndicatesFailure(data = {}) {
    const normalizedStatus = normalizePayoutStatus(data.status || data.state || data.result || data.transaction_status);
    const resultCode = data.result_code ?? data.resultCode ?? data.code;
    const parsedResultCode = Number.parseInt(resultCode, 10);
    return (Number.isFinite(parsedResultCode) && parsedResultCode !== 0)
        || PAYOUT_FAILURE_STATUSES.has(normalizedStatus)
        || data.success === false
        || String(data.success).toLowerCase() === 'false';
}

class PayoutCallbackStateMachineService {
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
            logger.warn('[PayoutCallbackStateMachine] Payout callback missing all references', { keys: Object.keys(data) });
            return { status: 'missing_reference', httpStatus: 400 };
        }

        const client = await pool.connect();
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
                logger.error('[PayoutCallbackStateMachine] Ambiguous payout callback reference rejected before mutation', {
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
                this.dispatchPostCommitEvents(postCommitEventIds);
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

            this.dispatchPostCommitEvents(postCommitEventIds);

            return { status: finalStatus, withdrawalId };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[PayoutCallbackStateMachine] handleProviderCallback failed', {
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
        const postCommitEventIds = [];

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
                logger.warn('[PayoutCallbackStateMachine] Ignored late-success compensation path for non-refunded withdrawal', {
                    requestId,
                    status: request.status
                });
                return request;
            }

            ({ updatedRequest, reconciliationEvent } = await this.recordProviderSuccessAfterRefundLocked(client, request, providerPayload, {
                providerReference,
                clientReference,
                providerAmount,
                remarks,
                mpesaReceipt
            }));

            const compensationEvent = await eventBus.enqueueInTransaction(
                client,
                AppEvents.WITHDRAWAL.COMPENSATION_REQUIRED,
                {
                    eventId: `withdrawal.compensation_required:${requestId}:${referenceKey}`,
                    withdrawal: updatedRequest,
                    reconciliationEvent,
                    reason: 'provider_success_after_refund'
                }
            );
            const updatedEvent = await eventBus.enqueueInTransaction(
                client,
                AppEvents.WITHDRAWAL.UPDATED,
                {
                    eventId: `withdrawal.updated:${requestId}:compensation_required:${referenceKey}`,
                    withdrawal: updatedRequest,
                    seller: { whatsapp_number: request.entity_phone },
                    reason: 'provider_success_after_refund',
                    newBalance: null
                }
            );
            postCommitEventIds.push(compensationEvent.eventId, updatedEvent.eventId);

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[PayoutCallbackStateMachine] Failed to record provider success after refund', {
                requestId,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }

        this.dispatchPostCommitEvents(postCommitEventIds);

        return updatedRequest;
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

    dispatchPostCommitEvents(eventIds) {
        eventBus.dispatchManyAfterCommit(eventIds, 'PayoutCallbackStateMachine');
    }
}

export default new PayoutCallbackStateMachineService();
