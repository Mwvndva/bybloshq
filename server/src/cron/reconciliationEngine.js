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
     */
    static async handleExpiredReservations() {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const expiredQuery = `
                SELECT id, status FROM product_orders
                WHERE status IN ('RESERVED', 'HELD')
                  AND expires_at < NOW()
                FOR UPDATE SKIP LOCKED
            `;
            const { rows: expiredOrders } = await client.query(expiredQuery);

            if (expiredOrders.length === 0) return;

            logger.info(`⚖️ [RECON] Found ${expiredOrders.length} expired reservations.`);

            for (const order of expiredOrders) {
                // 1. Fetch items
                const { rows: items } = await client.query(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                    [order.id]
                );

                // 2. Release inventory
                for (const item of items) {
                    await ProductModel.release(client, item.product_id, item.quantity);
                }

                // 3. Transition to CANCELLED
                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.CANCELLED, 'system_timeout');
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
     * Cleanup PAYMENT_PENDING orders that have been stuck for too long (e.g. > 15 mins).
     */
    static async handleStuckPayments() {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const stuckQuery = `
                SELECT id FROM product_orders
                WHERE status = 'PAYMENT_PENDING'
                  AND updated_at < NOW() - INTERVAL '30 minutes'
                FOR UPDATE SKIP LOCKED
            `;
            const { rows: stuckOrders } = await client.query(stuckQuery);

            for (const order of stuckOrders) {
                logger.warn(`⚖️ [RECON] Found stuck PAYMENT_PENDING order ${order.id}. Cancelling.`);

                // Release inventory before cancelling
                const { rows: items } = await client.query(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                    [order.id]
                );
                for (const item of items) {
                    await ProductModel.release(client, item.product_id, item.quantity);
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
