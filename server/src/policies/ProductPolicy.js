class ProductPolicy {
    /**
     * Check if user can manage the product
     * @param {Object} user 
     * @param {Object} product 
     * @returns {boolean}
     */
    static manage(user, product) {
        if (!user || !product) return false;

        // Admin can manage everything
        if (user.userType === 'admin') return true;

        // Only the owner can manage the product
        // Note: product.seller_id or product.sellerId depending on how it's fetched
        const sellerId = product.seller_id || product.sellerId;

        // Match user ID. For sellers, req.user.id is usually their profile ID.
        return String(user.id) === String(sellerId);
    }
}

export default ProductPolicy;
