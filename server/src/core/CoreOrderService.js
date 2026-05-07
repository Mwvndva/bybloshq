/**
 * CoreOrderService — Unified Facade for Order Operations
 * 
 * This is the ONLY service controllers should import.
 * Internally delegates to the Legacy service or Modular service based on feature flags.
 * 
 * MIGRATION STRATEGY:
 *   - USE_MODULAR_ORDERS=false  (default) → uses legacy service, safe and tested
 *   - USE_MODULAR_ORDERS=true            → uses new modular service (Phase 2+)
 * 
 * NO-TOUCH ZONES: EscrowManager, payout locks, Redis locking — all preserved inside
 * the legacy service and untouched here.
 */
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

// ── Lazy imports to avoid circular startup issues ─────────────────
let _legacyService = null;
let _modularService = null;

const useModularOrders = () => process.env.USE_MODULAR_ORDERS === 'true';

async function getLegacyService() {
    if (!_legacyService) {
        const { default: svc } = await import('../services/order.service.js');
        _legacyService = svc;
    }
    return _legacyService;
}

async function getModularService() {
    if (!_modularService) {
        const { default: svc } = await import('../modules/orders/order.service.js');
        _modularService = svc;
    }
    return _modularService;
}

// ── Helper: resolve the active implementation ─────────────────────
async function getActiveService() {
    if (useModularOrders()) {
        try {
            return await getModularService();
        } catch (err) {
            logger.error('[CoreOrderService] Modular service unavailable, falling back to legacy:', err.message);
            return getLegacyService();
        }
    }
    return getLegacyService();
}

// ============================================================
// CoreOrderService — Public API
// ============================================================

const CoreOrderService = {
    /**
     * Create a new order. Delegates to legacy or modular service.
     * After creation, emits ORDER.CREATED for side effects.
     */
    async createOrder(orderData, client = null) {
        const svc = await getActiveService();
        const order = await svc.createOrder(orderData, client);

        // Emit async side effects (notifications etc.) — non-blocking
        setImmediate(() => {
            eventBus.emit(AppEvents.ORDER.CREATED, {
                order,
                items: orderData.metadata?.items || [],
                buyer: orderData.buyer,
                sellerId: orderData.sellerId
            });
        });

        return order;
    },

    /**
     * Update order status.
     */
    async updateOrderStatus(orderId, user, status) {
        const svc = await getActiveService();
        return svc.updateOrderStatus(orderId, user, status);
    },

    /**
     * Cancel an order and release inventory.
     */
    async cancelOrder(orderId, reason) {
        const svc = await getActiveService();
        const result = await svc.cancelOrder(orderId, reason);

        setImmediate(() => {
            eventBus.emit(AppEvents.ORDER.CANCELLED, {
                order: result,
                cancelledBy: reason || 'system'
            });
        });

        return result;
    },

    /**
     * Complete an order after successful payment.
     * Called internally by CorePaymentService — NOT by controllers directly.
     */
    async completeOrder(payment, client = null) {
        const svc = await getActiveService();
        const result = await svc.completeOrder(payment, client);

        setImmediate(() => {
            eventBus.emit(AppEvents.ORDER.PAID, {
                order: result,
                paymentId: payment.id
            });
        });

        return result;
    },

    /**
     * Buyer marks order as collected.
     */
    async markAsCollected(orderId, buyerId) {
        const svc = await getActiveService();
        return svc.markAsCollected(orderId, buyerId);
    },

    /**
     * Buyer confirms receipt of shipped order.
     */
    async confirmOrderReceipt(orderId, buyerId) {
        const svc = await getActiveService();
        return svc.confirmOrderReceipt(orderId, buyerId);
    },

    /**
     * Seller-created client order. This path is still legacy-only.
     */
    async createClientOrder(sellerId, orderData) {
        const svc = await getLegacyService();
        return svc.createClientOrder(sellerId, orderData);
    },

    /**
     * Get all orders with optional filters.
     * Delegates directly to legacy service (no event needed for reads).
     */
    async getOrders(filters) {
        const svc = await getLegacyService();
        return svc.getOrders(filters);
    },

    /**
     * Get a single order by ID.
     */
    async getOrderById(orderId, userId) {
        const svc = await getLegacyService();
        return svc.getOrderById(orderId, userId);
    },
};

export default CoreOrderService;
