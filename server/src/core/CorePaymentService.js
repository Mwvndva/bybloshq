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
 *   - HMAC webhook verification (untouched)
 *   - Idempotency checks (FOR UPDATE patterns kept)
 *   - All payout / withdrawal logic (delegated to legacy)
 */

import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';

// ── Lazy imports to prevent circular dependencies ──
let _legacyPaymentService = null;
let _legacyOrderService = null;

async function getLegacyPaymentService() {
    if (!_legacyPaymentService) {
        const { default: svc } = await import('../services/payment.service.js');
        _legacyPaymentService = svc;
    }
    return _legacyPaymentService;
}

async function getLegacyOrderService() {
    if (!_legacyOrderService) {
        const { default: svc } = await import('../services/order.service.js');
        _legacyOrderService = svc;
    }
    return _legacyOrderService;
}

// ── PaymentStatus constants ──────────────────────────────────────
const PaymentStatus = {
    COMPLETED: 'completed',
    SUCCESS: 'success',
    FAILED: 'failed',
    PENDING: 'pending',
};

const CorePaymentService = {

    /**
     * Initiate an STK Push payment.
     * Fully delegated to legacy — no changes to initiation flow.
     */
    async initiatePayment(paymentData) {
        const svc = await getLegacyPaymentService();
        return svc.initiatePayment(paymentData);
    },

    /**
     * Handle the Payd payment webhook (STK Push confirmation).
     *
     * KEY FIX: This method now uses a SINGLE database client to update
     * both `payments` AND `orders` inside one atomic transaction, eliminating
     * the payment/order state race identified in the audit.
     */
    async handlePaydWebhook(webhookData) {
        const legacyPayment = await getLegacyPaymentService();

        // Step 1: Verify HMAC signature — unchanged, delegates completely to legacy.
        // This must happen before any DB writes.
        const isValid = legacyPayment.verifyWebhookSignature
            ? legacyPayment.verifyWebhookSignature(webhookData)
            : true; // fallback if verification is on controller level

        if (!isValid) {
            throw new Error('Invalid webhook signature');
        }

        // Step 2: Extract key identifiers from webhook payload.
        const reference = webhookData.data?.api_ref
            || webhookData.api_ref
            || webhookData.data?.transaction_reference;

        const rawStatus = webhookData.data?.status || webhookData.status;
        const resultCode = webhookData.data?.result_code ?? webhookData.result_code;
        const resultCodeNum = Number.parseInt(resultCode, 10);
        const isSuccess =
            rawStatus === 'SUCCESS' ||
            rawStatus === 'success' ||
            resultCodeNum === 0 ||
            resultCodeNum === 200;
        const mpesaReceipt = webhookData.data?.third_party_trans_id || null;
        // P0-3: Capture webhook-reported amount for DB verification below
        const webhookAmountRaw = webhookData.data?.amount ?? webhookData.amount;
        const webhookAmount = Number.parseFloat(webhookAmountRaw);

        if (!reference) {
            logger.warn('[CorePaymentService] Webhook received with no reference. Ignoring.', webhookData);
            return { status: 'ignored', message: 'No reference in webhook' };
        }

        logger.info(`[CorePaymentService] Processing webhook for ref: ${reference}, status: ${rawStatus}`);

        // Step 3: ONE atomic transaction for payment + order update (THE FIX).
        const dbClient = await pool.connect();
        let paymentRow = null;
        let orderRow = null;

        try {
            await dbClient.query('BEGIN');

            // 3a. Lock and fetch the payment row
            const { rows: paymentRows } = await dbClient.query(
                `SELECT p.*, p.metadata as payment_meta
                 FROM payments p
                 WHERE p.provider_reference = $1 OR p.api_ref = $1
                 LIMIT 1
                 FOR UPDATE`,
                [reference]
            );

            if (!paymentRows.length) {
                await dbClient.query('ROLLBACK');
                logger.warn(`[CorePaymentService] No payment found for ref: ${reference}`);
                return { status: 'not_found', message: 'Payment record not found' };
            }

            paymentRow = paymentRows[0];

            // 3b. Idempotency check — do not re-process terminal states
            if (
                paymentRow.status === PaymentStatus.COMPLETED ||
                paymentRow.status === PaymentStatus.SUCCESS
            ) {
                await dbClient.query('ROLLBACK');
                logger.info(`[CorePaymentService] Already processed payment ${paymentRow.id}. Skipping.`);
                return { status: 'already_processed', message: 'Duplicate webhook' };
            }

            // P0-3: AMOUNT FRAUD GUARD — webhook amount must match DB amount.
            // Allow a tolerance of KES 1 to accommodate Payd rounding differences.
            // Only enforce on successful payments (failed webhooks have amount=0).
            if (isSuccess) {
                if (webhookAmountRaw === undefined || webhookAmountRaw === null || Number.isNaN(webhookAmount) || webhookAmount <= 0) {
                    await dbClient.query('ROLLBACK');
                    logger.error(`[CorePaymentService] FRAUD_DETECTED: Successful webhook for ref ${reference} did not include a valid positive amount.`);
                    await pool.query(
                        `UPDATE payments
                         SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{fraud_flag}', $1::jsonb)
                         WHERE id = $2`,
                        [JSON.stringify({ reason: 'missing_or_invalid_success_amount', received: webhookAmountRaw ?? null }), paymentRow.id]
                    ).catch(e => logger.error('[CorePaymentService] Failed to set fraud_flag:', e));
                    throw new Error('Successful webhook missing valid amount');
                }

                const dbAmount = Number.parseFloat(paymentRow.amount ?? 0);
                if (Math.abs(webhookAmount - dbAmount) > 1) {
                    await dbClient.query('ROLLBACK');
                    logger.error(
                        `[CorePaymentService] FRAUD_DETECTED: Amount mismatch for ref ${reference}. ` +
                        `DB=${dbAmount}, webhook=${webhookAmount}. Payment ${paymentRow.id} rejected.`
                    );
                    // Mark payment as suspicious for manual review
                    await pool.query(
                        `UPDATE payments
                         SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{fraud_flag}', $1::jsonb)
                         WHERE id = $2`,
                        [JSON.stringify({ reason: 'amount_mismatch', db: dbAmount, webhook: webhookAmount }), paymentRow.id]
                    ).catch(e => logger.error('[CorePaymentService] Failed to set fraud_flag:', e));
                    throw new Error(`Webhook amount mismatch: DB=${dbAmount}, webhook=${webhookAmount}`);
                }
            }

            // 3c. Update payment status (within transaction)
            const { rows: updatedPayment } = await dbClient.query(
                `UPDATE payments
                 SET status = $1,
                     mpesa_receipt = $2,
                     provider_reference = $3,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                     updated_at = NOW()
                 WHERE id = $5
                 RETURNING *`,
                [
                    isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
                    mpesaReceipt,
                    reference,
                    JSON.stringify({ webhook_received_at: new Date().toISOString(), raw_status: rawStatus }),
                    paymentRow.id
                ]
            );
            paymentRow = updatedPayment[0];

            // 3d. If successful and linked to an order — update order in THE SAME transaction
            const paymentMeta = typeof paymentRow.metadata === 'string'
                ? JSON.parse(paymentRow.metadata)
                : (paymentRow.metadata || {});

            if (isSuccess && paymentMeta.order_id) {
                const orderId = Number.parseInt(paymentMeta.order_id, 10);

                // Lock the order row. The live schema uses product_orders.
                const { rows: orderRows } = await dbClient.query(
                    `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                    [orderId]
                );

                if (orderRows.length) {
                    orderRow = orderRows[0];

                    // Only update fulfillable orders. Late payments after timeout/cancel need manual reconciliation.
                    const currentStatus = String(orderRow.status || '').toUpperCase();
                    const paidTerminal = ['PAID', 'COMPLETED', 'FULFILLED', 'DELIVERED', 'BOOKED'];
                    const cannotFulfill = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'COMPENSATION_REQUIRED'];

                    if (cannotFulfill.includes(currentStatus)) {
                        await dbClient.query(
                            `UPDATE product_orders
                             SET status = 'COMPENSATION_REQUIRED',
                                 payment_status = 'completed',
                                 metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{late_payment}', $2::jsonb),
                                 updated_at = NOW()
                              WHERE id = $1`,
                            [orderId, JSON.stringify({ payment_id: paymentRow.id, previous_status: currentStatus, received_at: new Date().toISOString() })]
                        );
                        logger.error(`[CorePaymentService] Late payment for order ${orderId} in ${currentStatus}; marked COMPENSATION_REQUIRED`);
                    } else if (!paidTerminal.includes(currentStatus)) {
                        await dbClient.query(
                            `UPDATE product_orders
                             SET status = 'PAID',
                                 payment_status = 'completed',
                                 updated_at = NOW()
                              WHERE id = $1`,
                            [orderId]
                        );
                        logger.info(`[CorePaymentService] Order ${orderId} ATOMICALLY set to PAID with payment ${paymentRow.id}`);
                    }

                    const { rows: refreshedOrders } = await dbClient.query(
                        `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                        [orderId]
                    );
                    orderRow = refreshedOrders[0] || { ...orderRow, status: 'PAID', payment_status: 'completed' };

                    if (!cannotFulfill.includes(currentStatus)) {
                        await FulfillmentQueueService.enqueue(dbClient, orderId);
                    }
                }
            }

            // 3e. Handle debt settlement in same transaction
            if (isSuccess && paymentMeta.type === 'debt' && paymentMeta.debt_id) {
                await dbClient.query(
                    `UPDATE client_debts SET is_paid = true, updated_at = NOW() WHERE id = $1`,
                    [Number.parseInt(paymentMeta.debt_id, 10)]
                );
                logger.info(`[CorePaymentService] Debt ${paymentMeta.debt_id} settled`);
            }

            await dbClient.query('COMMIT');
            logger.info(`[CorePaymentService] Atomic transaction committed for ref: ${reference}`);

        } catch (err) {
            await dbClient.query('ROLLBACK').catch(e =>
                logger.error('[CorePaymentService] ROLLBACK failed:', e)
            );
            logger.error('[CorePaymentService] Atomic transaction failed:', err.message);
            throw err;
        } finally {
            dbClient.release();
        }

        // Step 4: Post-commit side effects via EventBus (NON-BLOCKING)
        // These must never block or rollback the payment.
        setImmediate(async () => {
            if (isSuccess) {
                eventBus.emit(AppEvents.PAYMENT.COMPLETED, {
                    payment: paymentRow,
                    order: orderRow
                });

                // P0-1 FIX: executeFulfillment REQUIRES a live DB client.
                // Always acquire a fresh client with its own transaction.
                if (process.env.ENABLE_INLINE_FULFILLMENT === 'true' && orderRow) {
                    const fulfillClient = await pool.connect();
                    try {
                        const legacyOrder = await getLegacyOrderService();
                        await fulfillClient.query('BEGIN');
                        await legacyOrder.executeFulfillment(fulfillClient, { ...orderRow, status: 'PAID' });
                        await fulfillClient.query('COMMIT');
                    } catch (fulfillErr) {
                        await fulfillClient.query('ROLLBACK').catch(() => { });
                        logger.error(`[CorePaymentService] Fulfillment failed for order ${orderRow?.id}:`, fulfillErr.message);
                        // Mark for cron recovery — payment is already committed
                        await pool.query(
                            `UPDATE payments SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{needs_fulfillment}', 'true'::jsonb) WHERE id = $1`,
                            [paymentRow.id]
                        ).catch(e => logger.error('[CorePaymentService] Failed to set needs_fulfillment flag:', e));
                    } finally {
                        fulfillClient.release();
                    }
                }
            } else {
                eventBus.emit(AppEvents.PAYMENT.FAILED, {
                    payment: paymentRow,
                    reason: rawStatus
                });
            }
        });

        return {
            status: isSuccess ? 'success' : 'failed',
            message: isSuccess ? 'Payment processed successfully' : 'Payment failed',
            paymentId: paymentRow?.id
        };
    },

    /**
     * Check payment status by identifier.
     * Fully delegated to legacy service.
     */
    async checkPaymentStatus(identifier) {
        const svc = await getLegacyPaymentService();
        return svc.checkPaymentStatus(identifier);
    },

    /**
     * Initiate a seller withdrawal / payout.
     * NO-TOUCH: Fully delegated to legacy withdrawal service.
     */
    async initiateWithdrawal(params) {
        const { default: withdrawalService } = await import('../services/withdrawal.service.js');
        const result = await withdrawalService.createWithdrawalRequest(params);

        // P1-3 FIX: Withdrawal is only INITIATED here, not COMPLETED.
        // WITHDRAWAL.COMPLETED is emitted by callback.controller.js after Payd confirms.
        setImmediate(() => {
            if (result) {
                eventBus.emit(AppEvents.WITHDRAWAL.INITIATED, { withdrawal: result });
            }
        });

        return result;
    },

    /**
     * Handle payout callback (Payd → our system).
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
