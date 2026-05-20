import { query } from '../shared/db/database.js';

/**
 * Top-level KPIs for the marketing dashboard header.
 *
 * @returns {Promise<object>}  Raw row with string-typed numeric values.
 */
export async function findOverviewStats() {
  const sql = `
    SELECT
      (SELECT COUNT(*)  FROM sellers WHERE is_active = true)                          AS total_sellers,
      (SELECT COUNT(*)  FROM buyers  WHERE user_id IS NOT NULL)                       AS total_buyers,
      (SELECT COUNT(*)  FROM products WHERE status = 'available')                       AS active_products,
      (SELECT COALESCE(SUM(total_amount), 0)
         FROM product_orders WHERE payment_status = 'completed')                      AS total_gmv,
      (SELECT COALESCE(SUM(platform_fee_amount), 0)
         FROM product_orders WHERE payment_status = 'completed')                      AS total_revenue,
      (SELECT COUNT(*) FROM product_orders WHERE payment_status = 'completed')        AS completed_orders,
      (SELECT COUNT(*) FROM product_orders WHERE status = 'CANCELLED')                AS cancelled_orders,
      (SELECT COUNT(*) FROM product_orders)                                           AS total_orders,
      (SELECT COUNT(*) FROM sellers
         WHERE created_at >= date_trunc('month', CURRENT_DATE))                       AS new_sellers_this_month,
      (SELECT COUNT(*) FROM buyers
         WHERE created_at >= date_trunc('month', CURRENT_DATE))                       AS new_buyers_this_month,
      (SELECT COALESCE(SUM(total_amount), 0) FROM product_orders
         WHERE payment_status = 'completed'
           AND paid_at >= date_trunc('month', CURRENT_DATE))                          AS gmv_this_month,
      (SELECT COUNT(*) FROM wishlists)                                                AS total_wishlists,
      (SELECT COALESCE(SUM(amount), 0) FROM refund_requests WHERE status = 'completed') AS total_refunded,
      (SELECT COALESCE(SUM(reward_amount), 0) FROM referral_earnings_log)            AS total_referral_rewards
  `;
  const { rows } = await query(sql);
  return rows[0];
}

/**
 * Monthly GMV / revenue / order volume for the requested rolling window.
 *
 * @param {object} input
 * @param {number} input.months
 * @returns {Promise<Array<object>>}
 */
export async function findGmvTrend({ months }) {
  const sql = `
    WITH month_series AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - (($1 - 1) || ' months')::interval,
        date_trunc('month', CURRENT_DATE),
        '1 month'::interval
      ) AS month
    )
    SELECT
      TO_CHAR(ms.month, 'YYYY-MM')                                           AS month,
      TO_CHAR(ms.month, 'Mon YY')                                            AS label,
      COALESCE(SUM(o.total_amount), 0)                                       AS gmv,
      COALESCE(SUM(o.platform_fee_amount), 0)                                AS revenue,
      COALESCE(SUM(o.seller_payout_amount), 0)                               AS seller_payouts,
      COUNT(o.id)                                                            AS order_count,
      COALESCE(AVG(o.total_amount), 0)                                       AS avg_order_value
    FROM month_series ms
    LEFT JOIN product_orders o
      ON date_trunc('month', o.paid_at) = ms.month
      AND o.payment_status = 'completed'
    GROUP BY ms.month
    ORDER BY ms.month ASC
  `;
  const { rows } = await query(sql, [months]);
  return rows;
}

/**
 * Monthly new seller + buyer registrations for the rolling window.
 *
 * @param {object} input
 * @param {number} input.months
 * @returns {Promise<Array<object>>}
 */
export async function findUserGrowth({ months }) {
  const sql = `
    WITH month_series AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - (($1 - 1) || ' months')::interval,
        date_trunc('month', CURRENT_DATE),
        '1 month'::interval
      ) AS month
    )
    SELECT
      TO_CHAR(ms.month, 'YYYY-MM')  AS month,
      TO_CHAR(ms.month, 'Mon YY')   AS label,
      COUNT(DISTINCT s.id)          AS new_sellers,
      COUNT(DISTINCT b.id)          AS new_buyers
    FROM month_series ms
    LEFT JOIN sellers s ON date_trunc('month', s.created_at) = ms.month
    LEFT JOIN buyers  b ON date_trunc('month', b.created_at) = ms.month
    GROUP BY ms.month
    ORDER BY ms.month ASC
  `;
  const { rows } = await query(sql, [months]);
  return rows;
}

