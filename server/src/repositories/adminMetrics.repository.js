import { query } from '../shared/db/database.js';

// Order statuses excluded from money-counting financial aggregates.
// Kept here because every query in this module needs the same list.
const FINANCIAL_EXCLUDED_STATUSES = `
  'CANCELLED', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED',
  'MANUAL_REVIEW', 'COMPENSATION_REQUIRED'
`;

/**
 * 12-month rolling new-entity counts (sellers, products, buyers) per
 * month, padded with zero rows for months with no inserts.
 *
 * @returns {Promise<Array<{month: string, seller_count: string, product_count: string, buyer_count: string}>>}
 */
export async function findMonthlyEntityCounts() {
  const sql = `
    WITH months AS (
      SELECT
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months' + (n || ' months')::interval) AS month
      FROM generate_series(0, 11) n
    ),
    seller_counts AS (
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        COUNT(*) AS seller_count
      FROM sellers
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY DATE_TRUNC('month', created_at)
    ),
    product_counts AS (
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        COUNT(*) AS product_count
      FROM products
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY DATE_TRUNC('month', created_at)
    ),
    buyer_counts AS (
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        COUNT(*) AS buyer_count
      FROM buyers
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY DATE_TRUNC('month', created_at)
    )
    SELECT
      TO_CHAR(m.month, 'YYYY-MM-DD') AS month,
      COALESCE(sc.seller_count, 0) AS seller_count,
      COALESCE(pc.product_count, 0) AS product_count,
      COALESCE(bc.buyer_count, 0) AS buyer_count
    FROM months m
    LEFT JOIN seller_counts sc ON sc.month = m.month
    LEFT JOIN product_counts pc ON pc.month = m.month
    LEFT JOIN buyer_counts bc ON bc.month = m.month
    ORDER BY m.month ASC
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Total sales (KES sum + order count) across all money-counted orders.
 *
 * @returns {Promise<{total_sales: string, total_orders: string}>}
 */
export async function findTotalSales() {
  const sql = `
    SELECT
      COALESCE(SUM(total_amount), 0) as total_sales,
      COUNT(*) as total_orders
    FROM product_orders
    WHERE payment_status = 'completed'
      AND status::text NOT IN (${FINANCIAL_EXCLUDED_STATUSES})
  `;
  const { rows } = await query(sql);
  return rows[0];
}

/**
 * Total platform commission across money-counted orders.
 *
 * @returns {Promise<{total_commission: string}>}
 */
export async function findTotalCommission() {
  const sql = `
    SELECT
      COALESCE(SUM(platform_fee_amount), 0) as total_commission
    FROM product_orders
    WHERE payment_status = 'completed'
      AND status::text NOT IN (${FINANCIAL_EXCLUDED_STATUSES})
  `;
  const { rows } = await query(sql);
  return rows[0];
}

/**
 * Total dollars and count for refund_requests in the 'completed' state.
 *
 * @returns {Promise<{total_refunds: string, total_refund_requests: string}>}
 */
export async function findCompletedRefundsTotal() {
  const sql = `
    SELECT
      COALESCE(SUM(amount), 0) as total_refunds,
      COUNT(*) as total_refund_requests
    FROM refund_requests
    WHERE status = 'completed'
  `;
  const { rows } = await query(sql);
  return rows[0];
}

/**
 * Sum of buyers.refunds where refunds > 0 — the outstanding refund
 * liability sitting on buyer wallets.
 *
 * @returns {Promise<{pending_refunds: string}>}
 */
export async function findPendingRefundsTotal() {
  const sql = `
    SELECT
      COALESCE(SUM(refunds), 0) as pending_refunds
    FROM buyers
    WHERE refunds > 0
  `;
  const { rows } = await query(sql);
  return rows[0];
}

/**
 * 12-month sales / commission / refund totals per month, padded with
 * zeros for missing months.
 *
 * @returns {Promise<Array<{month: string, sales: string, commission: string, refunds: string}>>}
 */
export async function findMonthlyFinancials() {
  const sql = `
    WITH monthly_dates AS (
      SELECT
        date_trunc('month', CURRENT_DATE - (n || ' months')::interval) AS month
      FROM generate_series(0, 11) n
    ),
    monthly_sales AS (
      SELECT
        date_trunc('month', created_at) AS month,
        COALESCE(SUM(total_amount), 0) AS sales,
        COALESCE(SUM(platform_fee_amount), 0) AS commission
      FROM product_orders
      WHERE payment_status = 'completed'
        AND status::text NOT IN (${FINANCIAL_EXCLUDED_STATUSES})
        AND created_at >= CURRENT_DATE - interval '12 months'
      GROUP BY date_trunc('month', created_at)
    ),
    monthly_refunds AS (
      SELECT
        date_trunc('month', processed_at) AS month,
        COALESCE(SUM(amount), 0) AS refunds
      FROM refund_requests
      WHERE status = 'completed'
        AND processed_at >= CURRENT_DATE - interval '12 months'
      GROUP BY date_trunc('month', processed_at)
    )
    SELECT
      md.month,
      COALESCE(ms.sales, 0) AS sales,
      COALESCE(ms.commission, 0) AS commission,
      COALESCE(mr.refunds, 0) AS refunds
    FROM monthly_dates md
    LEFT JOIN monthly_sales ms ON md.month = ms.month
    LEFT JOIN monthly_refunds mr ON md.month = mr.month
    ORDER BY md.month ASC
  `;
  const { rows } = await query(sql);
  return rows;
}
