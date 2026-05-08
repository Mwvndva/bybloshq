import ActiveOrderService from '../../services/order.service.js';
import logger from '../../shared/utils/logger.js';

/**
 * Compatibility facade for the deprecated modules/orders path.
 *
 * The active runtime order implementation lives in src/services/order.service.js.
 * Keeping this facade prevents accidental reactivation of the old module-level
 * reservation logic, which did not share the hardened checkout idempotency and
 * inventory locking guarantees.
 */
class OrderService {
    static async createOrder(orderData, externalClient = null) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.createOrder');
        return ActiveOrderService.createOrder(orderData, externalClient);
    }

    static async generateOrderNumber(client) {
        return ActiveOrderService.generateOrderNumber(client);
    }

    static async updateOrderStatus(orderId, user, status) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.updateOrderStatus');
        return ActiveOrderService.updateOrderStatus(orderId, user, status);
    }

    static async cancelOrder(orderId, reason) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.cancelOrder');
        return ActiveOrderService.cancelOrder(orderId, reason);
    }

    static async completeOrder(payment, client = null) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.completeOrder');
        return ActiveOrderService.completeOrder(payment, client);
    }

    static async markAsCollected(orderId, buyerId) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.markAsCollected');
        return ActiveOrderService.markAsCollected(orderId, buyerId);
    }

    static async confirmOrderReceipt(orderId, buyerId) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.confirmOrderReceipt');
        return ActiveOrderService.confirmOrderReceipt(orderId, buyerId);
    }

    static async createClientOrder(sellerId, orderData) {
        logger.warn('[SHADOW-ORDER-SERVICE] Deprecated modules/orders service delegated to active OrderService.createClientOrder');
        return ActiveOrderService.createClientOrder(sellerId, orderData);
    }

    static async getOrders(filters) {
        return ActiveOrderService.getOrders(filters);
    }

    static async getOrderById(orderId, userId) {
        return ActiveOrderService.getOrderById(orderId, userId);
    }
}

export default OrderService;
