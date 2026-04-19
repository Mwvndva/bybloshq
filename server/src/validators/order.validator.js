/**
 * ORDER VALIDATOR
 * Explicit entry-point guard for order creation.
 * Called at the very start of OrderService.createOrder before any DB work.
 */

/**
 * Validate normalized order input. Throws immediately if required fields are missing.
 * @param {Object} data - Normalized order object (output of normalizeOrderInput or equivalent)
 */
export function validateOrderInput(data) {
    if (!data?.buyer?.email) {
        throw new Error('Order validation failed: buyer.email is required');
    }

    if (!data.sellerId && !data.seller_id) {
        throw new Error('Order validation failed: seller_id is required');
    }

    const items = data.metadata?.items ?? [];
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Order validation failed: order must contain at least one item');
    }
}

/**
 * Replaces all undefined values with null before DB binding.
 * Prevents `undefined` from leaking into parameterized queries.
 *
 * @param {Object} obj
 * @returns {Object} Same object with undefined replaced by null
 */
export function sanitizeForDb(obj) {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
    );
}
