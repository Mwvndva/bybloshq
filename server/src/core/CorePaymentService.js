/**
 * CorePaymentService — Unified Facade for Payment Operations
 *
 * CRITICAL FINTECH FIX:
 *   Previously, payment status and order status were updated in SEPARATE
 *   transaction blocks. A server crash between them could leave an order
 *   in "Paid but Unconfirmed" limbo.
 *
 *   This service fixes that with ONE atomic transaction:
 *     BEGIN
 *       UPDATE payments SET status = 'COMPLETED' ...
     *       UPDATE product_orders SET status = 'PAID' ...
 *     COMMIT
 *
 * NO-TOUCH ZONES preserved:
 *   - Redis locking (lock acquisition logic untouched)
 *   - HMAC webhook verification (fail-closed on raw body)
 *   - Idempotency checks (FOR UPDATE patterns kept)
 *   - All payout / withdrawal logic (delegated to legacy)
 */

import { pool } from '../shared/db/database.js';
import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';
import { getProviderPayloadData, normalizeProviderReference } from '../shared/utils/providerReference.js';
import { normalizeProviderAmount, normalizeProviderPaymentStatus } from '../shared/utils/paymentStatusNormalizer.js';
import { normalizePaystackChargePayload } from '../shared/utils/paystackPaymentNormalizer.js';
import { releaseOrderReservations } from '../shared/utils/reservationRelease.js';
import { PaymentStatus } from '../shared/constants/enums.js';

const FULFILLABLE_ORDER_STATUSES = new Set(['CREATED', 'RESERVED', 'HELD', 'PAYMENT_PENDING', 'PENDING']);
const PAID_TERMINAL_ORDER_STATUSES = new Set([
    'PAID',
    'AWAITING_SELLER_ACTION',
    'FULFILLING',
    'READY_FOR_BUYER',
    'PROCESSING',
    'FULFILLMENT_PENDING',
    'FULFILLED',
    'DELIVERED',
    'BOOKED',
    'COMPLETED'
]);
const CANNOT_FULFILL_ORDER_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'REFUNDED', 'FAILED', 'MANUAL_REVIEW', 'COMPENSATION_REQUIRED']);
const PAYMENT_AMOUNT_TOLERANCE_KES = 1;

function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function extractPaymentReference(providerPayload = {}, explicitReference) {
    return normalizeProviderReference(providerPayload, explicitReference);
}

function extractReceipt(providerPayload = {}) {
    const data = getProviderPayloadData(providerPayload);
    return data.third_party_trans_id
        || data.mpesa_receipt
        || data.mpesaReceipt
        || data.receipt
        || data.receipt_number
        || null;
}

function normalizeReceiptForColumn(value) {
    if (value === null || value === undefined) return null;
    const receipt = String(value).trim();
    if (!receipt) return null;
    return receipt.length <= 50 ? receipt : null;
}

function buildPaymentReceiptId(paymentRow = {}) {
    return `BYB-RCPT-${String(paymentRow.id).padStart(8, '0')}`;
}

function resolveOrderIdFromMetadata(metadata = {}) {
    const meta = parseJson(metadata);
    const rawOrderId = meta.order_id ?? meta.product_order_id ?? null;
    if (rawOrderId === null || rawOrderId === undefined || rawOrderId === '') {
        return null;
    }

    const orderId = Number.parseInt(rawOrderId, 10);
    return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}

function isSellerPickupFeePayment(metadata = {}) {
    const meta = parseJson(metadata);
    return meta.payment_purpose === 'seller_pickup_fee'
        || meta.logistics_payment_type === 'seller_pickup_fee';
}

