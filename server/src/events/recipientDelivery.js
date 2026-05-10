import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';

class RecipientDelivery {
    static async deliverRecipient(eventId, recipientKey, deliveryFn, options = {}) {
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
}

export default RecipientDelivery;
