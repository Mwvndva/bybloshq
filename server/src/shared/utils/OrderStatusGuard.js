import { OrderStatus } from '../constants/enums.js';
import { AppError } from './errorHandler.js';

/**
 * Strict Order State Machine Transitions
 * Defines a map of [Current State] -> [Allowed Next States]
 */
const TRANSITIONS = {
    [OrderStatus.CREATED]: [OrderStatus.RESERVED, OrderStatus.HELD, OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],

    [OrderStatus.RESERVED]: [OrderStatus.PAYMENT_PENDING, OrderStatus.EXPIRED, OrderStatus.CANCELLED],
    [OrderStatus.HELD]: [OrderStatus.PAYMENT_PENDING, OrderStatus.EXPIRED, OrderStatus.CANCELLED],

    [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.EXPIRED],

    [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.FULFILLMENT_PENDING, OrderStatus.BOOKED, OrderStatus.DELIVERY_PENDING, OrderStatus.REFUND_PENDING, OrderStatus.COMPENSATION_REQUIRED],

    [OrderStatus.PROCESSING]: [OrderStatus.FULFILLMENT_PENDING, OrderStatus.SERVICE_PENDING, OrderStatus.DELIVERY_PENDING, OrderStatus.COLLECTION_PENDING, OrderStatus.FULFILLED, OrderStatus.DELIVERED, OrderStatus.BOOKED, OrderStatus.CANCELLED, OrderStatus.FAILED],

    [OrderStatus.FULFILLMENT_PENDING]: [OrderStatus.FULFILLED, OrderStatus.FAILED, OrderStatus.REFUND_PENDING, OrderStatus.CANCELLED],
    [OrderStatus.FULFILLED]: [OrderStatus.COMPLETED, OrderStatus.REFUND_PENDING],

    [OrderStatus.BOOKED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.COMPENSATION_REQUIRED],

    [OrderStatus.SERVICE_PENDING]: [OrderStatus.BOOKED, OrderStatus.CANCELLED, OrderStatus.FAILED],

    [OrderStatus.DELIVERY_PENDING]: [OrderStatus.DELIVERED, OrderStatus.FAILED, OrderStatus.REFUND_PENDING],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.REFUND_PENDING],

    [OrderStatus.COLLECTION_PENDING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],

    [OrderStatus.COMPLETED]: [], // Terminal state
    [OrderStatus.CANCELLED]: [], // Terminal state
    [OrderStatus.EXPIRED]: [OrderStatus.PAID, OrderStatus.COMPENSATION_REQUIRED, OrderStatus.CANCELLED], // Late payment handling
    [OrderStatus.FAILED]: [OrderStatus.REFUND_PENDING, OrderStatus.COMPENSATION_REQUIRED, OrderStatus.PENDING],

    [OrderStatus.REFUND_PENDING]: [OrderStatus.REFUNDED, OrderStatus.FAILED],
    [OrderStatus.REFUNDED]: [],   // Terminal state
    [OrderStatus.COMPENSATION_REQUIRED]: [OrderStatus.REFUND_PENDING, OrderStatus.COMPLETED]
};

/**
 * Validates if an order can transition from current to target state.
 * @param {string} currentStatus - Current order status
 * @param {string} targetStatus - Desired order status
 * @param {string} orderId - For logging
 * @throws {AppError} If transition is invalid
 */
export const assertValidTransition = (currentStatus, targetStatus, orderId = 'unknown') => {
    // 1. Sanity check: States must exist
    if (!OrderStatus[currentStatus]) {
        throw new AppError(`Invalid current state: ${currentStatus}`, 400);
    }
    if (!OrderStatus[targetStatus]) {
        throw new AppError(`Invalid target state: ${targetStatus}`, 400);
    }

    // 2. Self-transition is always allowed (idempotency)
    if (currentStatus === targetStatus) return true;

    // 3. Check transition map
    const allowed = TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
        throw new AppError(
            `Illegal state transition for order ${orderId}: ${currentStatus} -> ${targetStatus}`,
            400
        );
    }

    return true;
};

export default {
    assertValidTransition,
    OrderStatus
};
