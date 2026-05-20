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
