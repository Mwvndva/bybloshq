import { query } from '../shared/db/database.js';

const ORDER_STATUS_SELECT = `
  SELECT po.id,
         po.order_number,
         po.status,
         po.payment_status,
         po.buyer_id,
         po.buyer_email,
         po.metadata AS order_metadata,
         p.id AS payment_id,
         p.status AS payment_record_status,
         p.provider_reference,
         p.api_ref,
         p.metadata AS payment_metadata
  FROM product_orders po
  LEFT JOIN LATERAL (
    SELECT *
    FROM payments p
    WHERE p.metadata->>'order_id' = po.id::text
       OR p.invoice_id = po.id::text
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1
  ) p ON true
  WHERE po.order_number = $1
  LIMIT 1
`;

/**
 * Fetches the public order status row joined with the latest matching
 * payment, by order_number.
 *
 * @param {string|number} identifier
 * @returns {Promise<object|null>}
 */
export async function findStatusByIdentifier(identifier) {
  const { rows } = await query(ORDER_STATUS_SELECT, [String(identifier)]);
  return rows[0] || null;
}

/**
 * Merges a metadata patch into a payment row and bumps updated_at.
 * Used by the public order-status poll to throttle provider calls and
 * stash the most recent provider snapshot.
 *
 * @param {object} input
 * @param {number} input.paymentId
 * @param {object} input.metadataPatch  Will be JSON-stringified into the merge.
 * @returns {Promise<void>}
 */
export async function mergePaymentMetadata({ paymentId, metadataPatch }) {
  const sql = `
    UPDATE payments
    SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        updated_at = NOW()
    WHERE id = $1
  `;
  await query(sql, [paymentId, JSON.stringify(metadataPatch)]);
}
