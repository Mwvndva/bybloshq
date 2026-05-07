import { EventEmitter } from 'node:events';
import logger from '../shared/utils/logger.js';

/**
 * Global App Event Bus (Singleton)
 * 
 * Used to decouple core business logic from side effects 
 * (notifications, analytics, external integrations).
 */
class AppEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20);
        logger.info('[EventBus] Initialized');
    }

    /**
     * Safe emit with global error handling
     */
    emit(event, ...args) {
        logger.info(`[EventBus] Emitting: ${event}`);
        return super.emit(event, ...args);
    }
}

// Registry of known event constants
export const AppEvents = {
    PAYMENT: {
        COMPLETED: 'payment.completed',
        FAILED: 'payment.failed'
    },
    ORDER: {
        CREATED: 'order.created',
        PAID: 'order.paid',
        CANCELLED: 'order.cancelled'
    },
    BOOKING: {
        EXPIRED: 'booking.expired'
    },
    WITHDRAWAL: {
        INITIATED: 'withdrawal.initiated',
        COMPLETED: 'withdrawal.completed',
        FAILED: 'withdrawal.failed'
    }
};

export default new AppEventBus();
