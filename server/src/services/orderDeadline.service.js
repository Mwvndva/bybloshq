// @ts-check
'use strict';

import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import whatsappService from './whatsapp.service.js';
import escrowManager from './EscrowManager.js';
import Order from '../models/order.model.js';
import Buyer from '../models/buyer.model.js';
import Product from '../models/product.model.js';
import ServiceSlot from '../models/serviceSlot.model.js';

class OrderDeadlineService {
    /**
     * Set seller drop-off deadline (48 hours from order creation)
     * @param {number} orderId
     */
    async setSellerDropoffDeadline(orderId) {
        try {
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 48);

            await Order.updateDeadline(pool, orderId, { sellerDropoff: deadline });

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

            await Order.updateDeadline(pool, orderId, { buyerPickup: deadline, readyForPickupAt: now });

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
            const expiredOrders = await Order.findExpiredSellerDeadlines();
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
            const expiredOrders = await Order.findExpiredBuyerDeadlines();
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
            const serviceOrders = await Order.findServiceOrdersForPaymentRelease();
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
     * Releases inventory for orders that weren't paid within 10 minutes
     */
    async checkExpiredReservations() {
        try {
            const expiredOrders = await Order.findExpiredReservations();
            if (expiredOrders.length === 0) return { processedCount: 0, orders: [] };

            logger.info(`Found ${expiredOrders.length} expired reservations to release`);

            for (const order of expiredOrders) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    // 1. Release Inventory
                    await Product.releaseInventory(client, order.items);

                    // 2. Release Service Slots (if any)
                    if (order.order_type === 'SERVICE') {
                        await ServiceSlot.releaseByOrderId(client, order.id);
                    }

                    // 3. Update Order Status
                    await Order.updateStatusWithExpiry(client, order.id);

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

            // Update order status
            await Order.updateStatusWithReason(client, order.id, 'CANCELLED', { auto_cancelled_reason: reason });

            // Refund buyer
            if (order.buyer_id) {
                await Buyer.adjustRefundBalance(client, order.buyer_id, order.total_amount);
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
     * Release service payment to seller
     * @param {any} order
     */
    async releaseServicePayment(order) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update order to completed
            await Order.updateStatusWithSideEffects(client, order.id, 'completed', 'completed');

            // Release funds through EscrowManager — the single source of truth
            // for all seller balance/revenue/sales updates and payouts table entries.
            const releaseResult = await escrowManager.releaseFunds(client, order, 'OrderDeadlineService');
            if (!releaseResult.success && !releaseResult.alreadyReleased) {
                throw new Error(
                    `EscrowManager.releaseFunds failed for order ${order.id}: ` +
                    `${releaseResult.reason || 'unknown reason'}`
                );
            }

            await client.query('COMMIT');

            logger.info(`Released service payment for order ${order.order_number}: KSh ${order.seller_payout_amount}`);

            // Send notification to buyer
            if (order.buyer_phone) {
                const serviceType = whatsappService.getServiceProviderType(order);
                const amount = Number.parseFloat(order.total_amount || 0);

                const msg = `✅ *SERVICE PAYMENT RELEASED*

Your service order is complete.

📦 Order #${order.order_number}
💰 Amount: KSh ${amount.toLocaleString()}

✅ Payment has been released to your ${serviceType}.

Thank you for using Byblos!`;

                await whatsappService.sendMessage(order.buyer_phone, msg);
            }

            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error releasing service payment for order ${order.order_number}:`, error);
            throw error;
        } finally {
            client.release();
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
            if (order.buyer_phone) {
                const buyerMsg = `❌ *ORDER AUTO-CANCELLED*

Order #${order.order_number} has been automatically cancelled.

💰 Amount: KSh ${amount.toLocaleString()}
📝 Reason: ${reason}

✅ *REFUND PROCESSED*
Your refund has been added to your account balance. You can withdraw it from your dashboard.

---
*Byblos Marketplace*`;

                await whatsappService.sendMessage(order.buyer_phone, buyerMsg);
            }

            // Notify seller
            if (order.seller_phone) {
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
                    await whatsappService.sendMessage(order.seller_phone, sellerMsg);
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
📞 *Buyer Phone:* ${order.buyer_phone || 'N/A'}
🏪 *Seller:* ${order.seller_name || 'N/A'}
📞 *Seller Phone:* ${order.seller_phone || 'N/A'}
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
