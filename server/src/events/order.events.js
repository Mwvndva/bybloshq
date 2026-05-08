import eventBus, { AppEvents } from './eventBus.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../shared/utils/logger.js';

async function deliverAll(context, eventId, deliveries) {
    const activeDeliveries = deliveries.filter(Boolean);
    if (!activeDeliveries.length) return;

    const results = await Promise.allSettled(activeDeliveries.map(delivery =>
        eventBus.deliverRecipient(eventId, delivery.key, delivery.run)
    ));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
        const error = new Error(`${context} delivery failed for ${failures.length} recipient(s)`);
        error.causes = failures.map(result => result.reason);
        error.retryable = failures.some(result => result.reason?.retryable !== false);
        throw error;
    }
}

/**
 * Handle ORDER.CREATED event
 */
eventBus.on(AppEvents.ORDER.CREATED, async ({ eventId, order, items, seller, buyer }) => {
    logger.info(`[Event:OrderCreated] Processing for Order #${order.order_number}`);
    await deliverAll('Event:OrderCreated', eventId, [
        { key: `order:${order.id}:seller:new`, run: () => whatsappService.notifySellerNewOrder(order) },
        { key: `order:${order.id}:buyer:confirmation`, run: () => whatsappService.notifyBuyerOrderConfirmation(order) }
    ]);
});

/**
 * Handle ORDER.PAID event
 */
eventBus.on(AppEvents.ORDER.PAID, async ({ eventId, order, items, seller, buyer }) => {
    logger.info(`[Event:OrderPaid] Processing for Order #${order.order_number}`);
    await deliverAll('Event:OrderPaid', eventId, [
        (order.fulfillment_type === 'SELLER_TO_HUB' || !seller.has_physical_shop)
            ? { key: `order:${order.id}:logistics:paid`, run: () => whatsappService.sendLogisticsNotification(order) }
            : null
    ]);
});

/**
 * Handle ORDER.UPDATED event
 */
eventBus.on(AppEvents.ORDER.UPDATED, async ({ eventId, payload }) => {
    if (!payload) return;
    await deliverAll('Event:OrderUpdated', eventId, [
        { key: `order:${payload.id || payload.order_id}:buyer:update`, run: () => whatsappService.notifyBuyerStatusUpdate(payload) },
        { key: `order:${payload.id || payload.order_id}:seller:update`, run: () => whatsappService.notifySellerStatusUpdate(payload) }
    ]);
});

/**
 * Handle ORDER.FULFILLED event
 */
eventBus.on(AppEvents.ORDER.FULFILLED, async ({ eventId, order, items = [] }) => {
    logger.info(`[Event:OrderFulfilled] Processing for Order #${order.id}`);

    const hasDigital = items.some(item => item.is_digital || String(item.product_type || '').toUpperCase() === 'DIGITAL');
    await deliverAll('Event:OrderFulfilled', eventId, [
        hasDigital ? { key: `order:${order.id}:buyer:digital`, run: () => whatsappService.notifyBuyerDigitalDelivery({ order, items }) } : null,
        { key: `order:${order.id}:buyer:payment_success`, run: () => whatsappService.notifyBuyerPaymentSuccess({ order, items }) },
        order.fulfillment_type === 'COURIER' ? { key: `order:${order.id}:courier:new`, run: () => whatsappService.notifyCourierNewOrder({ order, items }) } : null
    ]);
});

/**
 * Handle ORDER.CANCELLED event
 */
eventBus.on(AppEvents.ORDER.CANCELLED, async ({ eventId, order, items, seller, buyer, cancelledBy }) => {
    logger.info(`[Event:OrderCancelled] Processing for Order #${order.id}`);
    await deliverAll('Event:OrderCancelled', eventId, [
        { key: `order:${order.id}:buyer:cancelled`, run: () => whatsappService.sendBuyerOrderCancellationNotification(order, cancelledBy) },
        order.fulfillment_type === 'SELLER_TO_HUB'
            ? { key: `order:${order.id}:logistics:cancelled`, run: () => whatsappService.sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy) }
            : null
    ]);
});

eventBus.on(AppEvents.INVENTORY.LOW_STOCK, async ({ sellerPhone, productName, currentQuantity, threshold }) => {
    if (!sellerPhone) return;
    const message = `LOW STOCK ALERT\n\nProduct: *${productName}*\nCurrent Stock: *${currentQuantity} units*\nThreshold: ${threshold} units\n\nPlease restock soon to avoid running out.`;
    await whatsappService.sendMessage(sellerPhone, message);
});

eventBus.on(AppEvents.INVENTORY.OUT_OF_STOCK, async ({ sellerPhone, productName }) => {
    if (!sellerPhone) return;
    const message = `OUT OF STOCK ALERT\n\nProduct: *${productName}*\nStatus: *SOLD OUT*\n\nThis product is now unavailable for purchase. Please restock as soon as possible.`;
    await whatsappService.sendMessage(sellerPhone, message);
});

export default eventBus;