/**
 * Product-type distribution (physical/digital/service) with revenue.
 *
 * @returns {Promise<Array<{product_type: string, count: string, total_revenue: string}>>}
 */
export async function findProductTypeMix() {
  const sql = `
    SELECT
      product_type,
      COUNT(*) AS count,
      COALESCE(SUM(oi.subtotal), 0) AS total_revenue
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN product_orders po ON oi.order_id = po.id AND po.payment_status = 'completed'
    WHERE p.status IN ('available', 'sold')
    GROUP BY product_type
    ORDER BY count DESC
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 8 aesthetic categories by product count.
 *
 * @returns {Promise<Array<{aesthetic: string, product_count: string}>>}
 */
export async function findAestheticMix() {
  const sql = `
    SELECT
      COALESCE(aesthetic, 'uncategorised') AS aesthetic,
      COUNT(*) AS product_count
    FROM products
    GROUP BY aesthetic
    ORDER BY product_count DESC
    LIMIT 8
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Order count + total value grouped by order status.
 *
 * @returns {Promise<Array<{status: string, count: string, total_value: string}>>}
 */
export async function findOrderStatusFunnel() {
  const sql = `
    SELECT
      status,
      COUNT(*) AS count,
      COALESCE(SUM(total_amount), 0) AS total_value
    FROM product_orders
    GROUP BY status
    ORDER BY count DESC
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Order count + total value grouped by payment status.
 *
 * @returns {Promise<Array<{payment_status: string, count: string, total_value: string}>>}
 */
export async function findPaymentStatusFunnel() {
  const sql = `
    SELECT
      payment_status,
      COUNT(*) AS count,
      COALESCE(SUM(total_amount), 0) AS total_value
    FROM product_orders
    GROUP BY payment_status
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 cities by buyer count.
 *
 * @returns {Promise<Array<{location: string, buyer_count: string}>>}
 */
export async function findBuyerLocations() {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(city), ''), 'Unknown City') AS location,
      COUNT(*) AS buyer_count
    FROM buyers
    GROUP BY 1
    ORDER BY buyer_count DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 cities by active seller count, with GMV (from sellers.total_sales).
 *
 * @returns {Promise<Array<{location: string, seller_count: string, location_gmv: string}>>}
 */
export async function findSellerLocations() {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(city), ''), 'Unknown City') AS location,
      COUNT(*) AS seller_count,
      COALESCE(SUM(total_sales), 0) AS location_gmv
    FROM sellers
    WHERE is_active = true
    GROUP BY 1
    ORDER BY seller_count DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 cities by GMV (from completed orders, joined to the seller's city).
 *
 * @returns {Promise<Array<{location: string, gmv: string, order_count: string}>>}
 */
export async function findGmvLocations() {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(s.city), ''), 'Unknown City') AS location,
      COALESCE(SUM(o.total_amount), 0) AS gmv,
      COUNT(o.id) AS order_count
    FROM product_orders o
    JOIN sellers s ON o.seller_id = s.id
    WHERE o.payment_status = 'completed'
    GROUP BY 1
    ORDER BY gmv DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 active sellers by total_sales.
 *
 * @returns {Promise<Array<object>>}
 */
