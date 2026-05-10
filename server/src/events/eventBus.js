import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { AppEvents, CriticalEvents } from './eventTypes.js';
import EventOutboxRepository from './outboxRepository.js';
import EventDispatcher from './eventDispatcher.js';
import RecipientDelivery from './recipientDelivery.js';

/**
 * Global App Event Bus (Singleton)
 *
 * Public facade for service/controller callers. Persistence, dispatch, recipient
 * delivery tracking, and event contracts live in focused event modules.
 */
class AppEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20);
        this.recentEventIds = new Map();
        this.eventTtlMs = 5 * 60 * 1000;
        this.pendingClaimRetries = new Map();
        this.claimRetryTimer = null;
        this.criticalEvents = CriticalEvents;
        this.dispatcher = new EventDispatcher(event => this.listeners(event), this.criticalEvents);
        logger.info('[EventBus] Initialized');
    }

    /**
     * Safe emit with listener isolation, event ids, and short-window dedupe.
     * Low-value notification paths may use this; financial lifecycle paths should
     * prefer enqueueInTransaction() + dispatchAfterCommit().
     */
    emit(event, ...args) {
        const originalPayload = args[0] && typeof args[0] === 'object' ? args[0] : {};
        const eventId = originalPayload.eventId || `${event}:${crypto.randomUUID()}`;
        const now = Date.now();

        for (const [id, expiresAt] of this.recentEventIds.entries()) {
            if (expiresAt <= now) this.recentEventIds.delete(id);
        }

        if (this.recentEventIds.has(eventId)) {
            logger.warn('[EventBus] Duplicate event suppressed', { event, eventId });
            return false;
        }
        this.recentEventIds.set(eventId, now + this.eventTtlMs);

        const payload = {
            ...originalPayload,
            eventId,
            emittedAt: originalPayload.emittedAt || new Date().toISOString()
        };

        const listeners = this.listeners(event);
        logger.info('[EventBus] Emitting event', { event, eventId, listeners: listeners.length });

        setImmediate(() => {
            this.processClaimedEvent(event, eventId, payload, null, args.slice(1));
        });

        return listeners.length > 0;
    }

    async processClaimedEvent(event, eventId, payload, listeners = this.listeners(event), extraArgs = []) {
        const result = await this.dispatcher.processClaimedEvent(event, eventId, payload, listeners, extraArgs);
        if (result?.claim?.claimed === false && result.claim.retryable) {
            this.scheduleClaimRetry(event, eventId, payload, extraArgs, result.claim.error);
            return;
        }
        if (result?.claimed) {
            this.pendingClaimRetries.delete(eventId);
        }
    }

    scheduleClaimRetry(event, eventId, payload, extraArgs = [], error = null) {
        const existing = this.pendingClaimRetries.get(eventId);
        const attempts = (existing?.attempts || 0) + 1;
        if (attempts > 10) {
            logger.error('[EventBus] Dropping event after repeated DB claim failures', {
                event,
                eventId,
                attempts,
                error: error?.message
            });
            this.pendingClaimRetries.delete(eventId);
            return;
        }

        this.pendingClaimRetries.set(eventId, {
            event,
            eventId,
            payload,
            extraArgs,
            attempts
        });

        if (!this.claimRetryTimer) {
            this.claimRetryTimer = setTimeout(
                () => this.flushPendingClaimRetries(),
                Math.min(60000, 1000 * (2 ** Math.min(attempts, 6)))
            );
            this.claimRetryTimer.unref?.();
        }
    }

    async flushPendingClaimRetries() {
        this.claimRetryTimer = null;
        const pending = Array.from(this.pendingClaimRetries.values());
        for (const item of pending) {
            await this.processClaimedEvent(item.event, item.eventId, item.payload, this.listeners(item.event), item.extraArgs);
        }

        if (this.pendingClaimRetries.size > 0 && !this.claimRetryTimer) {
            this.claimRetryTimer = setTimeout(() => this.flushPendingClaimRetries(), 60000);
            this.claimRetryTimer.unref?.();
        }
    }

    async claimEvent(event, eventId, payload = {}) {
        return EventOutboxRepository.claimEvent(event, eventId, payload);
    }

    async enqueueInTransaction(client, event, payload = {}) {
        return EventOutboxRepository.enqueueInTransaction(client, event, payload);
    }

    async enqueue(event, payload = {}) {
        return EventOutboxRepository.enqueue(event, payload);
    }

    dispatchAfterCommit(eventId, context = 'EventBus') {
        if (!eventId) return;
        setImmediate(() => {
            this.dispatchOutboxEvent(eventId)
                .catch(error => logger.error('[EventBus] Durable event dispatch failed', {
                    context,
                    eventId,
                    error: error.message
                }));
        });
    }

    dispatchManyAfterCommit(eventIds = [], context = 'EventBus') {
        for (const eventId of eventIds.filter(Boolean)) {
            this.dispatchAfterCommit(eventId, context);
        }
    }

    async enqueueAndDispatch(event, payload = {}, context = 'EventBus') {
        const durableEvent = await this.enqueue(event, payload);
        this.dispatchAfterCommit(durableEvent.eventId, context);
        return durableEvent;
    }

    async dispatchOutboxEvent(eventId) {
        return this.dispatcher.dispatchOutboxEvent(eventId);
    }

    async dispatchEvent(event, payload, listeners = this.listeners(event), extraArgs = []) {
        return this.dispatcher.dispatchEvent(event, payload, listeners, extraArgs);
    }

    async verifyRequiredListeners() {
        return this.dispatcher.verifyRequiredListeners();
    }

    async deliverRecipient(eventId, recipientKey, deliveryFn, options = {}) {
        return RecipientDelivery.deliverRecipient(eventId, recipientKey, deliveryFn, options);
    }

    async markOutboxCompleted(eventId) {
        return this.dispatcher.markOutboxCompleted(eventId);
    }

    async markOutboxFailed(eventId, error) {
        return this.dispatcher.markOutboxFailed(eventId, error);
    }

    classifyDeliveryError(error) {
        return this.dispatcher.classifyDeliveryError(error);
    }

    async replayPendingOutbox(limit = 50) {
        return this.dispatcher.replayPendingOutbox(limit);
    }
}

export { AppEvents };
export default new AppEventBus();
