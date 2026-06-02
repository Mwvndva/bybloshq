import { query } from '../shared/db/database.js';

/**
 * Lists withdrawal requests with their seller's identity / balance,
 * newest first, capped at 500 rows. Optional status filter.
 *
 * @param {object} [opts]
 * @param {string} [opts.status]
 * @returns {Promise<Array<object>>}
 */
export async function findAllWithSeller({ status } = {}) {
  const params = [];
  const where = status ? `WHERE wr.status = $${params.push(status)}` : '';

  const sql = `
    SELECT
      wr.id, wr.amount, wr.mpesa_number, wr.mpesa_name, wr.status,
      wr.provider_reference, wr.created_at, wr.processed_at,
      wr.processed_by, wr.metadata, wr.seller_id, wr.creator_id, wr.buyer_id,
      CASE
        WHEN wr.seller_id IS NOT NULL THEN 'seller'
        WHEN wr.creator_id IS NOT NULL THEN 'creator'
        WHEN wr.buyer_id IS NOT NULL THEN 'buyer_refund'
        ELSE 'unknown'
      END AS entity_type,
      COALESCE(NULLIF(s.shop_name, ''), NULLIF(s.full_name, ''), NULLIF(CONCAT_WS(' ', c.first_name, c.last_name), ''), NULLIF(b.full_name, ''), NULLIF(wr.mpesa_name, ''), 'Withdrawal user') AS entity_name,
      COALESCE(s.email, c.email, b.email) AS entity_email,
      COALESCE(s.whatsapp_number, c.whatsapp_number, c.mpesa_number, b.whatsapp_number, b.mobile_payment) AS entity_phone,
      COALESCE(s.balance, c.balance, b.refunds) AS current_balance
    FROM withdrawal_requests wr
    LEFT JOIN sellers s ON wr.seller_id = s.id
    LEFT JOIN creators c ON wr.creator_id = c.id
    LEFT JOIN buyers b ON wr.buyer_id = b.id
    ${where}
    ORDER BY wr.created_at DESC
    LIMIT 500
  `;
  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Fetches a single withdrawal request joined with seller phone + balance
 * for the admin pre-transaction precheck. Returns undefined when not
 * found.
 *
 * @param {number|string} id
 * @returns {Promise<object|undefined>}
 */
export async function findByIdWithSeller(id) {
  const sql = `
    SELECT wr.*,
           COALESCE(s.whatsapp_number, c.whatsapp_number, c.mpesa_number, b.whatsapp_number, b.mobile_payment) AS entity_phone,
           COALESCE(s.balance, c.balance, b.refunds) AS entity_balance
    FROM withdrawal_requests wr
    LEFT JOIN sellers s ON wr.seller_id = s.id
    LEFT JOIN creators c ON wr.creator_id = c.id
    LEFT JOIN buyers b ON wr.buyer_id = b.id
    WHERE wr.id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Pass a pg.PoolClient as `executor` to participate in a caller-managed
// transaction; defaults to the wrapped module-level query helper.

const DEFAULT_EXECUTOR = { query };

/**
 * SELECT … FOR UPDATE OF wr on a withdrawal request joined with its
 * seller's phone + balance. The lock is scoped to the withdrawal row,
 * not the seller row (admin's optional seller lock is taken
 * separately via seller.repository.lockById).
 *
 * @param {number|string} id
 * @param {{query: Function}} [executor]
 * @returns {Promise<object|undefined>}
 */
export async function findByIdWithSellerForUpdate(id, executor = DEFAULT_EXECUTOR) {
  const sql = `
    SELECT wr.*,
           COALESCE(s.whatsapp_number, c.whatsapp_number, c.mpesa_number, b.whatsapp_number, b.mobile_payment) AS entity_phone,
           COALESCE(s.balance, c.balance, b.refunds) AS entity_balance
    FROM withdrawal_requests wr
    LEFT JOIN sellers s ON wr.seller_id = s.id
    LEFT JOIN creators c ON wr.creator_id = c.id
    LEFT JOIN buyers b ON wr.buyer_id = b.id
    WHERE wr.id = $1
    FOR UPDATE OF wr
  `;
  const { rows } = await executor.query(sql, [id]);
  return rows[0];
}

/**
 * Finalizes a withdrawal request (admin override to 'completed' or
 * 'failed') and merges an admin_override metadata patch.
 *
 * @param {object} input
 * @param {number|string} input.id
 * @param {string} input.status            'completed' | 'failed'
 * @param {string} input.processedBy       Format: 'admin:<id>'.
 * @param {object} input.metadataPatch     JSON-stringified into the merge.
 * @param {{query: Function}} [executor]
 */
export async function markFinalized({ id, status, processedBy, metadataPatch }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    UPDATE withdrawal_requests
    SET status       = $1,
        processed_at = NOW(),
        processed_by = $2,
        metadata     = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
    WHERE id = $4
  `;
  await executor.query(sql, [status, processedBy, JSON.stringify(metadataPatch), id]);
}