function resolveCustomProductionPatch(orderRow = {}, paidAt = new Date()) {
    const metadata = parseJson(orderRow.metadata);
    const customProduct = metadata.custom_product || {};
    const preHandoffSla = metadata.pre_handoff_sla || null;
    const hasCustomProduct = customProduct.is_custom_product === true;
    const hasPreHandoffSla = preHandoffSla?.type === 'custom_production' || preHandoffSla?.type === 'import_waiting';
    if (!hasCustomProduct && !hasPreHandoffSla) return null;

    const readyDays = Number.parseInt(
        preHandoffSla?.ready_days
        || preHandoffSla?.production_days
        || preHandoffSla?.import_days
        || customProduct.production_days,
        10
    );
    if (!Number.isInteger(readyDays) || readyDays < 1 || readyDays > 30) return null;

    const productionDeadline = new Date(paidAt.getTime() + readyDays * 24 * 60 * 60 * 1000);
    const graceDeadline = new Date(productionDeadline.getTime() + 24 * 60 * 60 * 1000);
    const nextPreHandoffSla = preHandoffSla ? {
        ...preHandoffSla,
        ready_deadline_at: productionDeadline.toISOString(),
        ready_grace_deadline_at: graceDeadline.toISOString()
    } : null;

    return {
        productionDeadline,
        graceDeadline,
        metadataPatch: {
            ...(nextPreHandoffSla ? { pre_handoff_sla: nextPreHandoffSla } : {}),
            custom_product: hasCustomProduct ? {
                ...customProduct,
                production_deadline_at: productionDeadline.toISOString(),
                production_grace_deadline_at: graceDeadline.toISOString()
            } : customProduct
        }
    };
}

