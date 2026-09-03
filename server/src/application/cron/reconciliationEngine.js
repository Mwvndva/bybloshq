import cron from 'node-cron';
import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import Order from '../../domains/orders/order/order.model.js';
import { OrderStatus, PaymentStatus } from '../../shared/constants/enums.js';
import FulfillmentQueueService from '../../domains/orders/fulfillment/fulfillmentQueue.service.js';
import InventoryReservationService from '../../domains/commerce/products/inventoryReservation.service.js';
import escrowManager from '../../domains/orders/escrow/EscrowManager.js';
import settlementService from '../../domains/orders/escrow/settlement.service.js';

const RECONCILIATION_LOCK_KEY = 'byblos:reconciliation-engine';

/**
 * ReconciliationEngine: Self-healing background service.
 * Enforces consistency and handles expired/stuck states.
 */
class ReconciliationEngine {
    static async markCancellationReason(client, orderId, reason) {
        await client.query(
            `UPDATE product_orders
             SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [
                orderId,
                JSON.stringify({
                    cancellation_reason: reason,
                    reconciliation_reason: reason,
                    reconciled_at: new Date().toISOString()
                })
            ]
        );
    }

    static async start() {
        cron.schedule('*/5 * * * *', async () => {
            await this.runOnce();
        });

        setImmediate(() => {
            this.runOnce().catch(err => logger.error('[RECON] Initial startup run failed:', err));
        });

        logger.info('[RECON] Reconciliation Engine initialized (5-minute schedule + startup run).');
    }

    static async runOnce() {
        const client = await pool.connect();
        let lockAcquired = false;

        try {
            const { rows: [lock] } = await client.query(
                'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
                [RECONCILIATION_LOCK_KEY]
            );
            lockAcquired = lock?.locked === true;

            if (!lockAcquired) {
                logger.info('[RECON] Skipping reconciliation; another instance owns the run lock.');
                return { skipped: true };
            }

            logger.info('[RECON] Starting system reconciliation run...');
            await this.handleExpiredReservations();
            await this.handleStuckPayments();
            await this.handleMissingFulfillmentJobs();
            await this.handleUnreleasedCompletedOrders();
            await this.handleCompletedRefunds();
            return { skipped: false };
        } catch (err) {
            logger.error('[RECON] Reconciliation run failed:', err);
            throw err;
        } finally {
            if (lockAcquired) {
                await client.query('SELECT pg_advisory_unlock(hashtext($1))', [RECONCILIATION_LOCK_KEY])
                    .catch(err => logger.error('[RECON] Failed to release reconciliation lock:', err));
            }
            client.release();
        }
    }

    /**
     * Release inventory for RESERVED or HELD orders that exceeded deadlines.
     * Each order is processed in an independent transaction.
     */
    static async handleExpiredReservations() {
        const { rows: expiredOrders } = await pool.query(
            `SELECT po.id, po.order_type
             FROM product_orders po
             WHERE po.status IN ('RESERVED', 'HELD')
               AND po.reservation_expires_at < NOW()
             LIMIT 50`
        );

        if (expiredOrders.length === 0) return;

        logger.info(`[RECON] Found ${expiredOrders.length} expired reservations. Processing individually.`);

        for (const order of expiredOrders) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const { rows: locked } = await client.query(
                    `SELECT id, order_type, status FROM product_orders
                     WHERE id = $1 AND status IN ('RESERVED', 'HELD')
                     FOR UPDATE SKIP LOCKED`,
                    [order.id]
                );

                if (locked.length === 0) {
                    await client.query('ROLLBACK');
                    continue;
                }

                const lockedOrder = locked[0];

                if (lockedOrder.order_type === 'SERVICE') {
                    await client.query(
                        `UPDATE service_slots
                         SET status = 'AVAILABLE',
                             reserved_by_order_id = NULL,
                             expires_at = NULL,
                             updated_at = NOW()
                         WHERE reserved_by_order_id = $1`,
                        [order.id]
                    );
                    logger.info(`[RECON] Released service slot for expired order ${order.id}`);
                }

                if (lockedOrder.order_type === 'PHYSICAL' || !lockedOrder.order_type) {
                    const released = await InventoryReservationService.releaseOrderInventory(client, order.id);
                    logger.info(`[RECON] Released ${released} product reservation(s) for expired order ${order.id}`);
                }

                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.CANCELLED, PaymentStatus.CANCELLED);
                await this.markCancellationReason(client, order.id, 'system_timeout');

                await client.query('COMMIT');
                logger.info(`[RECON] Expired order ${order.id} (${lockedOrder.order_type}) cancelled successfully.`);
            } catch (err) {
                await client.query('ROLLBACK').catch(() => { });
                logger.error(`[RECON] Failed to cancel expired order ${order.id}:`, err.message);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Cleanup PAYMENT_PENDING orders that have been stuck for too long.
     */
    static async handleStuckPayments() {
        const stuckQuery = `
            SELECT id, order_type FROM product_orders
            WHERE status = 'PAYMENT_PENDING'
              AND updated_at < NOW() - INTERVAL '30 minutes'
              AND COALESCE(metadata->>'provider_result_ambiguous_manual_review_required', 'false') <> 'true'
              AND COALESCE(metadata->>'requires_manual_review', 'false') <> 'true'
              AND COALESCE(metadata->>'needs_manual_review', 'false') <> 'true'
            ORDER BY updated_at ASC, id ASC
            LIMIT 50
        `;
        const { rows: stuckOrders } = await pool.query(stuckQuery);

        for (const order of stuckOrders) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const { rows: lockedOrders } = await client.query(
                    `SELECT id, order_type, status FROM product_orders WHERE id = $1 AND status = 'PAYMENT_PENDING' FOR UPDATE SKIP LOCKED`,
                    [order.id]
                );
                if (lockedOrders.length === 0) {
                    await client.query('ROLLBACK');
                    continue;
                }

                logger.warn(`[RECON] Found stuck PAYMENT_PENDING order ${order.id} (${order.order_type}). Cancelling.`);

                if (order.order_type === 'PHYSICAL' || !order.order_type) {
                    const released = await InventoryReservationService.releaseOrderInventory(client, order.id);
                    logger.info(`[RECON] Released ${released} product reservation(s) for stuck order ${order.id}`);
                }

                if (order.order_type === 'SERVICE') {
                    await client.query(
                        `UPDATE service_slots
                         SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
                         WHERE reserved_by_order_id = $1`,
                        [order.id]
                    );
                }

                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.CANCELLED, PaymentStatus.CANCELLED);
                await this.markCancellationReason(client, order.id, 'stuck_payment');

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                logger.error(`[RECON] Failed cancelling stuck order ${order.id}:`, err.message);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Ensure every PAID order has a fulfillment job.
     */
    static async handleMissingFulfillmentJobs() {
        const query = `
            SELECT id FROM product_orders
            WHERE status = 'PAID'
              AND id NOT IN (SELECT order_id FROM fulfillment_jobs)
              AND created_at > NOW() - INTERVAL '1 day'
            LIMIT 50
        `;
        const { rows: missingOrders } = await pool.query(query);

        for (const order of missingOrders) {
            logger.info(`[RECON] Re-enqueuing missing fulfillment job for order ${order.id}.`);
            await FulfillmentQueueService.enqueue(null, order.id);
        }
    }

    /**
     * Self-healing worker: Scan for COMPLETED orders that have NO payout record in payouts table
     * and invoke escrowManager.releaseFunds() to credit the seller.
     */
    static async handleUnreleasedCompletedOrders() {
        const { rows: unreleasedOrders } = await pool.query(
            `SELECT po.*
             FROM product_orders po
             LEFT JOIN payouts p ON p.order_id = po.id
             WHERE po.status = 'COMPLETED'
               AND po.payment_status = 'completed'
               AND p.id IS NULL
             ORDER BY po.completed_at ASC NULLS LAST
             LIMIT 50`
        );

        if (unreleasedOrders.length === 0) return;

        logger.info(`[RECON] Found ${unreleasedOrders.length} COMPLETED orders missing escrow payout release.`);

        for (const order of unreleasedOrders) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const { rows: [lockedOrder] } = await client.query(
                    'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
                    [order.id]
                );
                if (lockedOrder && lockedOrder.status === 'COMPLETED') {
                    const releaseResult = await escrowManager.releaseFunds(client, lockedOrder, 'ReconciliationWorker');
                    logger.info(`[RECON] Escrow recovery executed for Order ${order.id}:`, releaseResult);
                }
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                logger.error(`[RECON] Failed escrow recovery for Order ${order.id}:`, err.message);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Self-healing worker: Scan for completed refund_requests where the buyer's
     * refund balance has not yet been credited, and atomically credit the wallet.
     * Reconciles retroactively (e.g. previously confirmed manual refunds) and continuously.
     */
    static async handleCompletedRefunds() {
        const { rows: uncreditedRefunds } = await pool.query(
            `SELECT rr.id, rr.buyer_id, rr.order_id, rr.amount
             FROM refund_requests rr
             WHERE rr.status = 'completed'
               AND (
                 rr.payment_details IS NULL
                 OR rr.payment_details->>'credited_to_buyer' IS NULL
                 OR rr.payment_details->>'credited_to_buyer' != 'true'
               )
             ORDER BY rr.id ASC
             LIMIT 50`
        );

        if (uncreditedRefunds.length === 0) return;

        logger.info(`[RECON] Found ${uncreditedRefunds.length} completed refund(s) missing wallet credit reconciliation.`);

        for (const refund of uncreditedRefunds) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const { rows: [locked] } = await client.query(
                    `SELECT id, buyer_id, order_id, amount, status, payment_details
                     FROM refund_requests
                     WHERE id = $1
                       AND status = 'completed'
                       AND (
                         payment_details IS NULL
                         OR payment_details->>'credited_to_buyer' IS NULL
                         OR payment_details->>'credited_to_buyer' != 'true'
                       )
                     FOR UPDATE SKIP LOCKED`,
                    [refund.id]
                );

                if (!locked) {
                    await client.query('ROLLBACK');
                    continue;
                }

                const refundAmount = Number.parseFloat(locked.amount);
                if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
                    logger.warn(`[RECON] Skipping refund ${locked.id} due to invalid amount: ${locked.amount}`);
                    await client.query('ROLLBACK');
                    continue;
                }

                // 1. Atomically credit the buyer's refund balance
                await client.query(
                    `UPDATE buyers
                     SET refunds = COALESCE(refunds, 0) + $1,
                         updated_at = NOW()
                     WHERE id = $2`,
                    [refundAmount, locked.buyer_id]
                );

                // 2. Mark as credited in payment_details
                const creditMetadata = {
                    credited_to_buyer: true,
                    credited_amount: refundAmount,
                    credited_by: 'reconciliation_worker',
                    reconciled_at: new Date().toISOString()
                };

                await client.query(
                    `UPDATE refund_requests
                     SET payment_details = COALESCE(payment_details, '{}'::jsonb) || $1::jsonb,
                         updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify(creditMetadata), locked.id]
                );

                // 3. Ensure order is marked refunded and reverse seller settlement if applicable
                if (locked.order_id) {
                    await client.query(
                        `UPDATE product_orders
                         SET status = 'REFUNDED'::order_status,
                             payment_status = 'cancelled'::payment_status,
                             updated_at = NOW()
                         WHERE id = $1 AND status != 'REFUNDED'`,
                        [locked.order_id]
                    ).catch(() => {});

                    try {
                        await settlementService.reverseOrderSettlementForRefund(
                            client,
                            locked.order_id,
                            'reconciliation_worker_refund'
                        );
                    } catch (settleErr) {
                        logger.warn(`[RECON] Settlement reversal for order ${locked.order_id} failed:`, settleErr.message);
                    }
                }

                await client.query('COMMIT');
                logger.info(`[RECON] Successfully credited ${refundAmount} to buyer ${locked.buyer_id} for completed refund request ${locked.id}`);
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                logger.error(`[RECON] Failed reconciling completed refund ${refund.id}:`, err.message);
            } finally {
                client.release();
            }
        }
    }
}

export default ReconciliationEngine;
