import { query } from '../shared/db/database.js';

/**
 * Fetches a minimal user record (id, email, role, created_at) by id.
 * Returns undefined when not found.
 *
 * @param {number|string} userId
 * @returns {Promise<{id: number, email: string, role: string, created_at: string}|undefined>}
 */
export async function findByIdMinimal(userId) {
  const sql = `SELECT id, email, role, created_at FROM users WHERE id = $1`;
  const { rows } = await query(sql, [userId]);
  return rows[0];
}
