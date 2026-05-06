import cron from 'node-cron';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import ProductModel from '../models/product.model.js';
import OrderService from '../modules/orders/order.service.js';
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
                SELECT id, order_number FROM product_orders
                WHERE status IN ('RESERVED', 'HELD')
                  AND reservation_expires_at < NOW()
                FOR UPDATE SKIP LOCKED
            `;
            const { rows: expiredOrders } = await client.query(expiredQuery);

            if (expiredOrders.length === 0) return;

            logger.info(`⚖️ [RECON] Found ${expiredOrders.length} expired reservations.`);

            for (const order of expiredOrders) {
                try {
                    // Use State Machine to handle transitions and inventory release
                    await OrderService.transitionTo(order.id, 'EXPIRED', { reason: 'System Reconciliation Cleanup' }, client);
                } catch (err) {
                    logger.error(`⚖️ [RECON] Failed to transition expired order ${order.order_number}:`, err);
                }
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
                SELECT id, order_number FROM product_orders
                WHERE status = 'PAYMENT_PENDING'
                  AND updated_at < NOW() - INTERVAL '30 minutes'
                FOR UPDATE SKIP LOCKED
            `;
            const { rows: stuckOrders } = await client.query(stuckQuery);

            for (const order of stuckOrders) {
                logger.warn(`⚖️ [RECON] Found stuck PAYMENT_PENDING order ${order.order_number}. Cancelling.`);
                try {
                    await OrderService.transitionTo(order.id, 'CANCELLED', { reason: 'Stuck Payment Cleanup' }, client);
                } catch (err) {
                    logger.error(`⚖️ [RECON] Failed to cancel stuck order ${order.order_number}:`, err);
                }
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
