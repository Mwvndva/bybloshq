/**
 * @readonly
 * @enum {string}
 * Matches database order_status enum exactly
 */
export const OrderStatus = {
    PENDING: 'PENDING',
    CREATED: 'CREATED',
    RESERVED: 'RESERVED',
    HELD: 'HELD',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PAID: 'PAID',
    AWAITING_SELLER_ACTION: 'AWAITING_SELLER_ACTION',
    FULFILLING: 'FULFILLING',
    READY_FOR_BUYER: 'READY_FOR_BUYER',
    PROCESSING: 'PROCESSING',
    SERVICE_PENDING: 'SERVICE_PENDING',
    DELIVERY_PENDING: 'DELIVERY_PENDING',
    DELIVERY_COMPLETE: 'DELIVERY_COMPLETE',
    COLLECTION_PENDING: 'COLLECTION_PENDING',
    FULFILLMENT_PENDING: 'FULFILLMENT_PENDING',
    FULFILLED: 'FULFILLED',
    DELIVERED: 'DELIVERED',
    BOOKED: 'BOOKED',
    CONFIRMED: 'CONFIRMED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    REFUND_PENDING: 'REFUND_PENDING',
    REFUNDED: 'REFUNDED',
    MANUAL_REVIEW: 'MANUAL_REVIEW',
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
    MANUAL_REVIEW: 'manual_review',
    SUCCESS: 'success',
    PAID: 'paid',
    MANUAL_REVIEW_REQUIRED: 'manual_review_required',
    PAYMENT_MAPPING_FAILED: 'payment_mapping_failed',
    COMPENSATION_REQUIRED: 'compensation_required'
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
