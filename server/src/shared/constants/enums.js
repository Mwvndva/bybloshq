/**
 * @readonly
 * @enum {string}
 * Matches database order_status enum exactly
 */
export const OrderStatus = {
    CREATED: 'CREATED',
    RESERVED: 'RESERVED',
    HELD: 'HELD',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PAID: 'PAID',
    PROCESSING: 'PROCESSING',
    SERVICE_PENDING: 'SERVICE_PENDING',
    DELIVERY_PENDING: 'DELIVERY_PENDING',
    COLLECTION_PENDING: 'COLLECTION_PENDING',
    FULFILLMENT_PENDING: 'FULFILLMENT_PENDING',
    FULFILLED: 'FULFILLED',
    DELIVERED: 'DELIVERED',
    BOOKED: 'BOOKED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    REFUND_PENDING: 'REFUND_PENDING',
    REFUNDED: 'REFUNDED',
    COMPENSATION_REQUIRED: 'COMPENSATION_REQUIRED'
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