async function recordFraudEvent(event) {
    try {
        await pool.query(
            `INSERT INTO fraud_events (
                 payment_id,
                 order_id,
                 provider_reference,
                 event_type,
                 expected_amount,
                 provider_amount,
                 payload,
                 details
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
            [
                event.paymentId || null,
                event.orderId || null,
                event.providerReference || null,
                event.eventType,
                event.expectedAmount ?? null,
                event.providerAmount ?? null,
                JSON.stringify(event.payload || {}),
                JSON.stringify(event.details || {})
            ]
        );
    } catch (error) {
        logger.error('[CorePaymentService] Failed to persist fraud event', {
            original: event,
            error: error.message
        });
    }
}

async function findPaymentByInternalId(client, paymentId) {
    const numericPaymentId = Number.parseInt(paymentId, 10);
    if (!Number.isSafeInteger(numericPaymentId) || numericPaymentId <= 0) {
        throw new Error('Internal payment lookup requires a positive numeric id');
    }

    const { rows } = await client.query(
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
        [numericPaymentId]
    );
    return rows[0] || null;
}

async function findPaymentByProviderReference(client, providerReference, source = 'unknown') {
    const normalizedReference = String(providerReference || '').trim();
    if (!normalizedReference) {
        throw new Error('Provider payment lookup requires a provider reference');
    }

    const { rows } = await client.query(
        `SELECT *
         FROM payments
         WHERE provider_reference = $1
            OR api_ref = $1
            OR invoice_id = $1
         ORDER BY id ASC
         FOR UPDATE`,
        [normalizedReference]
    );

    if (rows.length > 1) {
        logger.error('[CorePaymentService] Ambiguous provider payment reference rejected', {
            providerReference: normalizedReference,
            source,
            matchedPaymentIds: rows.map(row => row.id),
            duplicateProviderRefs: rows.map(row => ({
                payment_id: row.id,
                provider_reference: row.provider_reference,
                api_ref: row.api_ref,
                invoice_id: row.invoice_id
            }))
        });
        throw new Error('Ambiguous provider payment reference');
    }

    return rows[0] || null;
}

function requireValidWebhookSignature(signature, rawBody) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!signature || !rawBody || !secret) {
        logger.error('[CorePaymentService] Rejected Paystack webhook with missing signature, raw body, or secret');
        return false;
    }

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
    const expected = crypto
        .createHmac('sha512', secret)
        .update(bodyBuffer)
        .digest('hex');

    const received = String(signature).trim();
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length) {
        logger.error('[CorePaymentService] Rejected Paystack webhook with malformed signature');
        return false;
    }

    const valid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!valid) {
        logger.error('[CorePaymentService] Rejected Paystack webhook with invalid HMAC signature');
    }
    return valid;
}

const CorePaymentService = {

    /**
     * Core-owned product checkout initiation boundary.
     *
     * Phase 1/2 centralization note:
     * - Controllers keep calling PaymentService for compatibility.
     * - PaymentService.initiateProductPayment delegates here.
     * - The current implementation lives in PaymentLifecycleService as
     *   initiateProductPaymentLegacy until helper dependencies are moved into
     *   focused Core collaborators without changing money behavior.
     */
    async initiateProductPayment(normalizedOrder) {
        const { default: paymentLifecycleService } = await import('../services/paymentLifecycle.service.js');
        return paymentLifecycleService.initiateProductPaymentLegacy(normalizedOrder);
    },

    async initiatePayment(paymentData) {
        throw new Error('CorePaymentService.initiatePayment is disabled. Use PaymentService.initiatePayment for provider initiation and CorePaymentService.completeVerifiedPayment for completion.');
    },

    verifyWebhookSignature(signature, rawBody) {
        return requireValidWebhookSignature(signature, rawBody);
    },

    async completeVerifiedPayment({ dbClient = null, reference, paymentId = null, providerPayload = {}, source = 'unknown' }) {
        const providerReference = extractPaymentReference(providerPayload, reference);
        const providerStatus = normalizeProviderPaymentStatus(providerPayload);
        const isSuccess = providerStatus === 'success';
        const isFailed = providerStatus === 'failed';

        if (!providerReference && !paymentId) {
            throw new Error('Payment completion requires a provider reference or payment id');
        }

        if (!isSuccess && !isFailed) {
            return { status: 'pending', message: `Provider status is ${providerStatus}` };
        }

        const client = dbClient || await pool.connect();
        const ownsTransaction = !dbClient;
        let paymentRow = null;
        let orderRow = null;
        let fraudEvent = null;

        try {
            if (ownsTransaction) await client.query('BEGIN');

            paymentRow = paymentId
                ? await findPaymentByInternalId(client, paymentId)
                : await findPaymentByProviderReference(client, providerReference, source);

            if (!paymentRow) {
                if (ownsTransaction) await client.query('ROLLBACK');
                logger.warn('[CorePaymentService] No payment found for verified provider state', {
                    reference: providerReference,
                    paymentId,
                    source
                });
                return { status: 'not_found', message: 'Payment record not found' };
            }

            const existingStatus = String(paymentRow.status || '').toLowerCase();
            if ([PaymentStatus.COMPLETED, PaymentStatus.SUCCESS, PaymentStatus.PAID].includes(existingStatus)) {
                if (ownsTransaction) await client.query('COMMIT');
                return { status: 'already_processed', payment: paymentRow, message: 'Payment already completed' };
            }

            if ([
                PaymentStatus.MANUAL_REVIEW_REQUIRED,
                PaymentStatus.PAYMENT_MAPPING_FAILED,
                PaymentStatus.COMPENSATION_REQUIRED
            ].includes(existingStatus)) {
                if (ownsTransaction) await client.query('COMMIT');
                return { status: existingStatus, payment: paymentRow, message: 'Payment is in a manual review terminal state' };
            }

            if (existingStatus === PaymentStatus.FAILED && isFailed) {
                if (ownsTransaction) await client.query('COMMIT');
                return { status: 'already_failed', payment: paymentRow, message: 'Payment already failed' };
            }

            const { rawAmount, amount: providerAmount } = normalizeProviderAmount(providerPayload);
            if (isSuccess) {
                if (rawAmount === undefined || rawAmount === null || Number.isNaN(providerAmount) || providerAmount <= 0) {
                    fraudEvent = {
                        paymentId: paymentRow.id,
                        orderId: resolveOrderIdFromMetadata(paymentRow.metadata),
                        providerReference,
                        eventType: 'missing_or_invalid_success_amount',
                        expectedAmount: Number.parseFloat(paymentRow.amount || 0),
                        providerAmount: rawAmount ?? null,
                        payload: providerPayload,
                        details: { source, received: rawAmount ?? null, detected_at: new Date().toISOString() }
                    };
                    throw new Error('Successful provider state missing valid amount');
                }

                const dbAmount = Number.parseFloat(paymentRow.amount || 0);
                if (Math.abs(providerAmount - dbAmount) > PAYMENT_AMOUNT_TOLERANCE_KES) {
                    const orderId = resolveOrderIdFromMetadata(paymentRow.metadata);
                    fraudEvent = {
                        paymentId: paymentRow.id,
                        orderId,
                        providerReference,
                        eventType: 'amount_mismatch',
                        expectedAmount: dbAmount,
                        providerAmount,
                        payload: providerPayload,
                        details: {
                            source,
                            db_amount: dbAmount,
                            provider_amount: providerAmount,
                            detected_at: new Date().toISOString()
                        }
                    };
                    const manualReviewMetadata = {
                        requires_manual_review: true,
                        manual_review_reason: 'amount_mismatch',
                        completion_blocked: {
                            source,
                            provider_status: providerStatus,
                            provider_reference: providerReference,
                            db_amount: dbAmount,
                            provider_amount: providerAmount,
                            provider_payload: providerPayload,
                            blocked_at: new Date().toISOString()
                        }
                    };
                    const { rows: reviewRows } = await client.query(
                        `UPDATE payments
                         SET status = 'manual_review_required',
                             provider_reference = COALESCE($1, provider_reference),
                             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                             updated_at = NOW()
                         WHERE id = $3
                         RETURNING *`,
                        [
                            providerReference,
                            JSON.stringify(manualReviewMetadata),
                            paymentRow.id
                        ]
                    );
                    paymentRow = reviewRows[0] || paymentRow;
                    logger.error('[CorePaymentService] Payment amount mismatch rejected', {
                        paymentId: paymentRow.id,
                        reference: providerReference,
                        dbAmount,
                        providerAmount,
                        source
                    });
                    if (ownsTransaction) await client.query('COMMIT');
                    await recordFraudEvent(fraudEvent);
                    return {
                        status: 'requires_manual_review',
                        payment: paymentRow,
                        order: null,
                        paymentId: paymentRow.id,
                        orderId,
                        message: 'Payment amount mismatch requires manual review'
                    };
                }
            }

            const orderId = resolveOrderIdFromMetadata(paymentRow.metadata);
            if (!orderId) {
                const manualReviewMetadata = {
                    requires_manual_review: true,
                    manual_review_reason: 'missing_order_reference',
                    completion_blocked: {
                        source,
                        provider_status: providerStatus,
                        provider_reference: providerReference,
                        provider_payload: providerPayload,
                        blocked_at: new Date().toISOString()
                    }
                };

                const { rows: reviewRows } = await client.query(
                    `UPDATE payments
                     SET status = 'manual_review_required',
                         provider_reference = COALESCE($1, provider_reference),
                         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $3
                     RETURNING *`,
                    [
                        providerReference,
                        JSON.stringify(manualReviewMetadata),
                        paymentRow.id
                    ]
                );
                paymentRow = reviewRows[0];
                fraudEvent = {
                    paymentId: paymentRow.id,
                    orderId: null,
                    providerReference,
                    eventType: 'missing_order_reference',
                    expectedAmount: Number.parseFloat(paymentRow.amount || 0),
                    providerAmount: isSuccess ? providerAmount : null,
                    payload: providerPayload,
                    details: {
                        source,
                        provider_status: providerStatus,
                        allowed_metadata_keys: ['order_id', 'product_order_id'],
                        detected_at: new Date().toISOString()
                    }
                };

                logger.error('[CorePaymentService] Payment completion blocked for missing order reference', {
                    paymentId: paymentRow.id,
                    reference: providerReference,
                    source
                });

                if (ownsTransaction) await client.query('COMMIT');
                await recordFraudEvent(fraudEvent);
                return {
                    status: 'requires_manual_review',
                    payment: paymentRow,
                    order: null,
                    paymentId: paymentRow.id,
                    orderId: null,
                    message: 'Payment has no valid order_id or product_order_id metadata'
                };
            }

            const logisticsFeePayment = isSellerPickupFeePayment(paymentRow.metadata);
            const receipt = normalizeReceiptForColumn(extractReceipt(providerPayload));
            const completedAt = new Date();
            const completionMetadata = {
                completion_source: source,
                provider_status: providerStatus,
                provider_reference: providerReference,
                provider_amount: rawAmount ?? null,
                ...(isSuccess ? { receipt_id: buildPaymentReceiptId(paymentRow) } : {}),
                completed_at: isSuccess ? completedAt.toISOString() : undefined,
                failed_at: isFailed ? new Date().toISOString() : undefined,
                provider_payload: providerPayload
            };

            const { rows: updatedPayments } = await client.query(
                `UPDATE payments
                 SET status = $1,
                     mpesa_receipt = COALESCE($2, mpesa_receipt),
                     provider_reference = COALESCE($3, provider_reference),
                     metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                     updated_at = NOW()
                 WHERE id = $5
                 RETURNING *`,
                [
                    isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
                    receipt,
                    providerReference,
                    JSON.stringify(completionMetadata),
                    paymentRow.id
                ]
            );
            paymentRow = updatedPayments[0];

            if (orderId) {
                const { rows: orderRows } = await client.query(
                    `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                    [orderId]
                );
                orderRow = orderRows[0] || null;

                if (orderRow && logisticsFeePayment) {
                    logger.info('[CorePaymentService] Completed logistics fee payment without mutating order payment or fulfillment state', {
                        paymentId: paymentRow.id,
                        orderId,
                        source
                    });
                } else if (orderRow) {
                    const currentStatus = String(orderRow.status || '').toUpperCase();

                    if (isSuccess) {
                        if (CANNOT_FULFILL_ORDER_STATUSES.has(currentStatus)) {
                            const { rows: latePaymentRows } = await client.query(
                                `UPDATE product_orders
                                 SET status = 'COMPENSATION_REQUIRED',
                                     payment_status = 'completed',
                                     metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                                     updated_at = NOW()
                                 WHERE id = $1
                                 RETURNING *`,
                                [orderId, JSON.stringify({
                                    late_payment: {
                                        payment_id: paymentRow.id,
                                        previous_status: currentStatus,
                                        source,
                                        received_at: new Date().toISOString()
                                    }
                                })]
                            );
                            orderRow = latePaymentRows[0];
                            logger.error('[CorePaymentService] Late payment needs compensation review', {
                                paymentId: paymentRow.id,
                                orderId,
                                previousStatus: currentStatus
                            });
                        } else {
                            const customProductionPatch = resolveCustomProductionPatch(orderRow, completedAt);
                            if (!PAID_TERMINAL_ORDER_STATUSES.has(currentStatus)) {
                                const { rows: paidOrders } = await client.query(
                                    `UPDATE product_orders
                                     SET status = 'PAID',
                                         payment_status = 'completed',
                                         custom_production_deadline_at = COALESCE(custom_production_deadline_at, $2),
                                         custom_production_grace_deadline_at = COALESCE(custom_production_grace_deadline_at, $3),
                                         metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                                         updated_at = NOW()
                                     WHERE id = $1
                                     RETURNING *`,
                                    [
                                        orderId,
                                        customProductionPatch?.productionDeadline || null,
                                        customProductionPatch?.graceDeadline || null,
                                        JSON.stringify(customProductionPatch?.metadataPatch || {})
                                    ]
                                );
                                orderRow = paidOrders[0];
                            } else if (customProductionPatch && !orderRow.custom_production_deadline_at) {
                                const { rows: updatedCustomRows } = await client.query(
                                    `UPDATE product_orders
                                     SET custom_production_deadline_at = $2,
                                         custom_production_grace_deadline_at = $3,
                                         metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                                         updated_at = NOW()
                                     WHERE id = $1
                                     RETURNING *`,
                                    [
                                        orderId,
                                        customProductionPatch.productionDeadline,
                                        customProductionPatch.graceDeadline,
                                        JSON.stringify(customProductionPatch.metadataPatch)
                                    ]
                                );
                                orderRow = updatedCustomRows[0] || orderRow;
                            }

                            await FulfillmentQueueService.enqueue(client, orderId);
                        }
                    } else if (isFailed && FULFILLABLE_ORDER_STATUSES.has(currentStatus)) {
                        const releaseResult = await releaseOrderReservations(client, orderId);
                        const { rows: failedOrders } = await client.query(
                            `UPDATE product_orders
                             SET status = 'FAILED',
                                 payment_status = 'failed',
                                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                                 updated_at = NOW()
                             WHERE id = $1
                             RETURNING *`,
                            [orderId, JSON.stringify({
                                payment_failure: {
                                    payment_id: paymentRow.id,
                                    source,
                                    provider_status: providerStatus,
                                    released_inventory: releaseResult.releasedInventory,
                                    released_slots: releaseResult.releasedSlots,
                                    failed_at: new Date().toISOString()
                                }
                            })]
                        );
                        orderRow = failedOrders[0];
                    }
                }
            }

            const durableEvent = await eventBus.enqueueInTransaction(
                client,
                isSuccess ? AppEvents.PAYMENT.COMPLETED : AppEvents.PAYMENT.FAILED,
                isSuccess
                    ? {
                        eventId: `payment.completed:${paymentRow.id}`,
                        payment: paymentRow,
                        order: orderRow
                    }
                    : {
                        eventId: `payment.failed:${paymentRow.id}`,
                        payment: paymentRow,
                        order: orderRow,
                        reason: providerStatus
                    }
            );

            if (ownsTransaction) await client.query('COMMIT');

            if (ownsTransaction) {
                eventBus.dispatchAfterCommit(durableEvent.eventId, 'CorePaymentService.completeVerifiedPayment');
            }

            return {
                status: isSuccess ? 'success' : 'failed',
                payment: paymentRow,
                order: orderRow,
                paymentId: paymentRow.id,
                orderId
            };
        } catch (error) {
            if (ownsTransaction) {
                await client.query('ROLLBACK').catch(rollbackError =>
                    logger.error('[CorePaymentService] Payment completion rollback failed:', rollbackError)
                );
            }
            if (fraudEvent) {
                await recordFraudEvent(fraudEvent);
            }
            logger.error('[CorePaymentService] Atomic payment completion failed:', {
                reference: providerReference,
                paymentId,
                source,
                error: error.message
            });
            throw error;
        } finally {
            if (ownsTransaction) client.release();
        }
    },

    /**
     * Handle the Paystack payment webhook after route-level verification.
     */
    async handlePaystackWebhook(webhookData, security = {}) {
        if (!security.hmacVerified && security.signature && security.rawBody) {
            if (!this.verifyWebhookSignature(security.signature, security.rawBody)) {
                throw new Error('Invalid Paystack webhook signature');
            }
        } else if (!security.hmacVerified) {
            throw new Error('Invalid Paystack webhook signature');
        }

        const providerPayload = normalizePaystackChargePayload(webhookData);
        const verifiedReference = extractPaymentReference(providerPayload);
        if (!verifiedReference) {
            logger.warn('[CorePaymentService] Webhook received with no payment reference. Ignoring.', webhookData);
            return { status: 'ignored', message: 'No reference in webhook' };
        }

        return this.completeVerifiedPayment({
            reference: verifiedReference,
            providerPayload,
            source: 'paystack_webhook'
        });
    },

    async checkPaymentStatus(identifier) {
        throw new Error('CorePaymentService.checkPaymentStatus is disabled. Use PaymentService.checkPaymentStatus so provider polling remains outside the Core completion boundary.');
    },

    /**
     * Initiate a seller withdrawal / payout.
     * NO-TOUCH: Fully delegated to legacy withdrawal service.
     */
    async initiateWithdrawal(params) {
        const { default: withdrawalService } = await import('../services/withdrawal.service.js');
        const result = await withdrawalService.createWithdrawalRequest(params);

        // P1-3 FIX: Withdrawal is only INITIATED here, not COMPLETED.
        // WITHDRAWAL.COMPLETED is emitted by callback.controller.js after the payout provider confirms.
        if (result) {
            eventBus.enqueueAndDispatch(
                AppEvents.WITHDRAWAL.INITIATED,
                { eventId: `withdrawal.initiated:${result.id}`, withdrawal: result },
                'CorePaymentService.initiateWithdrawal'
            ).catch(error => logger.error('[CorePaymentService] Durable withdrawal initiation event failed', {
                withdrawalId: result.id,
                error: error.message
            }));
        }

        return result;
    },

    /**
     * Handle payout callback (provider -> our system).
     * NO-TOUCH: Fully delegated to legacy withdrawal service.
     */
    async handlePayoutCallback(callbackData) {
        const { default: withdrawalService } = await import('../services/withdrawal.service.js');
        return withdrawalService.updateStatusWithSideEffects(
            callbackData.requestId,
            callbackData.newStatus,
            callbackData.opts
        );
    },
};

export default CorePaymentService;
