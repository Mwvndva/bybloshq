import eventBus, { AppEvents } from './eventBus.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../shared/utils/logger.js';

/**
 * Handle ORDER.CREATED event
 */
eventBus.on(AppEvents.ORDER.CREATED, async ({ order, items, seller, buyer }) => {
    try {
        logger.info(`[Event:OrderCreated] Processing for Order #${order.order_number}`);

        // Notify Seller of New Order
        await whatsappService.notifySellerNewOrder(order).catch(err =>
            logger.error(`[Event:OrderCreated] Seller notification failed: ${err.message}`)
        );

        // Notify Buyer of Confirmation
        await whatsappService.notifyBuyerOrderConfirmation(order).catch(err =>
            logger.error(`[Event:OrderCreated] Buyer notification failed: ${err.message}`)
        );
    } catch (err) {
        logger.error(`[Event:OrderCreated] Critical failure in listener: ${err.message}`);
    }
});

/**
 * Handle ORDER.PAID event
 */
eventBus.on(AppEvents.ORDER.PAID, async ({ order, items, seller, buyer }) => {
    try {
        logger.info(`[Event:OrderPaid] Processing for Order #${order.order_number}`);

        // Notify Logistics if physical and needs pickup
        if (order.fulfillment_type === 'SELLER_TO_HUB' || !seller.has_physical_shop) {
            await whatsappService.sendLogisticsNotification(order).catch(err =>
                logger.error(`[Event:OrderPaid] Logistics notification failed: ${err.message}`)
            );
        }

        // Add additional side effects here (email, dash notifications)
    } catch (err) {
        logger.error(`[Event:OrderPaid] Critical failure in listener: ${err.message}`);
    }
});

/**
 * Handle ORDER.CANCELLED event
 */
eventBus.on(AppEvents.ORDER.CANCELLED, async ({ order, items, seller, buyer, cancelledBy }) => {
    try {
        logger.info(`[Event:OrderCancelled] Processing for Order #${order.id}`);

        await whatsappService.sendBuyerOrderCancellationNotification(order, cancelledBy).catch(err =>
            logger.error(`[Event:OrderCancelled] Buyer notification failed: ${err.message}`)
        );

        if (order.fulfillment_type === 'SELLER_TO_HUB') {
            await whatsappService.sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy).catch(err =>
                logger.error(`[Event:OrderCancelled] Logistics notification failed: ${err.message}`)
            );
        }
    } catch (err) {
        logger.error(`[Event:OrderCancelled] Critical failure in listener: ${err.message}`);
    }
});

export default eventBus;
