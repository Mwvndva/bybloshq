import cron from 'node-cron';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import ProductModel from '../models/product.model.js';
import Order from '../models/order.model.js';
import { OrderStatus } from '../shared/constants/enums.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';

const RECONCILIATION_LOCK_KEY = 'byblos:reconciliation-engine';

/**
 * ReconciliationEngine: Self-healing background service.
 * Enforces consistency and handles expired/stuck states.
 */
class ReconciliationEngine {
    static async start() {
        cron.schedule('*/5 * * * *', async () => {
            await this.runOnce();
        });

        logger.info('[RECON] Reconciliation Engine initialized (5-minute schedule).');
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
                    const { rows: items } = await client.query(
                        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                        [order.id]
                    );

                    for (const item of items) {
                        const released = await ProductModel.release(client, item.product_id, item.quantity);
                        if (!released) {
                            logger.warn(`[RECON] Inventory release skipped for product ${item.product_id}; reserved quantity may already be zero.`);
                        }
                    }
                }

                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.CANCELLED, 'system_timeout');

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
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const stuckQuery = `
                SELECT id, order_type FROM product_orders
                WHERE status = 'PAYMENT_PENDING'
                  AND updated_at < NOW() - INTERVAL '30 minutes'
                  AND COALESCE(metadata->>'provider_result_ambiguous_manual_review_required', 'false') <> 'true'
                  AND COALESCE(metadata->>'requires_manual_review', 'false') <> 'true'
                  AND COALESCE(metadata->>'needs_manual_review', 'false') <> 'true'
                ORDER BY updated_at ASC, id ASC
                LIMIT 50
                FOR UPDATE SKIP LOCKED
            `;
            const { rows: stuckOrders } = await client.query(stuckQuery);

            for (const order of stuckOrders) {
                logger.warn(`[RECON] Found stuck PAYMENT_PENDING order ${order.id} (${order.order_type}). Cancelling.`);

                if (order.order_type === 'PHYSICAL' || !order.order_type) {
                    const { rows: items } = await client.query(
                        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                        [order.id]
                    );
                    for (const item of items) {
                        const released = await ProductModel.release(client, item.product_id, item.quantity);
                        if (!released) {
                            logger.warn(`[RECON] Inventory release skipped for product ${item.product_id} (order ${order.id}); reserved quantity may already be zero.`);
                        }
                    }
                }

                if (order.order_type === 'SERVICE') {
                    await client.query(
                        `UPDATE service_slots
                         SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
                         WHERE reserved_by_order_id = $1`,
                        [order.id]
                    );
                }

                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.CANCELLED, 'stuck_payment');
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
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
}

export default ReconciliationEngine;
