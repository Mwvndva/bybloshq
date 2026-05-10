// @ts-check
'use strict';

import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import { releaseOrderReservations } from '../shared/utils/reservationRelease.js';

class OrderDeadlineService {
    /**
     * Set seller drop-off deadline (48 hours from order creation)
     * @param {number} orderId
     */
    async setSellerDropoffDeadline(orderId) {
        try {
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 48);

            await pool.query(
                `UPDATE product_orders 
                 SET seller_dropoff_deadline = $1 
                 WHERE id = $2`,
                [deadline, orderId]
            );

            logger.info(`Set seller drop-off deadline for order ${orderId}: ${deadline.toISOString()}`);
            return deadline;
        } catch (error) {
            logger.error(`Error setting seller drop-off deadline for order ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Set buyer pickup deadline (24 hours from ready status)
     * @param {number} orderId
     */
    async setBuyerPickupDeadline(orderId) {
        try {
            const now = new Date();
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 24);

            await pool.query(
                `UPDATE product_orders 
                 SET buyer_pickup_deadline = $1,
                     ready_for_pickup_at = $2
                 WHERE id = $3`,
                [deadline, now, orderId]
            );

            logger.info(`Set buyer pickup deadline for order ${orderId}: ${deadline.toISOString()}`);
            return deadline;
        } catch (error) {
            logger.error(`Error setting buyer pickup deadline for order ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Check and process expired seller drop-off deadlines
     */
    async checkExpiredSellerDeadlines() {
        try {
            const result = await pool.query(
                `SELECT po.*, 
                        b.whatsapp_number as buyer_whatsapp, b.full_name as buyer_name, b.email as buyer_email,
                        s.whatsapp_number as seller_whatsapp, s.full_name as seller_name, s.physical_address as physical_address
                 FROM product_orders po
                 LEFT JOIN buyers b ON po.buyer_id = b.id
                 LEFT JOIN sellers s ON po.seller_id = s.id
                 WHERE po.seller_dropoff_deadline < NOW()
                   AND po.status = 'DELIVERY_PENDING'
                   AND po.auto_cancelled_reason IS NULL`
            );

            const expiredOrders = result.rows;
            logger.info(`Found ${expiredOrders.length} orders with expired seller drop-off deadlines`);

            for (const order of expiredOrders) {
                await this.cancelOrderAndRefund(
                    order,
                    'Seller failed to drop off items within 48 hours'
                );
            }

            return {
                processedCount: expiredOrders.length,
                orders: expiredOrders.map((o) => o.order_number)
            };
        } catch (error) {
            logger.error('Error checking expired seller deadlines:', error);
            throw error;
        }
    }

    /**
     * Check and process expired buyer pickup deadlines
     */
    async checkExpiredBuyerDeadlines() {
        try {
            const result = await pool.query(
                `SELECT po.*, 
                        b.whatsapp_number as buyer_whatsapp, b.full_name as buyer_name, b.email as buyer_email,
                        s.whatsapp_number as seller_whatsapp, s.full_name as seller_name, s.physical_address as physical_address
                 FROM product_orders po
                 LEFT JOIN buyers b ON po.buyer_id = b.id
                 LEFT JOIN sellers s ON po.seller_id = s.id
                 WHERE po.buyer_pickup_deadline < NOW()
                   AND po.status = 'DELIVERY_COMPLETE'
                   AND po.auto_cancelled_reason IS NULL`
            );

            const expiredOrders = result.rows;
            logger.info(`Found ${expiredOrders.length} orders with expired buyer pickup deadlines`);

            for (const order of expiredOrders) {
                await this.cancelOrderAndRefund(
                    order,
                    'Buyer failed to pick up order within 24 hours'
                );
            }

            return {
                processedCount: expiredOrders.length,
                orders: expiredOrders.map((/** @type {any} */ o) => o.order_number)
            };
        } catch (error) {
            logger.error('Error checking expired buyer deadlines:', error);
            throw error;
        }
    }

    /**
     * Legacy compatibility check for service payments.
     * Services now require buyer confirmation before seller funds are released.
     */
    async checkServicePaymentRelease() {
        try {
            const result = await pool.query(
                `SELECT po.id, po.order_number
                 FROM product_orders po
                 WHERE po.status = 'DELIVERY_COMPLETE'
                   AND po.payment_status != 'completed'
                   AND po.metadata->>'product_type' = 'service'
                   AND (po.metadata->>'booking_date')::timestamp < NOW() - INTERVAL '24 hours'`
            );

            const serviceOrders = result.rows;
            if (serviceOrders.length > 0) {
                logger.info(`Found ${serviceOrders.length} service orders awaiting buyer confirmation for payment release`);
            }

            return {
                processedCount: 0,
                awaitingBuyerConfirmation: serviceOrders.length,
                orders: serviceOrders.map((/** @type {any} */ o) => o.order_number)
            };
        } catch (error) {
            logger.error('Error checking service orders awaiting buyer confirmation:', error);
            throw error;
        }
    }

    /**
     * PIN-06: RESCUE EXPIRED RESERVATIONS
     * Releases inventory for orders that weren't paid within 10 minutes (or TTL)
     */
    async checkExpiredReservations() {
        try {
            const result = await pool.query(
                `SELECT po.id, po.order_number
                 FROM product_orders po
                 WHERE po.status IN ('RESERVED', 'HELD')
                   AND po.reservation_expires_at < NOW()
                 ORDER BY po.reservation_expires_at ASC
                 LIMIT 100`
            );

            const expiredOrders = result.rows;
            if (expiredOrders.length === 0) return { processedCount: 0, orders: [] };

            logger.info(`Found ${expiredOrders.length} expired reservations to release`);

            for (const order of expiredOrders) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    const { rows: lockedOrders } = await client.query(
                        `SELECT id, order_number
                         FROM product_orders
                         WHERE id = $1
                           AND status IN ('RESERVED', 'HELD')
                           AND reservation_expires_at < NOW()
                         FOR UPDATE SKIP LOCKED`,
                        [order.id]
                    );

                    if (lockedOrders.length === 0) {
                        await client.query('ROLLBACK');
                        continue;
                    }

                    await releaseOrderReservations(client, order.id);

                    await client.query(
                        `UPDATE product_orders 
                         SET status = 'EXPIRED',
                             metadata = COALESCE(metadata, '{}'::jsonb) || '{"expiry_reason": "Payment window exceeded"}'::jsonb,
                             updated_at = NOW()
                         WHERE id = $1
                           AND status IN ('RESERVED', 'HELD')`,
                        [order.id]
                    );

                    await client.query('COMMIT');
                    logger.info(`Released reservation for expired order ${order.order_number}`);
                } catch (err) {
                    await client.query('ROLLBACK');
                    logger.error(`Failed to release reservation for order ${order.order_number}:`, err);
                } finally {
                    client.release();
                }
            }

            return {
                processedCount: expiredOrders.length,
                orders: expiredOrders.map(o => o.order_number)
            };
        } catch (error) {
            logger.error('Error checking expired reservations:', error);
            throw error;
        }
    }

