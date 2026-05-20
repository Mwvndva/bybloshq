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
      wr.processed_by, wr.metadata, wr.seller_id,
      CASE
        WHEN wr.seller_id IS NOT NULL THEN 'seller'
        ELSE 'unknown'
      END AS entity_type,
      COALESCE(NULLIF(s.shop_name, ''), NULLIF(s.full_name, ''), NULLIF(wr.mpesa_name, ''), 'Seller') AS entity_name,
      s.email AS entity_email,
      s.whatsapp_number AS entity_phone,
      s.balance AS current_balance
    FROM withdrawal_requests wr
    LEFT JOIN sellers s ON wr.seller_id = s.id
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
           s.whatsapp_number AS entity_phone,
           s.balance AS entity_balance
    FROM withdrawal_requests wr
    LEFT JOIN sellers s ON wr.seller_id = s.id
    WHERE wr.id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}
