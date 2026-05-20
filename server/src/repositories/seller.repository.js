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

/**
 * Returns the public-facing columns for a single seller. Undefined when
 * not found.
 *
 * @param {number|string} sellerId
 * @returns {Promise<object|undefined>}
 */
export async function findPublicById(sellerId) {
  const sql = `
    SELECT id, shop_name, city, location, theme, created_at, updated_at
    FROM sellers
    WHERE id = $1
  `;
  const { rows } = await query(sql, [sellerId]);
  return rows[0];
}

/**
 * Lists active sellers for the public directory, sorted by wishlist
 * popularity, including 24-hour knock counts and a windowed total count.
 *
 * @param {object} input
 * @param {number} input.limit
 * @param {number} input.offset
 * @returns {Promise<Array<object>>}
 */
export async function findActiveWithStats({ limit, offset }) {
  const sql = `
    SELECT
      s.id,
      s.full_name,
      s.shop_name,
      s.banner_image,
      s.avatar_url,
      s.bio,
      s.theme,
      s.physical_address,
      s.latitude,
      s.longitude,
      s.client_count,
      s.created_at,
      COALESCE(k.knock_count, 0) AS knock_count,
      COUNT(*) OVER() AS total_count,
      COUNT(w.id) as total_wishlist_count
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id
    LEFT JOIN wishlists w ON p.id = w.product_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS knock_count
      FROM seller_knocks sk
      WHERE sk.seller_id = s.id
        AND sk.created_at >= NOW() - INTERVAL '24 hours'
    ) k ON true
    GROUP BY s.id, k.knock_count
    ORDER BY total_wishlist_count DESC, s.id ASC
    LIMIT $1 OFFSET $2
  `;
  const { rows } = await query(sql, [limit, offset]);
  return rows;
}

/**
 * Records a knock against a seller and returns both whether the seller
 * exists and the 24-hour knock count. If the seller does not exist, no
 * row is inserted and seller_exists is false.
 *
 * @param {number} sellerId
 * @returns {Promise<{seller_exists: boolean, knock_count: number}>}
 */
export async function recordKnockAndCount(sellerId) {
  const sql = `
    WITH target AS (
      SELECT id FROM sellers WHERE id = $1
    ),
    inserted AS (
      INSERT INTO seller_knocks (seller_id)
      SELECT id FROM target
      RETURNING seller_id
    )
    SELECT
      EXISTS(SELECT 1 FROM target) AS seller_exists,
      (
        SELECT COUNT(*)::int
        FROM seller_knocks
        WHERE seller_id = $1
          AND created_at >= NOW() - INTERVAL '24 hours'
      ) AS knock_count
  `;
  const { rows } = await query(sql, [sellerId]);
  return rows[0];
}

// ─── Transactional methods ──────────────────────────────────────────────────
// Pass a pg.PoolClient as `executor` to participate in a caller-managed
// transaction; defaults to the wrapped module-level query helper.

const DEFAULT_EXECUTOR = { query };

/**
 * Acquires a row-level lock on a seller, returning the id only. Used to
 * serialize concurrent operations against a seller's balance (e.g. the
 * admin withdrawal-override refund path).
 *
 * @param {number|string} sellerId
 * @param {{query: Function}} [executor]
 */
export async function lockById(sellerId, executor = DEFAULT_EXECUTOR) {
  const sql = `SELECT id FROM sellers WHERE id = $1 FOR UPDATE`;
  await executor.query(sql, [sellerId]);
}
