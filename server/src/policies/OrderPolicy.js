class OrderPolicy {
    /**
     * Check if user can view the order
     * @param {Object} user 
     * @param {Object} order 
     * @returns {boolean}
     */
    static view(user, order) {
        if (!user || !order) return false;

        if (user.userType === 'admin') return true;

        const userId = String(user.id);
        const buyerId = String(order.buyer_id || order.buyerId);
        const sellerId = String(order.seller_id || order.sellerId);

        return userId === buyerId || userId === sellerId;
    }

    /**
     * Check if user can update order status
     * @param {Object} user 
     * @param {Object} order 
     * @param {string} newStatus 
     * @returns {boolean}
     */
    static updateStatus(user, order, newStatus) {
        if (!user || !order) return false;

        if (user.userType === 'admin') return true;

        const userId = String(user.id);
        const sellerId = String(order.seller_id || order.sellerId);
        const buyerId = String(order.buyer_id || order.buyerId);

        // Sellers can update most statuses except COMPLETED (which is confirmed by buyer)
        if (userId === sellerId) {
            return newStatus !== 'COMPLETED';
        }

        // Buyers can only move to COMPLETED (Confirm Receipt) or CANCELLED (if allowed)
        if (userId === buyerId) {
            return newStatus === 'COMPLETED' || newStatus === 'CANCELLED';
        }

        return false;
    }
}

export default OrderPolicy;
