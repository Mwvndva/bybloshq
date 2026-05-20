import { query } from '../shared/db/database.js';

/**
 * Fetches the referral-related fields for a seller. Returns undefined
 * if the seller does not exist.
 *
 * @param {number|string} sellerId
 * @returns {Promise<{referral_code: string|null, total_sales: number}|undefined>}
 */
export async function findReferralInfoById(sellerId) {
  const sql = `SELECT referral_code, total_sales FROM sellers WHERE id = $1`;
  const { rows } = await query(sql, [sellerId]);
  return rows[0];
}
