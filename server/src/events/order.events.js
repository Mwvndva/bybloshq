import eventBus, { AppEvents } from './eventBus.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../shared/utils/logger.js';
import OrderReadService from '../services/orderRead.service.js';
import OrderNotificationPayloadService from '../services/orderNotificationPayload.service.js';

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

async function loadNormalizedOrder(order, fallbackItems = []) {
    if (!order?.id) return { order, items: fallbackItems };

    try {
        const details = await OrderReadService.getStatusNotificationDetails(order.id);
        if (!details?.fullOrder) return { order, items: fallbackItems };

        const fullOrder = OrderNotificationPayloadService.extractFromLegacy(details.fullOrder);
        const items = details.items?.length ? details.items : fallbackItems;
        return {
            order: OrderNotificationPayloadService.prepareNormalizedNotificationPayload(fullOrder, items),
            items
        };
    } catch (error) {
        logger.warn('[Event:OrderNotification] Failed to normalize order payload; using event payload', {
            orderId: order.id,
            error: error.message
        });
        return { order, items: fallbackItems };
    }
}

/**
 * Handle ORDER.CREATED event
 */
eventBus.on(AppEvents.ORDER.CREATED, async ({ eventId, order, items, seller, buyer }) => {
    const normalized = await loadNormalizedOrder(order, items);
    const notificationOrder = normalized.order;
    logger.info(`[Event:OrderCreated] Processing for Order #${notificationOrder.orderNumber || order.order_number}`);
    await deliverAll('Event:OrderCreated', eventId, [
        { key: `order:${order.id}:seller:new`, run: () => whatsappService.notifySellerNewOrder(notificationOrder) },
        { key: `order:${order.id}:buyer:confirmation`, run: () => whatsappService.notifyBuyerOrderConfirmation(notificationOrder) }
    ]);
});

/**
 * Handle ORDER.PAID event
 */
eventBus.on(AppEvents.ORDER.PAID, async ({ eventId, order, items, seller, buyer }) => {
    logger.info(`[Event:OrderPaid] Processing for Order #${order.order_number}`);
    // Door-delivery and seller-pickup WhatsApp messages are sent only from
    // logistics.notification after the logistics leg has been durably updated.
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

    const normalized = await loadNormalizedOrder(order, items);
    const notificationOrder = normalized.order;
    const notificationItems = normalized.items;
    const hasDigital = notificationItems.some(item => item.is_digital || String(item.product_type || '').toUpperCase() === 'DIGITAL');
    await deliverAll('Event:OrderFulfilled', eventId, [
        hasDigital ? { key: `order:${order.id}:buyer:digital`, run: () => whatsappService.notifyBuyerDigitalDelivery({ order: notificationOrder, items: notificationItems }) } : null,
        { key: `order:${order.id}:buyer:payment_success`, run: () => whatsappService.notifyBuyerPaymentSuccess({ order: notificationOrder, items: notificationItems }) },
        notificationOrder.fulfillmentType === 'COURIER' ? { key: `order:${order.id}:courier:new`, run: () => whatsappService.notifyCourierNewOrder({ order: notificationOrder, items: notificationItems }) } : null
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
