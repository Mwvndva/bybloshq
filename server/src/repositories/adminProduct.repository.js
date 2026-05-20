import { query } from '../shared/db/database.js';

const BASE_SELECT_COLUMNS = [
  'p.id',
  'p.name',
  'p.description',
  'p.price',
  'p.created_at',
  's.full_name as seller_name'
];

/**
 * Returns the column names that currently exist on the products table.
 * Used by admin handlers to gracefully degrade when optional columns
 * (stock, status) aren't present yet on older schemas.
 *
 * @returns {Promise<string[]>}
 */
export async function findProductColumnNames() {
  const sql = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'products'
  `;
  const { rows } = await query(sql);
  return rows.map(row => row.column_name);
}

function buildSelectFields({ hasStock, hasStatus }) {
  const fields = [...BASE_SELECT_COLUMNS];
  if (hasStock) fields.push('p.stock');
  if (hasStatus) fields.push('p.status');
  return fields.join(', ');
}

/**
 * Lists all products with seller name, sorted newest first. The set of
 * columns returned depends on which optional columns exist in the
 * schema (passed in by the caller after consulting
 * findProductColumnNames).
 *
 * @param {object} input
 * @param {boolean} input.hasStock
 * @param {boolean} input.hasStatus
 * @returns {Promise<Array<object>>}
 */
export async function findAllWithSeller({ hasStock, hasStatus }) {
  const sql = `
    SELECT ${buildSelectFields({ hasStock, hasStatus })}
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    ORDER BY p.created_at DESC
  `;
  const { rows } = await query(sql);
  return rows;
}

/**
 * Lists a single seller's products. Schema-aware like findAllWithSeller.
 *
 * @param {object} input
 * @param {number|string} input.sellerId
 * @param {boolean} input.hasStock
 * @param {boolean} input.hasStatus
 * @returns {Promise<Array<object>>}
 */
export async function findBySellerWithSeller({ sellerId, hasStock, hasStatus }) {
  const sql = `
    SELECT ${buildSelectFields({ hasStock, hasStatus })}
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.seller_id = $1
    ORDER BY p.created_at DESC
  `;
  const { rows } = await query(sql, [sellerId]);
  return rows;
}
