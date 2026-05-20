import { query } from '../shared/db/database.js';

const PRODUCT_LIST_SELECT = `
  SELECT p.*,
         COUNT(*) OVER() AS total_count,
         p.is_digital as "isDigital",
         p.digital_file_name as "digitalFileName",
         s.id as seller_id,
         s.shop_name as seller_shop_name,
         s.city as seller_city,
         s.location as seller_location,
         s.physical_address as physical_address,
         s.latitude as latitude,
         s.longitude as longitude,
         s.avatar_url as seller_avatar_url,
         s.bio as seller_bio,
         s.theme as seller_theme,
         s.created_at as seller_created_at,
         s.updated_at as seller_updated_at
  FROM products p
  JOIN sellers s ON p.seller_id = s.id
  WHERE p.status = $1
`;

/**
 * Lists available products joined with seller info, filtered by
 * optional aesthetic/city/location, paginated, ordered newest first.
 * Each row carries a windowed total_count.
 *
 * @param {object} input
 * @param {string} [input.aesthetic]  Skip when 'all' or falsy.
 * @param {string} [input.city]
 * @param {string} [input.location]   Requires city; LIKE-matched.
 * @param {number} input.limit
 * @param {number} input.offset
 * @returns {Promise<Array<object>>}
 */
export async function findActiveProductsWithSeller({ aesthetic, city, location, limit, offset }) {
  let sql = PRODUCT_LIST_SELECT;
  const params = ['available'];

  if (aesthetic && aesthetic !== 'all') {
    params.push(aesthetic);
    sql += ` AND p.aesthetic = $${params.length}`;
  }
  if (city) {
    params.push(city);
    sql += ` AND LOWER(s.city) = LOWER($${params.length})`;
    if (location) {
      params.push(`%${location}%`);
      sql += ` AND LOWER(s.location) LIKE LOWER($${params.length})`;
    }
  }

  params.push(limit, offset);
  sql += ` ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Fetches a single product joined with seller info.
 *
 * @param {number|string} productId
 * @returns {Promise<object|undefined>}
 */
export async function findProductByIdWithSeller(productId) {
  const sql = `
    SELECT p.*,
           s.shop_name,
           s.city as seller_city,
           s.location as seller_location,
           s.theme as seller_theme,
           s.physical_address,
           s.latitude,
           s.longitude
    FROM products p
    JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = $1
  `;
  const { rows } = await query(sql, [productId]);
  return rows[0];
}

/**
 * Returns the distinct aesthetic values across all available products,
 * with falsy values filtered out.
 *
 * @returns {Promise<string[]>}
 */
export async function findDistinctAestheticsForAvailable() {
  const sql = `SELECT DISTINCT aesthetic FROM products WHERE status = $1`;
  const { rows } = await query(sql, ['available']);
  return rows.map(r => r.aesthetic).filter(Boolean);
}

/**
 * Returns service slots for the given product/date that are unavailable
 * (booked, or reserved with a future expiry). Caller filters / formats
 * as needed.
 *
 * @param {object} input
 * @param {number|string} input.productId
 * @param {string} input.date            YYYY-MM-DD in Africa/Nairobi.
 * @returns {Promise<Array<{time_slot: string, status: string, is_unavailable: boolean}>>}
 */
export async function findUnavailableServiceSlots({ productId, date }) {
  const sql = `
    SELECT
      time_slot,
      status,
      CASE
        WHEN status = 'BOOKED' THEN true
        WHEN status = 'RESERVED' AND expires_at > NOW() THEN true
        ELSE false
      END as is_unavailable
    FROM service_slots
    WHERE service_id = $1
      AND DATE(time_slot AT TIME ZONE 'Africa/Nairobi') = $2::date
      AND (status = 'BOOKED' OR (status = 'RESERVED' AND expires_at > NOW()))
    ORDER BY time_slot ASC, id ASC
  `;
  const { rows } = await query(sql, [productId, date]);
  return rows;
}
