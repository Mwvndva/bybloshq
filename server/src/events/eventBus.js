import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';

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
        this.recentEventIds = new Map();
        this.eventTtlMs = 5 * 60 * 1000;
        this.pendingClaimRetries = new Map();
        this.claimRetryTimer = null;
        this.criticalEvents = new Set([
            'order.created',
            'payment.completed',
            'withdrawal.completed',
            'withdrawal.compensation_required'
        ]);
        logger.info('[EventBus] Initialized');
    }

    /**
     * Safe emit with listener isolation, event ids, and short-window dedupe.
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
        const claim = await this.claimEvent(event, eventId, payload);
        if (!claim.claimed) {
            if (claim.retryable) {
                this.scheduleClaimRetry(event, eventId, payload, extraArgs, claim.error);
            }
            return;
        }

        this.pendingClaimRetries.delete(eventId);
        listeners = Array.isArray(listeners) ? listeners : this.listeners(event);
        if (this.criticalEvents.has(event) && listeners.length === 0) {
            const error = new Error(`Critical event ${event} has no registered listeners`);
            error.retryable = true;
            await this.markOutboxFailed(eventId, error);
            return;
        }
        const errors = await this.dispatchEvent(event, payload, listeners, extraArgs);
        if (errors.length === 0) {
            await this.markOutboxCompleted(eventId);
        } else {
            await this.markOutboxFailed(eventId, errors[0]);
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
            this.claimRetryTimer = setTimeout(() => this.flushPendingClaimRetries(), Math.min(60000, 1000 * (2 ** Math.min(attempts, 6))));
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
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `INSERT INTO event_dedupe (event_id, event_name, expires_at)
                 VALUES ($1, $2, NOW() + INTERVAL '24 hours')
                 ON CONFLICT (event_id) DO NOTHING`,
                [eventId, event]
            );
            if (result.rowCount === 0) {
                await client.query('ROLLBACK');
                logger.warn('[EventBus] Duplicate event suppressed by DB dedupe', { event, eventId });
                return { claimed: false, retryable: false, reason: 'duplicate' };
            }

            await client.query(
                `INSERT INTO event_outbox (event_id, event_name, payload, status, attempts, delivery_attempts, next_attempt_at)
                 VALUES ($1, $2, $3, 'processing', 1, 1, NOW())
                 ON CONFLICT (event_id) DO NOTHING`,
                [eventId, event, JSON.stringify(payload || {})]
            );

            await client.query('COMMIT');
            pool.query('DELETE FROM event_dedupe WHERE expires_at < NOW()')
                .catch(error => logger.warn('[EventBus] Event dedupe cleanup failed:', error.message));
            return { claimed: true };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[EventBus] DB event dedupe unavailable; deferring side-effect event until outbox claim succeeds', {
                event,
                eventId,
                error: error.message
            });
            return { claimed: false, retryable: true, reason: 'db_unavailable', error };
        } finally {
            client.release();
        }
    }

    async enqueueInTransaction(client, event, payload = {}) {
        if (!client?.query) {
            throw new Error('enqueueInTransaction requires an active database client');
        }
        const eventId = payload.eventId || `${event}:${crypto.randomUUID()}`;
        const durablePayload = {
            ...payload,
            eventId,
            emittedAt: payload.emittedAt || new Date().toISOString()
        };

        await client.query(
            `INSERT INTO event_dedupe (event_id, event_name, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '24 hours')
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, event]
        );

        await client.query(
            `INSERT INTO event_outbox (event_id, event_name, payload, status, attempts, delivery_attempts, next_attempt_at)
             VALUES ($1, $2, $3, 'pending', 0, 0, NOW())
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, event, JSON.stringify(durablePayload)]
        );

        return { eventId, event, payload: durablePayload };
    }

    async dispatchOutboxEvent(eventId) {
        const client = await pool.connect();
        let row = null;
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `UPDATE event_outbox
                 SET status = 'processing',
                     attempts = attempts + 1,
                     delivery_attempts = delivery_attempts + 1,
                     updated_at = NOW()
                 WHERE event_id = $1
                   AND status IN ('pending', 'failed', 'processing')
                 RETURNING *`,
                [eventId]
            );
            row = rows[0] || null;
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[EventBus] Failed to claim specific outbox event', { eventId, error: error.message });
            return { completed: 0, failed: 1 };
        } finally {
            client.release();
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

    async deliverRecipient(eventId, recipientKey, deliveryFn, options = {}) {
        if (!eventId || !recipientKey) {
            throw new Error('Recipient delivery requires eventId and recipientKey');
        }
        const channel = options.channel || 'whatsapp';
        const key = String(recipientKey).slice(0, 255);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows: [delivery] } = await client.query(
                `INSERT INTO event_recipient_deliveries (event_id, recipient_key, channel, status)
                 VALUES ($1, $2, $3, 'processing')
                 ON CONFLICT (event_id, recipient_key, channel)
                 DO UPDATE SET
                     status = CASE
                         WHEN event_recipient_deliveries.status = 'delivered' THEN event_recipient_deliveries.status
                         WHEN event_recipient_deliveries.status = 'permanently_failed' THEN event_recipient_deliveries.status
                         ELSE 'processing'
                     END,
                     updated_at = NOW()
                 RETURNING status`,
                [eventId, key, channel]
            );
            await client.query('COMMIT');

            if (['delivered', 'permanently_failed'].includes(delivery.status)) {
                logger.info('[EventBus] Recipient delivery already completed; suppressing duplicate', {
                    eventId,
                    recipientKey: key,
                    channel,
                    status: delivery.status
                });
                return { skipped: true };
            }
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }

        try {
            const result = await deliveryFn();
            const providerMessageId = result?.messageId || result?.id || result?.key?.id || null;
            await pool.query(
                `UPDATE event_recipient_deliveries
                 SET status = 'delivered',
                     delivered_at = NOW(),
                     provider_message_id = COALESCE($4, provider_message_id),
                     last_error = NULL,
                     updated_at = NOW()
                 WHERE event_id = $1
                   AND recipient_key = $2
                   AND channel = $3`,
                [eventId, key, channel, providerMessageId]
            );
            return { delivered: true };
        } catch (error) {
            const retryable = error?.retryable !== false;
            await pool.query(
                `UPDATE event_recipient_deliveries
                 SET status = CASE WHEN $4::boolean = FALSE OR retry_count >= 9 THEN 'permanently_failed' ELSE 'failed' END,
                     retry_count = retry_count + 1,
                     next_retry_at = NOW() + LEAST(INTERVAL '1 hour', (INTERVAL '1 minute' * POWER(2, retry_count))),
                     last_error = $5,
                     updated_at = NOW()
                 WHERE event_id = $1
                   AND recipient_key = $2
                   AND channel = $3`,
                [eventId, key, channel, retryable, error?.message || String(error)]
            );
            throw error;
        }
    }

    async markOutboxCompleted(eventId) {
        try {
            await pool.query(
                `UPDATE event_outbox
                 SET status = 'completed',
                     processed_at = NOW(),
                     updated_at = NOW(),
                     last_error = NULL,
                     last_error_type = NULL
                 WHERE event_id = $1`,
                [eventId]
            );
        } catch (error) {
            logger.warn('[EventBus] Failed to mark outbox event completed', {
                eventId,
                error: error.message
            });
        }
    }

    async markOutboxFailed(eventId, error) {
        try {
            const classification = this.classifyDeliveryError(error);
            await pool.query(
                `UPDATE event_outbox
                 SET status = CASE
                         WHEN $3::boolean = FALSE OR attempts >= 10 THEN 'permanently_failed'
                         ELSE 'failed'
                     END,
                     last_error = $2,
                     last_error_type = $4,
                     next_attempt_at = CASE
                         WHEN $3::boolean = FALSE OR attempts >= 10 THEN NULL
                         ELSE NOW() + (INTERVAL '1 minute' * LEAST(60, POWER(2, attempts)))
                     END,
                     final_failure_at = CASE
                         WHEN $3::boolean = FALSE OR attempts >= 10 THEN NOW()
                         ELSE final_failure_at
                     END,
                     updated_at = NOW()
                 WHERE event_id = $1`,
                [eventId, error?.message || String(error), classification.retryable, classification.errorType]
            );
        } catch (markError) {
            logger.error('[EventBus] Failed to mark outbox event failed', {
                eventId,
                error: markError.message
            });
        }
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
        const client = await pool.connect();
        let rows = [];
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `WITH claimed AS (
                    SELECT id
                    FROM event_outbox
                    WHERE (
                        (status IN ('pending', 'failed') AND next_attempt_at <= NOW())
                        OR (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
                      )
                      AND attempts < 10
                    ORDER BY created_at ASC
                    LIMIT $1
                    FOR UPDATE SKIP LOCKED
                 )
                 UPDATE event_outbox eo
                 SET status = 'processing',
                     attempts = attempts + 1,
                     delivery_attempts = delivery_attempts + 1,
                     updated_at = NOW()
                 FROM claimed
                 WHERE eo.id = claimed.id
                 RETURNING eo.*`,
                [limit]
            );
            rows = result.rows;
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[EventBus] Failed to claim pending outbox events', { error: error.message });
            return { claimed: 0, completed: 0, failed: 0 };
        } finally {
            client.release();
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

// Registry of known event constants
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
    }
};

export default new AppEventBus();
