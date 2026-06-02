import { query } from '../shared/db/database.js';

/**
 * Counts a seller's products in the 'available' state.
 *
 * @param {number|string} sellerId
 * @returns {Promise<number>}
 */
export async function countAvailableProducts(sellerId) {
  const sql = `
    SELECT COUNT(*) as total_products
    FROM products
    WHERE seller_id = $1 AND status = 'available'
  `;
  const { rows } = await query(sql, [sellerId]);
  return parseInt(rows[0]?.total_products ?? 0, 10);
}

/**
 * Aggregated seller stats: financials (sales, revenue), balance, client
 * count, creator count, and creator-attributed sales. Returns zeros if
 * the seller has no matching rows.
 *
 * @param {object} input
 * @param {number|string} input.sellerId
 * @param {string[]} input.excludedStatuses  Order statuses excluded from
 *                                           financial aggregates.
 * @returns {Promise<{total_sales: string, net_revenue: string, balance: string, available_balance: string, pending_settlement_balance: string, withdrawal_reserved_balance: string, refund_reserved_balance: string, next_settlement_at: string|null, client_count: number, creator_count: number, creator_generated_sales: string}>}
 */
export async function findSellerStats({ sellerId, excludedStatuses }) {
  const sql = `
    SELECT
      COALESCE(financials.total_sales, 0) as total_sales,
      COALESCE(financials.net_revenue, 0) as net_revenue,
      COALESCE(s.balance, 0) as balance,
      COALESCE(s.balance, 0) as available_balance,
      COALESCE(s.pending_settlement_balance, 0) as pending_settlement_balance,
      COALESCE(s.withdrawal_reserved_balance, 0) as withdrawal_reserved_balance,
      COALESCE(s.refund_reserved_balance, 0) as refund_reserved_balance,
      next_settlement.next_settlement_at,
      COALESCE(s.client_count, 0) as client_count,
      COALESCE(creator_links.creator_count, 0) as creator_count,
      COALESCE(creator_sales.creator_generated_sales, 0) as creator_generated_sales
    FROM sellers s
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(SUM(o.seller_payout_amount), 0) as net_revenue
      FROM product_orders o
      JOIN payouts p
        ON p.order_id = o.id
       AND p.settlement_status IN ('pending_settlement', 'settled', 'refunded_after_settlement', 'refunded_before_settlement')
      WHERE o.seller_id = s.id
        AND o.payment_status = 'completed'
        AND o.status::text <> ALL($2::text[])
    ) financials ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT scl.creator_id)::int as creator_count
      FROM seller_creator_links scl
      JOIN creators c ON c.id = scl.creator_id
      WHERE scl.seller_id = s.id
        AND scl.status = 'active'
        AND c.status = 'active'
    ) creator_links ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(o.total_amount), 0) as creator_generated_sales
      FROM product_orders o
      JOIN payouts p
        ON p.order_id = o.id
       AND p.settlement_status IN ('pending_settlement', 'settled', 'refunded_after_settlement', 'refunded_before_settlement')
      WHERE o.seller_id = s.id
        AND o.payment_status = 'completed'
        AND o.status::text <> ALL($2::text[])
        AND COALESCE(o.metadata, '{}'::jsonb) ? 'creator_attribution'
    ) creator_sales ON true
    LEFT JOIN LATERAL (
      SELECT MIN(p.available_at) AS next_settlement_at
      FROM payouts p
      WHERE p.seller_id = s.id
        AND p.settlement_status = 'pending_settlement'
        AND p.available_at IS NOT NULL
    ) next_settlement ON true
    WHERE s.id = $1
  `;
  const { rows } = await query(sql, [sellerId, excludedStatuses]);
  return rows[0];
}

/**
 * Monthly sales totals for the last 12 months.
 *
 * @param {object} input
 * @param {number|string} input.sellerId
 * @param {string[]} input.excludedStatuses
 * @returns {Promise<Array<{month: string, sales: string}>>}
 */
export async function findMonthlySales({ sellerId, excludedStatuses }) {
  const sql = `
    SELECT
      TO_CHAR(COALESCE(p.completed_at, p.processed_at, o.updated_at, o.created_at), 'YYYY-MM') as month,
      COALESCE(SUM(o.total_amount), 0) as sales
    FROM product_orders o
    JOIN payouts p
      ON p.order_id = o.id
     AND p.settlement_status IN ('pending_settlement', 'settled', 'refunded_after_settlement', 'refunded_before_settlement')
    WHERE o.seller_id = $1
      AND o.payment_status = 'completed'
      AND o.status::text <> ALL($2::text[])
      AND COALESCE(p.completed_at, p.processed_at, o.updated_at, o.created_at) >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(COALESCE(p.completed_at, p.processed_at, o.updated_at, o.created_at), 'YYYY-MM')
    ORDER BY month
  `;
  const { rows } = await query(sql, [sellerId, excludedStatuses]);
  return rows;
}

/**
 * Eight most-recent completed orders for the seller, each with its
 * order_items rolled into a JSON array.
 *
 * @param {object} input
 * @param {number|string} input.sellerId
 * @param {string[]} input.excludedStatuses
 * @returns {Promise<Array<object>>}
 */
export async function findRecentOrders({ sellerId, excludedStatuses }) {
  const sql = `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.total_amount,
      o.created_at,
      (
        SELECT json_agg(
          json_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'price', oi.product_price
          )
        )
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) as items
    FROM product_orders o
    JOIN payouts p
      ON p.order_id = o.id
     AND p.settlement_status IN ('pending_settlement', 'settled', 'refunded_after_settlement', 'refunded_before_settlement')
    WHERE o.seller_id = $1
      AND o.payment_status = 'completed'
      AND o.status::text <> ALL($2::text[])
    ORDER BY COALESCE(p.completed_at, p.processed_at, o.updated_at, o.created_at) DESC
    LIMIT 8
  `;
  const { rows } = await query(sql, [sellerId, excludedStatuses]);
  return rows;
}

/**
 * Counts wishlist entries pointing at any of the seller's products.
 *
 * @param {number|string} sellerId
 * @returns {Promise<number>}
 */
export async function countWishlistsForSeller(sellerId) {
  const sql = `
    SELECT COUNT(*) as wishlist_count
    FROM wishlists w
    JOIN products p ON p.id = w.product_id
    WHERE p.seller_id = $1
  `;
  const { rows } = await query(sql, [sellerId]);
  return parseInt(rows[0]?.wishlist_count ?? 0, 10);
}

/**
 * Counts seller_knocks recorded in the last 24 hours.
 *
 * @param {number|string} sellerId
 * @returns {Promise<number>}
 */
export async function countRecentKnocks(sellerId) {
  const sql = `
    SELECT COUNT(*) as click_count
    FROM seller_knocks
    WHERE seller_id = $1
      AND created_at >= NOW() - INTERVAL '24 hours'
  `;
  const { rows } = await query(sql, [sellerId]);
  return parseInt(rows[0]?.click_count ?? 0, 10);
}
