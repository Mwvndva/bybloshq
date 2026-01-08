import { query } from '../config/database.js';

/**
 * Fetches the wishlist for a given buyer, joining with product details.
 * @param {string} buyerId - The UUID of the buyer.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of wishlist items.
 */
export async function findByBuyerId(buyerId) {
  const sql = `
    SELECT
      w.product_id as id,
      p.name,
      p.description,
      p.price,
      p.image_url,
      p.status,
      CASE WHEN p.status = 'sold' THEN true ELSE false END as "isSold",
      p.aesthetic,
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      s.id AS "sellerId",
      s.shop_name AS "sellerName",
      p.product_type,
      p.is_digital,
      p.service_options,
      p.service_locations,
      p.digital_file_name
    FROM wishlist w
    LEFT JOIN products p ON w.product_id = p.id
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE w.buyer_id = $1
    ORDER BY w.created_at DESC
  `;
  const { rows } = await query(sql, [buyerId]);
  return rows;
}

/**
 * Adds a product to a buyer's wishlist.
 * @param {string} buyerId - The UUID of the buyer.
 * @param {string} productId - The UUID of the product.
 * @returns {Promise<object>} - A promise that resolves to the wishlist item.
 */
export async function add(buyerId, productId) {
  // First, check if the item is already in the wishlist
  const checkSql = `
    SELECT id FROM wishlist 
    WHERE buyer_id = $1 AND product_id = $2
  `;

  const { rows: existing } = await query(checkSql, [buyerId, productId]);

  // If item already exists, throw an error
  if (existing.length > 0) {
    const error = new Error('Product already in wishlist');
    error.code = 'DUPLICATE_WISHLIST_ITEM';
    throw error;
  }

  // Otherwise, insert the new item
  const insertSql = `
    INSERT INTO wishlist (buyer_id, product_id)
    VALUES ($1, $2)
    RETURNING *
  `;
  const { rows } = await query(insertSql, [buyerId, productId]);
  return rows[0];
}

/**
 * Removes a product from a buyer's wishlist.
 * @param {string} buyerId - The UUID of the buyer.
 * @param {string} productId - The UUID of the product.
 * @returns {Promise<object | null>} - A promise that resolves to the deleted item's ID or null if not found.
 */
export async function remove(buyerId, productId) {
  const sql = `
    DELETE FROM wishlist
    WHERE buyer_id = $1 AND product_id = $2
    RETURNING id
  `;
  const { rows } = await query(sql, [buyerId, productId]);
  return rows[0];
}