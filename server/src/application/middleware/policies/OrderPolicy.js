class OrderPolicy {
    static view(user, order) {
        if (!user || !order) return false;
        if (user.userType === 'admin' || user.role === 'admin') return true;

        const orderSellerId = String(order.seller_id || order.sellerId || '');
        const orderBuyerId = String(order.buyer_id || order.buyerId || '');

        // Seller check: sellers.id vs sellers.id
        const userSellerId = String(user.sellerId || user.profileId || '');
        if (userSellerId && userSellerId === orderSellerId) return true;

        // Buyer check: buyers.id vs buyers.id
        const userBuyerId = String(user.buyerId || '');
        if (userBuyerId && userBuyerId === orderBuyerId) return true;

        return false;
    }

    static updateStatus(user, order, newStatus) {
        if (!user || !order) return false;
        if (user.userType === 'admin' || user.role === 'admin') return true;

        const orderSellerId = String(order.seller_id || order.sellerId || '');
        const orderBuyerId = String(order.buyer_id || order.buyerId || '');
        const userSellerId = String(user.sellerId || user.profileId || '');
        const userBuyerId = String(user.buyerId || '');

        // Sellers can update most statuses except COMPLETED
        if (userSellerId && userSellerId === orderSellerId) {
            return newStatus !== 'COMPLETED';
        }
        // Buyers can only complete or cancel
        if (userBuyerId && userBuyerId === orderBuyerId) {
            return newStatus === 'COMPLETED' || newStatus === 'CANCELLED';
        }
        return false;
    }
}

export default OrderPolicy;

