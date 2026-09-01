import OrderService from '../../domains/orders/order/OrderService.js';

const CoreOrderService = {
    async updateOrderStatus(orderId, user, status) {
        return OrderService.updateOrderStatus(orderId, user, status);
    },

    async confirmBooking(orderId, sellerId) {
        return OrderService.confirmBooking(orderId, sellerId);
    },

    async cancelOrder(orderId, reason) {
        return OrderService.cancelOrder(orderId, reason);
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
