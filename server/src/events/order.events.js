import eventBus, { AppEvents } from './eventBus.js';
import whatsappService from '../services/whatsapp.service.js';
import notificationService from '../services/notification.service.js';
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

// Best-effort in-app feed write, delivered alongside the existing WhatsApp sends.
// Returns null (skipped) when the recipient has no user account; never throws, so a
// feed-write failure cannot fail the event or block the WhatsApp delivery.
async function orderUserIds(order, items = []) {
    try {
        const { order: n } = await loadNormalizedOrder(order, items);
        return { buyerUserId: n?.buyer?.userId || null, sellerUserId: n?.seller?.userId || null, orderNumber: n?.orderNumber || null };
    } catch {
        return { buyerUserId: null, sellerUserId: null, orderNumber: null };
    }
}

function feedDelivery(key, recipientUserId, recipientRole, notif) {
    if (!recipientUserId) return null;
    return {
        key,
        run: () => notificationService.send({
            recipientUserId,
            recipientRole,
            type: notif.type,
            title: notif.title,
            body: notif.body,
            data: notif.data || {},
            channels: ['in_app']
        }).catch(error => logger.warn('[Feed] in-app notification write failed', { key, error: error.message }))
    };
}

/**
 * Handle ORDER.CREATED event
 */
eventBus.on(AppEvents.ORDER.CREATED, async ({ eventId, order, items, seller, buyer }) => {
    const normalized = await loadNormalizedOrder(order, items);
    const notificationOrder = normalized.order;
    logger.info(`[Event:OrderCreated] Recorded Order #${notificationOrder.orderNumber || order.order_number}; WhatsApp waits for payment completion`);
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
    const orderId = payload.id || payload.order_id;
    const ids = await orderUserIds({ id: orderId });
    await deliverAll('Event:OrderUpdated', eventId, [
        { key: `order:${orderId}:buyer:update`, run: () => whatsappService.notifyBuyerStatusUpdate(payload) },
        { key: `order:${orderId}:seller:update`, run: () => whatsappService.notifySellerStatusUpdate(payload) },
        feedDelivery(`order:${orderId}:buyer:update:feed`, ids.buyerUserId, 'buyer', { type: 'order_update', title: `Order ${ids.orderNumber || orderId} update`, body: 'Your order status has been updated. Tap to view.', data: { path: '/buyer', orderId } }),
        feedDelivery(`order:${orderId}:seller:update:feed`, ids.sellerUserId, 'seller', { type: 'order_update', title: `Order ${ids.orderNumber || orderId} update`, body: 'An order status changed. Tap to view.', data: { path: '/seller', orderId } })
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
        { key: `order:${order.id}:seller:payment_success`, run: () => whatsappService.notifySellerStatusUpdate({
            buyer: notificationOrder.buyer,
            seller: notificationOrder.seller,
            order: notificationOrder,
            location: notificationOrder.location,
            newStatus: notificationOrder.status || 'AWAITING_SELLER_ACTION'
        }) },
        hasDigital ? feedDelivery(`order:${order.id}:buyer:digital:feed`, notificationOrder.buyer.userId, 'buyer', { type: 'order_digital_ready', title: 'Your files are ready', body: `Download your digital items for order ${notificationOrder.orderNumber}.`, data: { path: '/buyer', orderId: order.id } }) : null,
        feedDelivery(`order:${order.id}:buyer:payment_success:feed`, notificationOrder.buyer.userId, 'buyer', { type: 'order_payment_success', title: 'Payment confirmed', body: `We received your payment for order ${notificationOrder.orderNumber}.`, data: { path: '/buyer', orderId: order.id } }),
        feedDelivery(`order:${order.id}:seller:new_order:feed`, notificationOrder.seller.userId, 'seller', { type: 'order_new', title: 'New order received', body: `Order ${notificationOrder.orderNumber} · KES ${Number(notificationOrder.totalAmount || 0).toLocaleString('en-KE')} — tap to review.`, data: { path: '/seller', orderId: order.id } })
    ]);
});

/**
 * Handle ORDER.CANCELLED event
 */
eventBus.on(AppEvents.ORDER.CANCELLED, async ({ eventId, order, items, seller, buyer, cancelledBy }) => {
    logger.info(`[Event:OrderCancelled] Processing for Order #${order.id}`);
    const ids = await orderUserIds(order, items || []);
    await deliverAll('Event:OrderCancelled', eventId, [
        { key: `order:${order.id}:buyer:cancelled`, run: () => whatsappService.sendBuyerOrderCancellationNotification(order, cancelledBy) },
        order.fulfillment_type === 'SELLER_TO_HUB'
            ? { key: `order:${order.id}:logistics:cancelled`, run: () => whatsappService.sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy) }
            : null,
        feedDelivery(`order:${order.id}:buyer:cancelled:feed`, ids.buyerUserId, 'buyer', { type: 'order_cancelled', title: `Order ${ids.orderNumber || order.id} cancelled`, body: 'Your order has been cancelled.', data: { path: '/buyer', orderId: order.id } })
    ]);
});

eventBus.on(AppEvents.ORDER.CUSTOM_PRODUCTION_REMINDER, async ({ eventId, order }) => {
    logger.info(`[Event:CustomProductionReminder] Processing for Order #${order.id}`);
    const ids = await orderUserIds(order);
    await deliverAll('Event:CustomProductionReminder', eventId, [
        { key: `order:${order.id}:buyer:custom-production-reminder`, run: () => whatsappService.sendCustomProductionReminder(order, 'buyer') },
        { key: `order:${order.id}:seller:custom-production-reminder`, run: () => whatsappService.sendCustomProductionReminder(order, 'seller') },
        { key: `order:${order.id}:mzigo:custom-production-reminder`, run: () => whatsappService.sendCustomProductionReminder(order, 'partner') },
        feedDelivery(`order:${order.id}:buyer:custom-production-reminder:feed`, ids.buyerUserId, 'buyer', { type: 'custom_production_reminder', title: 'Custom order in progress', body: 'Your custom order is being prepared. Tap for details.', data: { path: '/buyer', orderId: order.id } }),
        feedDelivery(`order:${order.id}:seller:custom-production-reminder:feed`, ids.sellerUserId, 'seller', { type: 'custom_production_reminder', title: 'Custom order deadline approaching', body: 'A custom order needs to be prepared. Tap for details.', data: { path: '/seller', orderId: order.id } })
    ]);
});

eventBus.on(AppEvents.ORDER.CUSTOM_PRODUCTION_EXPIRED, async ({ eventId, order, reason }) => {
    logger.info(`[Event:CustomProductionExpired] Processing for Order #${order.id}`);
    const ids = await orderUserIds(order);
    await deliverAll('Event:CustomProductionExpired', eventId, [
        { key: `order:${order.id}:buyer:custom-production-expired`, run: () => whatsappService.sendCustomProductionExpiredNotification(order, 'buyer', reason) },
        { key: `order:${order.id}:seller:custom-production-expired`, run: () => whatsappService.sendCustomProductionExpiredNotification(order, 'seller', reason) },
        feedDelivery(`order:${order.id}:buyer:custom-production-expired:feed`, ids.buyerUserId, 'buyer', { type: 'custom_production_expired', title: 'Custom order update', body: 'There was an update to your custom order. Tap for details.', data: { path: '/buyer', orderId: order.id } }),
        feedDelivery(`order:${order.id}:seller:custom-production-expired:feed`, ids.sellerUserId, 'seller', { type: 'custom_production_expired', title: 'Custom order expired', body: 'A custom order production window expired. Tap for details.', data: { path: '/seller', orderId: order.id } })
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
