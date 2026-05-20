import { query } from '../shared/db/database.js';

/**
 * Lists a buyer's pending refund requests, newest first.
 *
 * @param {number|string} buyerId
 * @returns {Promise<Array<{id: number, amount: string, status: string, requested_at: string}>>}
 */
export async function findPendingByBuyerId(buyerId) {
  const sql = `
    SELECT id, amount, status, requested_at
    FROM refund_requests
    WHERE buyer_id = $1 AND status = 'pending'
    ORDER BY requested_at DESC
  `;
  const { rows } = await query(sql, [buyerId]);
  return rows;
}

/**
 * Inserts a new refund request for a buyer in the 'pending' state.
 *
 * @param {object} input
 * @param {number|string} input.buyerId
 * @param {number} input.amount
 * @param {string} input.paymentMethod
 * @param {string} input.paymentDetails  Already-serialized JSON.
 * @returns {Promise<object>}             The inserted row.
 */
export async function createForBuyer({ buyerId, amount, paymentMethod, paymentDetails }) {
  const sql = `
    INSERT INTO refund_requests (
      buyer_id, amount, status, payment_method, payment_details
    ) VALUES ($1, $2, 'pending', $3, $4)
    RETURNING *
  `;
  const { rows } = await query(sql, [buyerId, amount, paymentMethod, paymentDetails]);
  return rows[0];
}

const SELECT_WITH_BUYER = `
  SELECT
    rr.*,
    b.id as buyer_id,
    b.full_name as buyer_name,
    b.email as buyer_email,
    b.whatsapp_number as buyer_phone,
    b.refunds as buyer_current_refunds
  FROM refund_requests rr
  JOIN buyers b ON rr.buyer_id = b.id
`;

/**
 * Lists refund requests joined with buyer details, newest first.
 *
 * @param {object} [opts]
 * @param {string} [opts.status]   Optional status filter.
 * @param {number} opts.limit
 * @param {number} opts.offset
 * @returns {Promise<Array<object>>}
 */
export async function findAllWithBuyer({ status, limit, offset } = {}) {
  const params = [];
  let sql = SELECT_WITH_BUYER;
  if (status) {
    params.push(status);
    sql += ` WHERE rr.status = $${params.length}`;
  }
  params.push(limit, offset);
  sql += ` ORDER BY rr.requested_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Counts refund requests, optionally filtered by status.
 *
 * @param {object} [opts]
 * @param {string} [opts.status]
 * @returns {Promise<number>}
 */
export async function countAll({ status } = {}) {
  const sql = status
    ? `SELECT COUNT(*) FROM refund_requests WHERE status = $1`
    : `SELECT COUNT(*) FROM refund_requests`;
  const params = status ? [status] : [];
  const { rows } = await query(sql, params);
  return parseInt(rows[0].count, 10);
}

/**
 * Fetches a single refund request joined with buyer details.
 *
 * @param {number|string} id
 * @returns {Promise<object|undefined>}
 */
export async function findByIdWithBuyer(id) {
  const sql = `${SELECT_WITH_BUYER} WHERE rr.id = $1`;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

/**
 * Fetches the minimal header (status + buyer identity) used by the reject
 * flow's pre-update validation. Returns undefined when not found.
 *
 * @param {number|string} id
 * @returns {Promise<{status: string, buyer_id: number, amount: string, full_name: string, whatsapp_number: string}|undefined>}
 */
export async function findHeaderById(id) {
  const sql = `
    SELECT rr.status, rr.buyer_id, rr.amount, b.full_name, b.whatsapp_number
    FROM refund_requests rr
    JOIN buyers b ON b.id = rr.buyer_id
    WHERE rr.id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

/**
 * Marks a refund request rejected, setting admin metadata.
 *
 * @param {object} input
 * @param {number|string} input.id
 * @param {string} input.adminNotes
 * @param {number|null} input.processedBy
 */
export async function markRejected({ id, adminNotes, processedBy }) {
  const sql = `
    UPDATE refund_requests
    SET status = 'rejected',
        admin_notes = $1,
        processed_by = $2,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = $3
  `;
  await query(sql, [adminNotes, processedBy, id]);
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Methods below accept an optional `executor` (anything with a
// `.query(text, params)` method — pg.Pool, pg.PoolClient, or the default
// wrapped helper). Pass a pg.PoolClient to participate in an
// externally-managed transaction.

const DEFAULT_EXECUTOR = { query };

/**
 * SELECT … FOR UPDATE on a single refund request row. Used inside an
 * admin-approval transaction to serialize concurrent confirm/reject calls
 * on the same request.
 *
 * @param {number|string} id
 * @param {{query: Function}} [executor]  pg.PoolClient for transactional use.
 * @returns {Promise<object|undefined>}
 */
export async function findByIdForUpdate(id, executor = DEFAULT_EXECUTOR) {
  const sql = `
    SELECT rr.*
    FROM refund_requests rr
    WHERE rr.id = $1
    FOR UPDATE
  `;
  const { rows } = await executor.query(sql, [id]);
  return rows[0];
}

/**
 * Marks a refund request completed inside an admin-approval transaction.
 *
 * @param {object} input
 * @param {number|string} input.id
 * @param {string} input.adminNotes
 * @param {number|null} input.processedBy
 * @param {{query: Function}} [executor]
 */
export async function markCompleted({ id, adminNotes, processedBy }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    UPDATE refund_requests
    SET status = 'completed',
        admin_notes = $1,
        processed_by = $2,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = $3
  `;
  await executor.query(sql, [adminNotes, processedBy, id]);
}
