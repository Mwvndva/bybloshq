import { query } from '../shared/db/database.js';

// All methods here are transactional. Pass a pg.PoolClient as `executor`
// to participate in a caller-managed transaction. The default executor
// is kept for parity with other repos, but every realistic caller of
// this module is mid-transaction.

const DEFAULT_EXECUTOR = { query };

/**
 * Locks the order row and joins in the logistics request + both leg
 * statuses (pickup + delivery). Used by both selectHubDropoff and
 * markDroppedAtHub — selectHubDropoff ignores the delivery leg columns.
 *
 * Returns undefined when no order matches the (id, seller_id) pair.
 *
 * @param {object} input
 * @param {number|string} input.orderId
 * @param {number|string} input.sellerId
 * @param {{query: Function}} [executor]
 * @returns {Promise<object|undefined>}
 */
export async function findOrderWithLegsForUpdate({ orderId, sellerId }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    SELECT o.*,
           lr.id AS logistics_request_id,
           lr.status AS logistics_request_status,
           dl.id AS delivery_leg_id,
           dl.status AS delivery_leg_status,
           pl.id AS pickup_leg_id,
           pl.status AS pickup_leg_status
    FROM product_orders o
    LEFT JOIN logistics_requests lr ON lr.order_id = o.id
    LEFT JOIN logistics_legs dl ON dl.logistics_request_id = lr.id
                              AND dl.leg_type = 'delivery'
    LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                              AND pl.leg_type = 'pickup'
    WHERE o.id = $1
      AND o.seller_id = $2
    FOR UPDATE OF o
  `;
  const { rows } = await executor.query(sql, [orderId, sellerId]);
  return rows[0];
}

/**
 * Sets the order's status and merges the seller_handoff metadata blob.
 * Returns the updated row.
 *
 * @param {object} input
 * @param {number|string} input.orderId
 * @param {string} input.status
 * @param {object} input.handoff           Will be JSON-stringified into
 *                                         metadata under `seller_handoff`.
 * @param {{query: Function}} [executor]
 */
export async function updateOrderStatusAndHandoff({ orderId, status, handoff }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    UPDATE product_orders
    SET status = $2,
        metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await executor.query(sql, [
    orderId,
    status,
    JSON.stringify({ seller_handoff: handoff })
  ]);
  return rows[0];
}

/**
 * INSERTs (or upserts on order_id) a logistics_requests row for a
 * seller-driven hub dropoff. Used by `_ensureSellerDropoffRequest`
 * to guarantee a request exists before status updates and tracking
 * events touch it.
 *
 * @param {object} input
 * @param {number|string} input.orderId
 * @param {number|string} input.partnerId
 * @param {string} input.packageCode
 * @param {string} input.status
 * @param {Date} input.deadlineAt
 * @param {object} input.metadata
 * @param {{query: Function}} [executor]
 * @returns {Promise<object>}              The logistics_requests row.
 */
export async function upsertLogisticsRequest({ orderId, partnerId, packageCode, status, deadlineAt, metadata }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    INSERT INTO logistics_requests
        (order_id, partner_id, package_code, status, service_level, deadline_at, metadata)
    VALUES ($1, $2, $3, $4, 'standard', $5, $6::jsonb)
    ON CONFLICT (order_id) DO UPDATE
    SET package_code = COALESCE(logistics_requests.package_code, EXCLUDED.package_code),
        status = CASE
          WHEN logistics_requests.status IN ('pending', 'awaiting_seller_choice', 'payment_pending') THEN EXCLUDED.status
          ELSE logistics_requests.status
        END,
        deadline_at = COALESCE(logistics_requests.deadline_at, EXCLUDED.deadline_at),
        metadata = logistics_requests.metadata || EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING *
  `;
  const { rows } = await executor.query(sql, [
    orderId,
    partnerId,
    packageCode,
    status,
    deadlineAt,
    JSON.stringify(metadata)
  ]);
  return rows[0];
}

/**
 * Conditional UPDATE on the logistics request — only promotes the
 * status when it's still in an early state, and merges the dropoff
 * metadata patch regardless.
 *
 * @param {object} input
 * @param {number|string} input.requestId
 * @param {object} input.metadataPatch
 * @param {{query: Function}} [executor]
 */
export async function markLogisticsRequestActiveOnDrop({ requestId, metadataPatch }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    UPDATE logistics_requests
    SET status = CASE
          WHEN status IN ('pending', 'awaiting_seller_choice', 'payment_pending') THEN 'active'
          ELSE status
        END,
        metadata = metadata || $2::jsonb,
        updated_at = NOW()
    WHERE id = $1
  `;
  await executor.query(sql, [requestId, JSON.stringify(metadataPatch)]);
}

/**
 * Idempotently inserts a logistics_tracking_events row. The event_key
 * unique index causes ON CONFLICT to no-op on replay.
 *
 * @param {object} input
 * @param {number|string} input.requestId
 * @param {string} input.eventKey
 * @param {string} input.eventType
 * @param {string} input.status
 * @param {string} input.message
 * @param {number|null} input.actorUserId
 * @param {object} input.metadata
 * @param {{query: Function}} [executor]
 */
export async function insertTrackingEvent({ requestId, eventKey, eventType, status, message, actorUserId, metadata }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    INSERT INTO logistics_tracking_events
        (logistics_request_id, event_key, event_type, status, message, source, actor_user_id, metadata)
    VALUES ($1, $2, $3, $4, $5, 'seller', $6, $7::jsonb)
    ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
  `;
  await executor.query(sql, [
    requestId,
    eventKey,
    eventType,
    status,
    message,
    actorUserId,
    JSON.stringify(metadata)
  ]);
}
