import { query } from '../shared/db/database.js';

const ADMIN_BUYER_COLUMNS = `
  id,
  user_id,
  full_name as name,
  email,
  mobile_payment as phone,
  whatsapp_number,
  status,
  city,
  location,
  created_at
`;

/**
 * Returns all buyers linked to a user account, for the admin directory.
 * Sorted newest first.
 *
 * @returns {Promise<Array<object>>}
 */
export async function findAllForAdmin() {
  const sql = `
    SELECT ${ADMIN_BUYER_COLUMNS}
    FROM buyers
    WHERE user_id IS NOT NULL
    ORDER BY created_at DESC
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Fetches a single buyer by id for the admin detail view. Returns
 * undefined when not found.
 *
 * @param {number|string} id
 * @returns {Promise<object|undefined>}
 */
export async function findByIdForAdmin(id) {
  const sql = `
    SELECT
      id,
      full_name as name,
      email,
      mobile_payment as phone,
      whatsapp_number,
      status,
      city,
      location,
      created_at
    FROM buyers
    WHERE id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Pass a pg.PoolClient as `executor` to participate in a caller-managed
// transaction; defaults to the wrapped module-level query helper.

const DEFAULT_EXECUTOR = { query };

/**
 * SELECT … FOR UPDATE on a buyer row, returning only the columns the
 * refund-approval transaction needs. Returns undefined when not found.
 *
 * @param {number|string} buyerId
 * @param {{query: Function}} [executor]
 * @returns {Promise<{id: number, refunds: string, full_name: string, whatsapp_number: string}|undefined>}
 */
export async function findRefundColumnsByIdForUpdate(buyerId, executor = DEFAULT_EXECUTOR) {
  const sql = `
    SELECT id, refunds, full_name, whatsapp_number
    FROM buyers
    WHERE id = $1
    FOR UPDATE
  `;
  const { rows } = await executor.query(sql, [buyerId]);
  return rows[0];
}

/**
 * Decrements a buyer's `refunds` balance by the given amount,
 * clamping at zero. Run inside the refund-approval transaction
 * after the row has been locked.
 *
 * @param {object} input
 * @param {number|string} input.buyerId
 * @param {number} input.amount
 * @param {{query: Function}} [executor]
 */
export async function decrementRefundBalance({ buyerId, amount }, executor = DEFAULT_EXECUTOR) {
  const sql = `
    UPDATE buyers
    SET refunds = GREATEST(refunds - $1, 0),
        updated_at = NOW()
    WHERE id = $2
  `;
  await executor.query(sql, [amount, buyerId]);
}
