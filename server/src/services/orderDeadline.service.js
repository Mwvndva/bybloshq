// @ts-check
'use strict';

import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import whatsappService from './whatsapp.service.js';
import escrowManager from './EscrowManager.js';
import OrderService from '../modules/orders/order.service.js';

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
     * Check and release service payments (24 hours after booking date)
     */
    async checkServicePaymentRelease() {
        try {
            const result = await pool.query(
                `SELECT po.*, 
                        b.whatsapp_number as buyer_whatsapp, b.full_name as buyer_name, b.email as buyer_email,
                        s.whatsapp_number as seller_whatsapp, s.full_name as seller_name, s.balance as seller_balance, s.physical_address as physical_address
                 FROM product_orders po
                 LEFT JOIN buyers b ON po.buyer_id = b.id
                 LEFT JOIN sellers s ON po.seller_id = s.id
                 WHERE po.status = 'DELIVERY_COMPLETE'
                   AND po.payment_status != 'completed'
                   AND po.metadata->>'product_type' = 'service'
                   AND (po.metadata->>'booking_date')::timestamp < NOW() - INTERVAL '24 hours'`
            );

            const serviceOrders = result.rows;
            logger.info(`Found ${serviceOrders.length} service orders ready for payment release`);

            for (const order of serviceOrders) {
                await this.releaseServicePayment(order);
            }

            return {
                processedCount: serviceOrders.length,
                orders: serviceOrders.map((/** @type {any} */ o) => o.order_number)
            };
        } catch (error) {
            logger.error('Error checking service payment release:', error);
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
                `SELECT po.id, po.order_number, po.status, po.order_type,
                        json_agg(json_build_object('productId', oi.product_id, 'quantity', oi.quantity, 'trackInventory', (p.track_inventory = true))) as items
                 FROM product_orders po
                 JOIN order_items oi ON po.id = oi.order_id
                 JOIN products p ON oi.product_id = p.id
                 WHERE po.status IN ('RESERVED', 'HELD')
                   AND po.reservation_expires_at < NOW()
                 GROUP BY po.id`
            );

            const expiredOrders = result.rows;
            if (expiredOrders.length === 0) return { processedCount: 0, orders: [] };

            logger.info(`Found ${expiredOrders.length} expired reservations to release`);

            for (const order of expiredOrders) {
                try {
                    // Transition to EXPIRED via State Machine (handles inventory recovery)
                    await OrderService.transitionTo(order.id, 'EXPIRED', { reason: 'Reservation TTL exceeded' });
                    logger.info(`Released reservation for expired order ${order.order_number} via State Machine`);
                } catch (err) {
                    logger.error(`Failed to release reservation for order ${order.order_number}:`, err);
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
        try {
            // Transition to CANCELLED via State Machine (handles inventory, slots, and refunds)
            await OrderService.transitionTo(order.id, 'CANCELLED', { reason });
            logger.info(`Auto-cancelled order ${order.order_number}: ${reason} via State Machine`);

            // Send notifications
            await this.sendCancellationNotifications(order, reason);
            return true;
        } catch (error) {
            logger.error(`Error auto-cancelling order ${order.order_number}:`, error);
            throw error;
        }
    }

    /**
     * Release service payment to seller
     * @param {any} order
     */
    async releaseServicePayment(order) {
        try {
            // Transition to COMPLETED via State Machine
            // Note: In Phase 3, we should ensure the state machine handles escrow release or 
            // keep it here if it's too specific. For now, transition first.
            await OrderService.transitionTo(order.id, 'COMPLETED', { reason: 'Deadline service completion' });
            logger.info(`Released service payment for order ${order.order_number} via State Machine`);

            // Send notification to buyer
            if (order.buyer_whatsapp) {
                const serviceType = whatsappService.getServiceProviderType(order);
                const amount = Number.parseFloat(order.total_amount || 0);

                const msg = `✅ *SERVICE PAYMENT RELEASED*

Your service order is complete.

📦 Order #${order.order_number}
💰 Amount: KSh ${amount.toLocaleString()}

✅ Payment has been released to your ${serviceType}.

Thank you for using Byblos!`;

                await whatsappService.sendMessage(order.buyer_whatsapp, msg);
            }

            return true;
        } catch (error) {
            logger.error(`Error releasing service payment for order ${order.order_number}:`, error);
            throw error;
        }
    }

    /**
     * Send cancellation notifications
     * @param {any} order
     * @param {string} reason
     */
    async sendCancellationNotifications(order, reason) {
        try {
            const amount = Number.parseFloat(order.total_amount || 0);
            const isBuyerFault = reason.includes('Buyer failed');
            const isSellerFault = reason.includes('Seller failed');

            // Notify buyer
            if (order.buyer_whatsapp) {
                const buyerMsg = `❌ *ORDER AUTO-CANCELLED*

Order #${order.order_number} has been automatically cancelled.

💰 Amount: KSh ${amount.toLocaleString()}
📝 Reason: ${reason}

✅ *REFUND PROCESSED*
Your refund has been added to your account balance. You can withdraw it from your dashboard.

---
*Byblos Marketplace*`;

                await whatsappService.sendMessage(order.buyer_whatsapp, buyerMsg);
            }

            // Notify seller
            if (order.seller_whatsapp) {
                let sellerMsg = '';

                if (isSellerFault) {
                    sellerMsg = `❌ *ORDER AUTO-CANCELLED*

Order #${order.order_number} has been automatically cancelled.

💰 Amount: KSh ${amount.toLocaleString()}
📝 Reason: ${reason}

⚠️ *IMPORTANT*
You failed to drop off the items within the 48-hour deadline. The buyer has been refunded.

Please ensure timely delivery for future orders to avoid cancellations.

---
*Byblos Marketplace*`;
                } else if (isBuyerFault) {
                    sellerMsg = `❌ *ORDER AUTO-CANCELLED*

Order #${order.order_number} has been automatically cancelled.

💰 Amount: KSh ${amount.toLocaleString()}
📝 Reason: ${reason}

ℹ️ The buyer did not pick up the order within 24 hours. They have been refunded.

---
*Byblos Marketplace*`;
                }

                if (sellerMsg) {
                    await whatsappService.sendMessage(order.seller_whatsapp, sellerMsg);
                }
            }

            // Notify courier if this was a logistics delivery order
            // (physical product, seller had no shop address)
            const isDeliveryOrder = !order.physical_address &&
                order.metadata?.product_type !== 'service' &&
                order.metadata?.product_type !== 'digital'

            if (isDeliveryOrder) {
                const COURIER_NUMBER = process.env.COURIER_WHATSAPP_NUMBER || '0748137819'
                const cancelMsg = `
❌ *ORDER CANCELLED — DELIVERY CANCELLED*

📦 *Order #${order.order_number}*
💰 *Amount:* KSh ${Number.parseFloat(order.total_amount || 0).toLocaleString()}

📝 *Reason:* ${reason}

⚠️ *ACTION REQUIRED:*
Please do NOT collect this order from the seller.
If already collected, please contact the seller to arrange return.

👤 *Buyer:* ${order.buyer_name || 'N/A'}
📞 *Buyer Phone:* ${order.buyer_whatsapp || 'N/A'}
🏪 *Seller:* ${order.seller_name || 'N/A'}
📞 *Seller Phone:* ${order.seller_whatsapp || 'N/A'}
      `.trim()

                await whatsappService.sendMessage(COURIER_NUMBER, cancelMsg)
                    .catch(err => logger.error(`[DEADLINE] Courier cancellation notification failed for order ${order.order_number}:`, err.message))

                logger.info(`[DEADLINE] Courier cancellation notification sent for order ${order.order_number}`)
            }

            logger.info(`Sent cancellation notifications for order ${order.order_number}`);
        } catch (error) {
            logger.error(`Error sending cancellation notifications for order ${order.order_number}:`, error);
            // Don't throw - notifications are not critical
        }
    }

    /**
     * Run all deadline checks
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


