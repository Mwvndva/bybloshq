import crypto from 'node:crypto';
import logger from '../../../shared/utils/logger.js';
import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';
import Order from './order.model.js';
import { assertValidTransition } from '../../../shared/utils/OrderStatusGuard.js';
import InventoryReservationService from '../../commerce/products/inventoryReservation.service.js';
import escrowManager from '../escrow/EscrowManager.js';

class OrderFulfillmentTransitionService {
    static async executeFulfillment(client, order) {
        const orderId = order.id;
        const currentStatus = String(order.status || '').toUpperCase();

        if (currentStatus !== OrderStatus.PAID && currentStatus !== OrderStatus.FULFILLING) {
            logger.warn(`[FULFILLMENT] Order ${orderId} is not in PAID or FULFILLING status (Current: ${order.status}). skipping.`);
            return;
        }

        const items = await this.fetchFulfillmentItems(client, orderId);
        const orderType = String(order.order_type || '').toUpperCase();
        logger.info(`[FULFILLMENT] Starting execution for Order ${orderId} (${orderType || 'auto-detect'})`);

        if (orderType === OrderType.PHYSICAL || (!orderType && items.some(i => !i.is_digital))) {
            await this.completePhysicalOrder(client, order, items);
        } else if (orderType === OrderType.SERVICE) {
            await this.completeServiceOrder(client, order);
        } else if (orderType === OrderType.DIGITAL || (!orderType && items.every(i => i.is_digital))) {
            await this.completeDigitalOrder(client, order, items);
        } else {
            throw new Error(`Unknown order type: ${order.order_type}`);
        }
    }

    static async fetchFulfillmentItems(client, orderId) {
        const { rows } = await client.query(
            `SELECT oi.*, p.product_type::text AS product_type, p.is_digital,
                    p.service_options, p.track_inventory, p.name AS product_name
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [orderId]
        );
        return rows;
    }

    static async completePhysicalOrder(client, order, items) {
        await InventoryReservationService.commitReservedInventory(client, items);

        try {
            const { rows } = await client.query('SELECT * FROM product_orders WHERE id = $1 FOR UPDATE', [order.id]);
            const currentOrder = rows[0];

            await this.preparePhysicalFulfillment(currentOrder);

            if (currentOrder.status !== OrderStatus.AWAITING_SELLER_ACTION) {
                assertValidTransition(currentOrder.status, OrderStatus.AWAITING_SELLER_ACTION, order.id);
                await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.AWAITING_SELLER_ACTION, 'completed');
            }
        } catch (err) {
            logger.error(`[FULFILLMENT-PHYSICAL] Failed initiation for Order ${order.id}:`, err);
            throw err;
        }
    }

    static async completeServiceOrder(client, order) {
        if (order.status !== OrderStatus.AWAITING_SELLER_ACTION) {
            assertValidTransition(order.status, OrderStatus.AWAITING_SELLER_ACTION, order.id);
            await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.AWAITING_SELLER_ACTION, 'completed');
        }
    }

    static async completeDigitalOrder(client, order, items) {
        if (order.status !== OrderStatus.FULFILLING && order.status !== OrderStatus.COMPLETED) {
            assertValidTransition(order.status, OrderStatus.FULFILLING, order.id);
            await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.FULFILLING, 'completed');
        }

        try {
            await this.grantDigitalAccess(client, order, items);

            assertValidTransition(OrderStatus.FULFILLING, OrderStatus.COMPLETED, order.id);
            const digitalCompletionMetadata = {
                completed_by: 'system',
                completion_reason: 'digital_fulfillment_completed',
                financial_finality: true,
                completed_at: new Date().toISOString()
            };
            await client.query(
                `UPDATE product_orders
                 SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                 WHERE id = $1`,
                [order.id, JSON.stringify(digitalCompletionMetadata)]
            );
            const completedOrder = await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.COMPLETED, 'completed');
            const releaseResult = await escrowManager.releaseFunds(client, completedOrder, 'DigitalFulfillment');

            if (!releaseResult.success && !releaseResult.alreadyReleased) {
                throw new Error(`Digital escrow release blocked: ${releaseResult.reason || 'unknown_reason'}`);
            }
        } catch (err) {
            logger.error(`[FULFILLMENT-DIGITAL] Failed delivery for Order ${order.id}:`, err);
            throw err;
        }
    }

    static async preparePhysicalFulfillment(order) {
        logger.info(`[FULFILLMENT-PHYSICAL] DB fulfillment prepared for Order ${order.id}; notifications deferred until commit.`);
    }

    static async grantDigitalAccess(client, order, items) {
        let authUserId = null;
        if (order.buyer_id) {
            const { rows: buyerRows } = await client.query(
                `SELECT user_id FROM buyers WHERE id = $1`,
                [order.buyer_id]
            );
            authUserId = buyerRows[0]?.user_id || null;
        }

        for (const item of items) {
            if (item.is_digital) {
                const accessToken = crypto.randomBytes(32).toString('hex');
                await client.query(
                    `INSERT INTO digital_access (order_id, buyer_id, user_id, access_token)
                     VALUES ($1, $2, $3, $4)`,
                    [order.id, order.buyer_id || null, authUserId, accessToken]
                );
            }
        }
        logger.info(`[FULFILLMENT-DIGITAL] Digital access granted for order ${order.id}; delivery notification is emitted after commit.`);
    }
}

export default OrderFulfillmentTransitionService;
