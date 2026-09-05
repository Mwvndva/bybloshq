/**
 * fraudEvents.js
 *
 * Shared helper for writing to the `fraud_events` table, following the exact
 * pattern CorePaymentService.js already uses internally for payment fraud
 * (amount mismatches, missing order references). Extracted here so other
 * domains (e.g. creator self-referral detection) can persist the same kind
 * of durable, admin-queryable record instead of a log line that scrolls
 * away. CorePaymentService.js keeps its own internal copy — not touched by
 * this addition, to avoid any risk to already-verified payment code for a
 * refactor-only reason.
 */
import { pool } from '../../infrastructure/database/database.js';
import logger from './logger.js';
import { reportAlert } from './alerting.js';

/**
 * @param {object} event
 * @param {number|null} [event.paymentId]
 * @param {number|null} [event.orderId]
 * @param {string|null} [event.providerReference]
 * @param {string} event.eventType
 * @param {number|null} [event.expectedAmount]
 * @param {number|null} [event.providerAmount]
 * @param {object} [event.payload]
 * @param {object} [event.details]
 */
export async function recordFraudEvent(event) {
  try {
    await pool.query(
      `INSERT INTO fraud_events (
           payment_id,
           order_id,
           provider_reference,
           event_type,
           expected_amount,
           provider_amount,
           payload,
           details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [
        event.paymentId || null,
        event.orderId || null,
        event.providerReference || null,
        event.eventType,
        event.expectedAmount ?? null,
        event.providerAmount ?? null,
        JSON.stringify(event.payload || {}),
        JSON.stringify(event.details || {})
      ]
    );

    // Real-time push so a human sees this immediately, not only on the next
    // Detections-tab visit. Fire-and-forget; reportAlert never throws.
    reportAlert({
      level: 'error',
      title: `Fraud event: ${event.eventType}`,
      message: `A ${event.eventType} fraud event was recorded.`,
      context: {
        eventType: event.eventType,
        orderId: event.orderId ?? null,
        paymentId: event.paymentId ?? null,
        providerReference: event.providerReference ?? null,
        expectedAmount: event.expectedAmount ?? null,
        providerAmount: event.providerAmount ?? null
      }
    });
  } catch (error) {
    logger.error('[FraudEvents] Failed to persist fraud event', {
      original: event,
      error: error.message
    });
  }
}

export default { recordFraudEvent };
