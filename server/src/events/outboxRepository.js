import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';

class EventOutboxRepository {
    static buildDurablePayload(event, payload = {}) {
        const eventId = payload.eventId || `${event}:${crypto.randomUUID()}`;
        return {
            eventId,
            payload: {
                ...payload,
                eventId,
                emittedAt: payload.emittedAt || new Date().toISOString()
            }
        };
    }

    static async claimEvent(event, eventId, payload = {}) {
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

    static async enqueueInTransaction(client, event, payload = {}) {
        if (!client?.query) {
            throw new Error('enqueueInTransaction requires an active database client');
        }

        const { eventId, payload: durablePayload } = this.buildDurablePayload(event, payload);

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

    static async enqueue(event, payload = {}) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const durableEvent = await this.enqueueInTransaction(client, event, payload);
            await client.query('COMMIT');
            return durableEvent;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[EventBus] Failed to enqueue durable event', {
                event,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    }

    static async claimOutboxEvent(eventId) {
        const client = await pool.connect();
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
            await client.query('COMMIT');
            return rows[0] || null;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[EventBus] Failed to claim specific outbox event', { eventId, error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    static async claimReplayBatch(limit = 50) {
        const client = await pool.connect();
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
            await client.query('COMMIT');
            return result.rows;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error('[EventBus] Failed to claim pending outbox events', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    static async markCompleted(eventId) {
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

    static async markFailed(eventId, error, classification) {
        try {
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
}

export default EventOutboxRepository;
