import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { OrderStatus, OrderType } from '../shared/constants/enums.js';
import Order from '../models/order.model.js';
import BookingService from '../modules/bookings/booking.service.js';
import { assertValidTransition } from '../shared/utils/OrderStatusGuard.js';
import InventoryReservationService from './inventoryReservation.service.js';

class OrderFulfillmentTransitionService {
    static async executeFulfillment(client, order) {
        const orderId = order.id;

        if (order.status !== OrderStatus.PAID) {
            logger.warn(`[FULFILLMENT] Order ${orderId} is not in PAID status (Current: ${order.status}). skipping.`);
            return;
        }

        const items = await this.fetchFulfillmentItems(client, orderId);
        const orderType = order.order_type;
        logger.info(`[FULFILLMENT] Starting execution for Order ${orderId} (${orderType})`);

        if (orderType === OrderType.PHYSICAL) {
            await this.completePhysicalOrder(client, order, items);
        } else if (orderType === OrderType.SERVICE) {
            await this.completeServiceOrder(client, order);
        } else if (orderType === OrderType.DIGITAL) {
            await this.completeDigitalOrder(client, order, items);
        } else {
            throw new Error(`Unknown order type: ${orderType}`);
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
        assertValidTransition(order.status, OrderStatus.FULFILLMENT_PENDING, order.id);
        await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.FULFILLMENT_PENDING, 'completed');

        await InventoryReservationService.commitReservedInventory(client, items);

        try {
            const { rows } = await client.query('SELECT * FROM product_orders WHERE id = $1 FOR UPDATE', [order.id]);
            const currentOrder = rows[0];

            await this.preparePhysicalFulfillment(currentOrder);

            assertValidTransition(currentOrder.status, OrderStatus.FULFILLED, order.id);
            await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.FULFILLED, 'completed');
        } catch (err) {
            logger.error(`[FULFILLMENT-PHYSICAL] Failed initiation for Order ${order.id}:`, err);
            throw err;
        }
    }

    static async completeServiceOrder(client, order) {
        assertValidTransition(order.status, OrderStatus.BOOKED, order.id);
        await BookingService.finalizeSlot(client, order.id);
        await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.BOOKED, 'completed');
    }

    static async completeDigitalOrder(client, order, items) {
        assertValidTransition(order.status, OrderStatus.DELIVERY_PENDING, order.id);
        await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.DELIVERY_PENDING, 'completed');

        try {
            await this.grantDigitalAccess(client, order, items);

            assertValidTransition(OrderStatus.DELIVERY_PENDING, OrderStatus.DELIVERED, order.id);
            await Order.updateStatusWithSideEffects(client, order.id, OrderStatus.DELIVERED, 'completed');
        } catch (err) {
            logger.error(`[FULFILLMENT-DIGITAL] Failed delivery for Order ${order.id}:`, err);
            throw err;
        }
    }

    static async preparePhysicalFulfillment(order) {
        logger.info(`[FULFILLMENT-PHYSICAL] DB fulfillment prepared for Order ${order.id}; notifications deferred until commit.`);
    }

    static async grantDigitalAccess(client, order, items) {
        for (const item of items) {
            if (item.is_digital) {
                const accessToken = crypto.randomBytes(32).toString('hex');
                await client.query(
                    `INSERT INTO digital_access (order_id, user_id, access_token)
                     VALUES ($1, $2, $3)`,
                    [order.id, order.buyer_id, accessToken]
                );
            }
        }
        logger.info(`[FULFILLMENT-DIGITAL] Digital access granted for order ${order.id}; delivery notification is emitted after commit.`);
    }
}

export default OrderFulfillmentTransitionService;