export async function findTopSellers() {
  const sql = `
    SELECT
      s.id,
      s.shop_name,
      s.location,
      s.total_sales,
      s.client_count,
      COUNT(DISTINCT o.id) AS order_count
    FROM sellers s
    LEFT JOIN product_orders o ON o.seller_id = s.id AND o.payment_status = 'completed'
    WHERE s.is_active = true
    GROUP BY s.id
    ORDER BY s.total_sales DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 products by completed-order revenue.
 *
 * @returns {Promise<Array<object>>}
 */
export async function findTopProducts() {
  const sql = `
    SELECT
      p.id,
      p.name,
      p.product_type,
      p.aesthetic,
      COALESCE(SUM(oi.subtotal), 0) AS total_revenue,
      COALESCE(SUM(oi.quantity), 0) AS units_sold
    FROM products p
    JOIN order_items oi ON oi.product_id = p.id
    JOIN product_orders po ON oi.order_id = po.id AND po.payment_status = 'completed'
    GROUP BY p.id
    ORDER BY total_revenue DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 products by wishlist count.
 *
 * @returns {Promise<Array<object>>}
 */
export async function findTopWishlisted() {
  const sql = `
    SELECT
      p.id,
      p.name,
      p.product_type,
      p.price,
      COUNT(w.id) AS wishlist_count
    FROM products p
    JOIN wishlists w ON w.product_id = p.id
    GROUP BY p.id
    ORDER BY wishlist_count DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Last 12 months of referral rewards rollup (active referrers, pair
 * count, total rewards, referred GMV).
 *
 * @returns {Promise<Array<object>>}
 */
export async function findMonthlyReferralRewards() {
  const sql = `
    SELECT
      period_year,
      period_month,
      TO_CHAR(TO_DATE(period_month::text, 'MM'), 'Mon') || ' ' || period_year AS label,
      COUNT(DISTINCT referrer_seller_id) AS active_referrers,
      COUNT(*) AS referral_pairs,
      COALESCE(SUM(reward_amount), 0) AS total_rewards,
      COALESCE(SUM(referred_gmv), 0)  AS referred_gmv
    FROM referral_earnings_log
    GROUP BY period_year, period_month
    ORDER BY period_year DESC, period_month DESC
    LIMIT 12
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Top 10 referrers by total earnings.
 *
 * @returns {Promise<Array<object>>}
 */
export async function findTopReferrers() {
  const sql = `
    SELECT
      s.shop_name,
      s.location,
      COUNT(DISTINCT rel.referred_seller_id) AS referrals_made,
      COALESCE(SUM(rel.reward_amount), 0)    AS total_earned
    FROM referral_earnings_log rel
    JOIN sellers s ON s.id = rel.referrer_seller_id
    GROUP BY s.id
    ORDER BY total_earned DESC
    LIMIT 10
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Platform-level referral status: sellers with codes, sellers acquired
 * via referral.
 *
 * @returns {Promise<{sellers_with_codes: string, referred_sellers: string}>}
 */
export async function findReferralStats() {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE referral_code IS NOT NULL) AS sellers_with_codes,
      COUNT(*) FILTER (WHERE referred_by_seller_id IS NOT NULL) AS referred_sellers
    FROM sellers
  `;
  const { rows } = await query(sql);
  return rows[0];
}

/**
 * Recent activity feed: most recent orders, new sellers, and new buyers
 * merged into a single timeline.
 *
 * @param {object} input
 * @param {number} input.limit
 * @returns {Promise<Array<{type: string, timestamp: string, description: string, value: string|null}>>}
 */
export async function findRecentActivity({ limit }) {
  const sql = `
    (
      SELECT
        'order' AS type,
        o.created_at AS timestamp,
        'New order: KSh ' || o.total_amount || ' from ' || s.shop_name AS description,
        o.total_amount AS value
      FROM product_orders o
      JOIN sellers s ON o.seller_id = s.id
      WHERE o.payment_status = 'completed'
      ORDER BY o.created_at DESC
      LIMIT $1
    )
    UNION ALL
    (
      SELECT
        'seller' AS type,
        s.created_at AS timestamp,
        'New seller: ' || s.shop_name || ' (' || COALESCE(s.location, 'Nairobi') || ')' AS description,
        NULL AS value
      FROM sellers s
      ORDER BY s.created_at DESC
      LIMIT $1
    )
    UNION ALL
    (
      SELECT
        'buyer' AS type,
        b.created_at AS timestamp,
        'New buyer registered in ' || COALESCE(b.location, 'Nairobi') AS description,
        NULL AS value
      FROM buyers b
      WHERE b.user_id IS NOT NULL
      ORDER BY b.created_at DESC
      LIMIT $1
    )
    ORDER BY timestamp DESC
    LIMIT $1
  `;
  const { rows } = await query(sql, [limit]);
  return rows;
}
