// @ts-check
'use strict';

import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import whatsappService from './whatsapp.service.js';

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
                        b.phone as buyer_phone, b.full_name as buyer_name, b.email as buyer_email,
                        s.phone as seller_phone, s.full_name as seller_name
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
                        b.phone as buyer_phone, b.full_name as buyer_name, b.email as buyer_email,
                        s.phone as seller_phone, s.full_name as seller_name
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
                        b.phone as buyer_phone, b.full_name as buyer_name, b.email as buyer_email,
                        s.phone as seller_phone, s.full_name as seller_name, s.balance as seller_balance
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
     * Cancel order and process refund
     * @param {any} order
     * @param {string} reason
     */
    async cancelOrderAndRefund(order, reason) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update order status
            await client.query(
                `UPDATE product_orders 
                 SET status = 'CANCELLED',
                     auto_cancelled_reason = $1,
                     cancelled_at = NOW()
                 WHERE id = $2`,
                [reason, order.id]
            );

            // Refund buyer
            if (order.buyer_id) {
                await client.query(
                    `UPDATE buyers 
                     SET refunds = refunds + $1 
                     WHERE id = $2`,
                    [order.total_amount, order.buyer_id]
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
     * Release service payment to seller
     * @param {any} order
     */
    async releaseServicePayment(order) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update order to completed
            await client.query(
                `UPDATE product_orders 
                 SET status = 'COMPLETED',
                     payment_status = 'completed',
                     payment_completed_at = NOW(),
                     completed_at = NOW()
                 WHERE id = $1`,
                [order.id]
            );

            // Add revenue to seller balance
            await client.query(
                `UPDATE sellers 
                 SET balance = balance + $1,
                     total_sales = total_sales + $2,
                     net_revenue = net_revenue + $1
                 WHERE id = $3`,
                [order.seller_payout_amount, order.total_amount, order.seller_id]
            );

            await client.query('COMMIT');

            logger.info(`Released service payment for order ${order.order_number}: KSh ${order.seller_payout_amount}`);

            // Send notification to buyer
            if (order.buyer_phone) {
                const serviceType = whatsappService.getServiceProviderType(order);
                const amount = parseFloat(order.total_amount || 0);

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
            const amount = parseFloat(order.total_amount || 0);
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

            logger.info(`Sent cancellation notifications for order ${order.order_number}`);
        } catch (error) {
            logger.error(`Error sending cancellation notifications for order ${order.order_number}:`, error);
            // Don't throw - notifications are not critical
        }
    }

    /**
     * Run all deadline checks
     * @returns {Promise<{sellerDeadlines: {processedCount: number, orders: any[]}, buyerDeadlines: {processedCount: number, orders: any[]}, servicePayments: {processedCount: number, orders: any[]}}>}
     */
    async runAllChecks() {
        logger.info('🔄 Running order deadline checks...');

        /** @type {{sellerDeadlines: {processedCount: number, orders: any[]}, buyerDeadlines: {processedCount: number, orders: any[]}, servicePayments: {processedCount: number, orders: any[]}}} */
        const results = {
            sellerDeadlines: { processedCount: 0, orders: [] },
            buyerDeadlines: { processedCount: 0, orders: [] },
            servicePayments: { processedCount: 0, orders: [] }
        };

        try {
            results.sellerDeadlines = await this.checkExpiredSellerDeadlines();
            results.buyerDeadlines = await this.checkExpiredBuyerDeadlines();
            results.servicePayments = await this.checkServicePaymentRelease();

            const totalProcessed =
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
