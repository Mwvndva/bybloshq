/**
 * @readonly
 * @enum {string}
 * Matches database order_status enum exactly
 */
export const OrderStatus = {
    PENDING: 'PENDING',
    RESERVED: 'RESERVED', // Slot or inventory locked
    PROCESSING: 'PROCESSING',
    SERVICE_PENDING: 'SERVICE_PENDING',
    DELIVERY_PENDING: 'DELIVERY_PENDING',
    COLLECTION_PENDING: 'COLLECTION_PENDING',
    CLIENT_PAYMENT_PENDING: 'CLIENT_PAYMENT_PENDING',
    DEBT_PENDING: 'DEBT_PENDING',
    DELIVERY_COMPLETE: 'DELIVERY_COMPLETE',
    CONFIRMED: 'CONFIRMED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED' // For timed-out reservations
};

/**
 * @readonly
 * @enum {string}
 */
export const OrderType = {
    PHYSICAL: 'PHYSICAL',
    SERVICE: 'SERVICE',
    DIGITAL: 'DIGITAL'
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
    SUCCESS: 'success'
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
