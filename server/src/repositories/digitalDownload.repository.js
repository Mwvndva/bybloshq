import { query } from '../shared/db/database.js';

/**
 * Verifies that a buyer owns a paid digital product inside a specific
 * order, and returns the data needed to serve the file.
 *
 * Returns undefined when the buyer does not own a matching completed
 * digital item.
 *
 * @param {object} input
 * @param {number|string} input.orderId
 * @param {number|string} input.buyerId
 * @param {number|string} input.productId
 * @returns {Promise<{order_id: number, product_id: number, product_name: string, digital_file_path: string|null, digital_file_name: string|null}|undefined>}
 */
export async function findVerifiedDigitalItem({ orderId, buyerId, productId }) {
  const sql = `
    SELECT
      po.id as order_id,
      p.id as product_id,
      p.name as product_name,
      p.digital_file_path,
      p.digital_file_name
    FROM product_orders po
    JOIN order_items oi ON po.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE po.id = $1
      AND po.buyer_id = $2
      AND oi.product_id = $3
      AND po.payment_status = 'completed'
      AND (p.product_type = 'digital' OR p.is_digital = true)
  `;
  const { rows } = await query(sql, [orderId, buyerId, productId]);
  return rows[0];
}
