class ProductPolicy {
    static manage(user, product) {
        if (!user || !product) return false;
        if (user.userType === 'admin' || user.role === 'admin') return true;

        // product.seller_id is sellers.id (profile ID, NOT users.id)
        const productSellerId = product.seller_id || product.sellerId;

        // Primary: req.user.sellerId is sellers.id set by crossRoles in auth.js
        if (user.sellerId && String(user.sellerId) === String(productSellerId)) {
            return true;
        }
        // Secondary: profileId is sellers.id for seller-type JWT
        if (user.profileId && String(user.profileId) === String(productSellerId)) {
            return true;
        }
        return false;
    }
}

export default ProductPolicy;

