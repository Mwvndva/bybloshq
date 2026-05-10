import logger from '../shared/utils/logger.js';
import { CriticalEvents } from './eventTypes.js';
import EventOutboxRepository from './outboxRepository.js';

class EventDispatcher {
    constructor(listenerResolver, criticalEvents = CriticalEvents) {
        this.listenerResolver = listenerResolver;
        this.criticalEvents = criticalEvents;
    }

    listeners(event) {
        return this.listenerResolver(event);
    }

    async processClaimedEvent(event, eventId, payload, listeners = this.listeners(event), extraArgs = []) {
        const claim = await EventOutboxRepository.claimEvent(event, eventId, payload);
        if (!claim.claimed) {
            return { claimed: false, claim };
        }

        listeners = Array.isArray(listeners) ? listeners : this.listeners(event);
        if (this.criticalEvents.has(event) && listeners.length === 0) {
            const error = new Error(`Critical event ${event} has no registered listeners`);
            error.retryable = true;
            await this.markOutboxFailed(eventId, error);
            return { claimed: true, completed: false, failed: true, error };
        }

        const errors = await this.dispatchEvent(event, payload, listeners, extraArgs);
        if (errors.length === 0) {
            await this.markOutboxCompleted(eventId);
            return { claimed: true, completed: true, failed: false };
        }

        await this.markOutboxFailed(eventId, errors[0]);
        return { claimed: true, completed: false, failed: true, error: errors[0] };
    }

    async dispatchOutboxEvent(eventId) {
        let row = null;
        try {
            row = await EventOutboxRepository.claimOutboxEvent(eventId);
        } catch {
            return { completed: 0, failed: 1 };
        }

        if (!row) return { completed: 0, failed: 0, skipped: true };

        const listeners = this.listeners(row.event_name);
        const payload = {
            ...(row.payload || {}),
            eventId: row.event_id
        };
        if (this.criticalEvents.has(row.event_name) && listeners.length === 0) {
            await this.markOutboxFailed(row.event_id, new Error(`Critical event ${row.event_name} has no registered listeners`));
            return { completed: 0, failed: 1 };
        }

        const errors = await this.dispatchEvent(row.event_name, payload, listeners);
        if (errors.length === 0) {
            await this.markOutboxCompleted(row.event_id);
            return { completed: 1, failed: 0 };
        }

        await this.markOutboxFailed(row.event_id, errors[0]);
        return { completed: 0, failed: 1 };
    }

    async dispatchEvent(event, payload, listeners = this.listeners(event), extraArgs = []) {
        const errors = [];
        for (const listener of listeners) {
            try {
                await listener(payload, ...extraArgs);
            } catch (error) {
                errors.push(error);
                logger.error('[EventBus] Listener failed', {
                    event,
                    eventId: payload?.eventId,
                    error: error.message,
                    stack: error.stack
                });
            }
        }
        return errors;
    }

    async verifyRequiredListeners() {
        const missing = Array.from(this.criticalEvents).filter(event => this.listeners(event).length === 0);
        if (missing.length) {
            logger.error('[EventBus] Required critical listeners are missing', { missing });
            throw new Error(`Missing critical event listeners: ${missing.join(', ')}`);
        }
        logger.info('[EventBus] Required critical listeners registered', { events: Array.from(this.criticalEvents) });
    }

    async markOutboxCompleted(eventId) {
        return EventOutboxRepository.markCompleted(eventId);
    }

    async markOutboxFailed(eventId, error) {
        return EventOutboxRepository.markFailed(eventId, error, this.classifyDeliveryError(error));
    }

    classifyDeliveryError(error) {
        if (error?.retryable === false) {
            return { retryable: false, errorType: error.errorType || 'permanent' };
        }

        const status = Number.parseInt(error?.statusCode || error?.status || error?.response?.status, 10);
        const message = String(error?.message || '').toLowerCase();
        const permanentMessage = /invalid|not registered|bad request|recipient|number/i.test(message);
        if ([400, 404, 410, 422].includes(status) || permanentMessage) {
            return { retryable: false, errorType: 'permanent_delivery_failure' };
        }

        return { retryable: true, errorType: 'transient_delivery_failure' };
    }

    async replayPendingOutbox(limit = 50) {
        let rows = [];
        try {
            rows = await EventOutboxRepository.claimReplayBatch(limit);
        } catch {
            return { claimed: 0, completed: 0, failed: 0 };
        }

        let completed = 0;
        let failed = 0;
        for (const row of rows) {
            const listeners = this.listeners(row.event_name);
            const payload = {
                ...(row.payload || {}),
                eventId: row.event_id
            };
            if (this.criticalEvents.has(row.event_name) && listeners.length === 0) {
                await this.markOutboxFailed(row.event_id, new Error(`Critical event ${row.event_name} has no registered listeners`));
                failed++;
                continue;
            }
            const errors = await this.dispatchEvent(row.event_name, payload, listeners);
            if (errors.length === 0) {
                await this.markOutboxCompleted(row.event_id);
                completed++;
            } else {
                await this.markOutboxFailed(row.event_id, errors[0]);
                failed++;
            }
        }

        if (rows.length > 0) {
            logger.info('[EventBus] Replayed pending outbox events', {
                claimed: rows.length,
                completed,
                failed
            });
        }
        return { claimed: rows.length, completed, failed };
    }
}

export default EventDispatcher;
