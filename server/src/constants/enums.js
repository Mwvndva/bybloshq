/**
 * @readonly
 * @enum {string}
 */
export const OrderStatus = {
    PENDING: 'PENDING',
    SERVICE_PENDING: 'SERVICE_PENDING',
    DELIVERY_PENDING: 'DELIVERY_PENDING',
    DELIVERY_COMPLETE: 'DELIVERY_COMPLETE',
    CONFIRMED: 'CONFIRMED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
    SHIPPED: 'shipped', // Legacy casing support if needed, or normalize
    DELIVERED: 'delivered'
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
