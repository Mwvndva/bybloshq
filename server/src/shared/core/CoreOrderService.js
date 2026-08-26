import OrderService from '../../domains/orders/order/OrderService.js';

const CoreOrderService = {
    async createOrder(orderData, client = null) {
        return OrderService.createOrder(orderData, client);
    },

    async updateOrderStatus(orderId, user, status) {
        return OrderService.updateOrderStatus(orderId, user, status);
    },

    async selectHubDropoff(orderId, sellerId) {
        return OrderService.selectHubDropoff(orderId, sellerId);
    },

    async markDroppedAtHub(orderId, sellerId) {
        return OrderService.markDroppedAtHub(orderId, sellerId);
    },

    async confirmBooking(orderId, sellerId) {
        return OrderService.confirmBooking(orderId, sellerId);
    },

    async cancelOrder(orderId, reason) {
        return OrderService.cancelOrder(orderId, reason);
    },

    async completeOrder(payment, client = null) {
        return OrderService.completeOrder(payment, client);
    },

    async markAsCollected(orderId, buyerId) {
        return OrderService.markAsCollected(orderId, buyerId);
    },

    async confirmOrderReceipt(orderId, buyerId) {
        return OrderService.confirmOrderReceipt(orderId, buyerId);
    },

    async getOrders(filters) {
        return OrderService.getOrders(filters);
    },

    async getOrderById(orderId, userId) {
        return OrderService.getOrderById(orderId, userId);
    },
};

export default CoreOrderService;
