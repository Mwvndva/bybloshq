import cron from 'node-cron';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import ProductModel from '../models/product.model.js';
import Order from '../models/order.model.js';
import { OrderStatus } from '../shared/constants/enums.js';
import FulfillmentQueueService from '../services/fulfillmentQueue.service.js';

/**
 * ReconciliationEngine: Self-healing background service.
 * Enforces consistency and handles expired/stuck states.
 */
class ReconciliationEngine {
    static async start() {
        // Run reconciliation every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            logger.info('⚖️ [RECON] Starting system reconciliation run...');
            try {
                await this.handleExpiredReservations();
                await this.handleStuckPayments();
                await this.handleMissingFulfillmentJobs();
            } catch (err) {
                logger.error('❌ [RECON] Reconciliation run failed:', err);
            }
        });

        logger.info('🚀 [RECON] Reconciliation Engine initialized (5-minute schedule).');
    }

    /**
     * Release inventory for RESERVED or HELD orders that exceeded deadlines.
     *
     * P1-4 FIX: Each order is processed in an INDEPENDENT transaction.
     * A failure for one order does NOT roll back all other releases.
     * P1-5 FIX: Service slots are released for expired SERVICE orders.
     */
    static async handleExpiredReservations() {
        // First: find all expired orders without locking (we'll lock per-order below)
        const { rows: expiredOrders } = await pool.query(
            `SELECT po.id, po.order_type
             FROM product_orders po
             WHERE po.status IN ('RESERVED', 'HELD')
               AND po.reservation_expires_at < NOW()
             LIMIT 50`
        );

        if (expiredOrders.length === 0) return;

        logger.info(`⚖️ [RECON] Found ${expiredOrders.length} expired reservations. Processing individually.`);

        for (const order of expiredOrders) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Lock the specific order row; SKIP if already updated by another worker
                const { rows: locked } = await client.query(
                    `SELECT id, order_type, status FROM product_orders
                     WHERE id = $1 AND status IN ('RESERVED', 'HELD')
                     FOR UPDATE SKIP LOCKED`,
                    [order.id]
                );

                if (locked.length === 0) {
                    // Another worker already handled this order
                    await client.query('ROLLBACK');
                    continue;
                }

                const lockedOrder = locked[0];

                // P1-5 FIX: Release service slot if this is a SERVICE order
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
                    logger.info(`⚖️ [RECON] Released service slot for expired ORDER ${order.id}`);
                }

                // P1-4 FIX: Only release physical inventory for PHYSICAL orders
                if (lockedOrder.order_type === 'PHYSICAL' || !lockedOrder.order_type) {
                    const { rows: items } = await client.query(
                        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                        [order.id]
                    );

                    for (const item of items) {
                        const released = await ProductModel.release(client, item.product_id, item.quantity);
                        if (!released) {
                            logger.warn(`⚖️ [RECON] Inventory release skipped for product ${item.product_id} (reserved_quantity may already be 0)`);
                        }
                    }
                }

                // Transition to CANCELLED
                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.CANCELLED, 'system_timeout');

                await client.query('COMMIT');
                logger.info(`⚖️ [RECON] Expired order ${order.id} (${lockedOrder.order_type}) cancelled successfully.`);
            } catch (err) {
                await client.query('ROLLBACK').catch(() => { });
                logger.error(`⚖️ [RECON] Failed to cancel expired order ${order.id}:`, err.message);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Cleanup PAYMENT_PENDING orders that have been stuck for too long (e.g. > 15 mins).
     *
     * Inventory safety: Only PHYSICAL orders have reserved inventory.
     * DIGITAL and SERVICE orders must NOT have inventory released.
     */
    static async handleStuckPayments() {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Fetch order_type to determine which orders need inventory release
            const stuckQuery = `
                SELECT id, order_type FROM product_orders
                WHERE status = 'PAYMENT_PENDING'
                  AND updated_at < NOW() - INTERVAL '30 minutes'
                FOR UPDATE SKIP LOCKED
            `;
            const { rows: stuckOrders } = await client.query(stuckQuery);

            for (const order of stuckOrders) {
                logger.warn(`⚖️ [RECON] Found stuck PAYMENT_PENDING order ${order.id} (${order.order_type}). Cancelling.`);

                // Only release inventory for PHYSICAL orders that actually reserved stock
                if (order.order_type === 'PHYSICAL' || !order.order_type) {
                    const { rows: items } = await client.query(
                        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                        [order.id]
                    );
                    for (const item of items) {
                        const released = await ProductModel.release(client, item.product_id, item.quantity);
                        if (!released) {
                            logger.warn(`⚖️ [RECON] Inventory release skipped for product ${item.product_id} (order ${order.id}) — reserved_quantity may already be 0`);
                        }
                    }
                }

                // SERVICE orders: also release any service slot held in PAYMENT_PENDING state
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
            logger.info(`⚖️ [RECON] Re-enqueuing missing fulfillment job for Order ${order.id}.`);
            await FulfillmentQueueService.enqueue(order.id);
        }
    }
}

export default ReconciliationEngine;