    /**
     * Cancel order and process refund
     * @param {any} order
     * @param {string} reason
     */
    async cancelOrderAndRefund(order, reason) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { rows: lockedOrders } = await client.query(
                `SELECT id, order_number, buyer_id, total_amount, status, auto_cancelled_reason
                 FROM product_orders
                 WHERE id = $1
                   AND auto_cancelled_reason IS NULL
                   AND status IN ('DELIVERY_PENDING', 'DELIVERY_COMPLETE')
                 FOR UPDATE SKIP LOCKED`,
                [order.id]
            );

            if (lockedOrders.length === 0) {
                await client.query('ROLLBACK');
                logger.info(`Order ${order.order_number} was already handled by another deadline worker.`);
                return false;
            }

            const lockedOrder = lockedOrders[0];

            await client.query(
                `UPDATE product_orders 
                 SET status = 'CANCELLED',
                     payment_status = 'failed',
                     auto_cancelled_reason = $1,
                     cancelled_at = NOW()
                 WHERE id = $2
                   AND auto_cancelled_reason IS NULL`,
                [reason, lockedOrder.id]
            );

            if (lockedOrder.buyer_id) {
                await client.query('SELECT id FROM buyers WHERE id = $1 FOR UPDATE', [lockedOrder.buyer_id]);
                await client.query(
                    `UPDATE buyers 
                     SET refunds = refunds + $1 
                     WHERE id = $2`,
                    [lockedOrder.total_amount, lockedOrder.buyer_id]
                );
            }

