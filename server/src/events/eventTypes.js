export const AppEvents = {
    PAYMENT: {
        COMPLETED: 'payment.completed',
        FAILED: 'payment.failed'
    },
    ORDER: {
        CREATED: 'order.created',
        PAID: 'order.paid',
        UPDATED: 'order.updated',
        FULFILLED: 'order.fulfilled',
        CANCELLED: 'order.cancelled'
    },
    INVENTORY: {
        LOW_STOCK: 'inventory.low_stock',
        OUT_OF_STOCK: 'inventory.out_of_stock'
    },
    BOOKING: {
        EXPIRED: 'booking.expired'
    },
    WITHDRAWAL: {
        CREATED: 'withdrawal.created',
        INITIATED: 'withdrawal.initiated',
        UPDATED: 'withdrawal.updated',
        COMPLETED: 'withdrawal.completed',
        FAILED: 'withdrawal.failed',
        COMPENSATION_REQUIRED: 'withdrawal.compensation_required'
    },
    REFUND: {
        APPROVED: 'refund.approved',
        REJECTED: 'refund.rejected'
    },
    REFERRAL: {
        REWARD_CREATED: 'referral.reward_created'
    },
    LOGISTICS: {
        NOTIFICATION: 'logistics.notification'
    }
};

export const CriticalEvents = new Set([
    AppEvents.ORDER.CREATED,
    AppEvents.PAYMENT.COMPLETED,
    AppEvents.LOGISTICS.NOTIFICATION,
    AppEvents.WITHDRAWAL.COMPLETED,
    AppEvents.WITHDRAWAL.COMPENSATION_REQUIRED
]);
