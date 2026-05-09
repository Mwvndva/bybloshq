/**
 * CoreOrderService - Unified facade for order operations.
 *
 * Controllers import this facade, but every runtime mutation is intentionally
 * pinned to the hardened order service until the modular order stack has
 * equivalent payment, inventory, idempotency, and escrow coverage.
 */

let legacyService = null;

function assertModularOrdersDisabled() {
    if (process.env.USE_MODULAR_ORDERS === 'true') {
        throw new Error('USE_MODULAR_ORDERS is hard-disabled: modular order handling is not production-ready. Unset the flag and use the hardened order service.');
    }
}

assertModularOrdersDisabled();

async function getLegacyService() {
    assertModularOrdersDisabled();
    if (!legacyService) {
        const { default: svc } = await import('../services/order.service.js');
        legacyService = svc;
    }
    return legacyService;
}

const CoreOrderService = {
    async createOrder(orderData, client = null) {
        const svc = await getLegacyService();
        return svc.createOrder(orderData, client);
    },

    async updateOrderStatus(orderId, user, status) {
        const svc = await getLegacyService();
        return svc.updateOrderStatus(orderId, user, status);
    },

    async cancelOrder(orderId, reason) {
        const svc = await getLegacyService();
        return svc.cancelOrder(orderId, reason);
    },

    async completeOrder(payment, client = null) {
        const svc = await getLegacyService();
        return svc.completeOrder(payment, client);
    },

    async markAsCollected(orderId, buyerId) {
        const svc = await getLegacyService();
        return svc.markAsCollected(orderId, buyerId);
    },

    async confirmOrderReceipt(orderId, buyerId) {
        const svc = await getLegacyService();
        return svc.confirmOrderReceipt(orderId, buyerId);
    },

    async getOrders(filters) {
        const svc = await getLegacyService();
        return svc.getOrders(filters);
    },

    async getOrderById(orderId, userId) {
        const svc = await getLegacyService();
        return svc.getOrderById(orderId, userId);
    },
};

export default CoreOrderService;
