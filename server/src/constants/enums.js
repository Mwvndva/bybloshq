/**
 * @readonly
 * @enum {string}
 * Matches database order_status enum exactly
 */
export const OrderStatus = {
    PENDING: 'PENDING',
    SERVICE_PENDING: 'SERVICE_PENDING',
    DELIVERY_PENDING: 'DELIVERY_PENDING',
    COLLECTION_PENDING: 'COLLECTION_PENDING', // Waiting for buyer pickup at shop
    CLIENT_PAYMENT_PENDING: 'CLIENT_PAYMENT_PENDING', // Seller-initiated order awaiting client payment
    DEBT_PENDING: 'DEBT_PENDING', // Seller-initiated order recorded as debt
    DELIVERY_COMPLETE: 'DELIVERY_COMPLETE',
    CONFIRMED: 'CONFIRMED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED'
};

/**
 * @readonly
 * @enum {string}
 */
export const PaymentStatus = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    SUCCESS: 'success' // Sometimes used interchangeably with completed
};

/**
 * @readonly
 * @enum {string}
 */
export const ProductType = {
    PHYSICAL: 'physical',
    DIGITAL: 'digital',
    SERVICE: 'service'
};

/**
 * @readonly
 * @enum {string}
 */
export const SellerStatus = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended'
};