            await client.query('COMMIT');

            logger.info(`Auto-cancelled order ${order.order_number}: ${reason}`);

            // Send notifications
            await this.sendCancellationNotifications(order, reason);

            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error cancelling order ${order.order_number}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Disabled legacy path. Buyer confirmation is the only release trigger.
     * @param {any} order
     */
    async releaseServicePayment(order) {
        logger.warn(
            `Blocked automatic service payment release for order ${order?.order_number || order?.id || 'unknown'}; buyer confirmation is required`
        );
        throw new Error('Buyer confirmation is required to release service funds');
    }

    /**
     * Send cancellation notifications
     * @param {any} order
     * @param {string} reason
     */
    async sendCancellationNotifications(order, reason) {
        try {
            await eventBus.enqueueAndDispatch(AppEvents.ORDER.CANCELLED, {
                eventId: `order.cancelled:${order.id}:deadline`,
                order,
                cancelledBy: 'deadline',
                reason
            }, 'OrderDeadlineService.sendCancellationNotifications');
            logger.info(`Queued durable cancellation notification event for order ${order.order_number}`);
        } catch (error) {
            logger.error(`Error queueing cancellation notification event for order ${order.order_number}:`, error);
        }
    }

    /**
     * Run all deadline checks.
     * @returns {Promise<{
     *   reservations: {processedCount: number, orders: any[]},
     *   sellerDeadlines: {processedCount: number, orders: any[]},
     *   buyerDeadlines: {processedCount: number, orders: any[]},
     *   servicePayments: {processedCount: number, orders: any[]}
     * }>}
     */
    async runAllChecks() {
        logger.info('🔄 Running order deadline checks...');

        /** @type {{
         *  reservations: {processedCount: number, orders: any[]},
         *  sellerDeadlines: {processedCount: number, orders: any[]},
         *  buyerDeadlines: {processedCount: number, orders: any[]},
         *  servicePayments: {processedCount: number, orders: any[]}
         * }} */
        const results = {
            reservations: { processedCount: 0, orders: [] },
            sellerDeadlines: { processedCount: 0, orders: [] },
            buyerDeadlines: { processedCount: 0, orders: [] },
            servicePayments: { processedCount: 0, orders: [] }
        };

        try {
            results.reservations = await this.checkExpiredReservations();
            results.sellerDeadlines = await this.checkExpiredSellerDeadlines();
            results.buyerDeadlines = await this.checkExpiredBuyerDeadlines();
            results.servicePayments = await this.checkServicePaymentRelease();

            const totalProcessed =
                results.reservations.processedCount +
                results.sellerDeadlines.processedCount +
                results.buyerDeadlines.processedCount +
                results.servicePayments.processedCount;

            if (totalProcessed > 0) {
                logger.info(`✅ Order deadline checks completed. Processed ${totalProcessed} orders`, results);
            }

            return results;
        } catch (error) {
            logger.error('❌ Error running order deadline checks:', error);
            throw error;
        }
    }
}

export default new OrderDeadlineService();


