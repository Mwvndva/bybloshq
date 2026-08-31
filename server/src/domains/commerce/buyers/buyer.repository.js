import { query } from '../../../infrastructure/database/database.js';

const ADMIN_BUYER_COLUMNS = `
  id,
  user_id,
  full_name as name,
  email,
  mobile_payment,
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
      mobile_payment,
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

