import { BaseRepository } from './BaseRepository.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class ProductRepository extends BaseRepository {
  constructor(db) {
    super('products', db);
  }

  async create(data, client = this.db) {
    const {
      name, price, description, image_url, images, seller_id, aesthetic,
      is_digital, digital_file_path, digital_file_name, digital_file_size,
      product_type, service_locations, service_options
    } = data;

    const query = `
      INSERT INTO products (
        name, price, description, image_url, images, seller_id, aesthetic,
        status, created_at, updated_at,
        is_digital, digital_file_path, digital_file_name, digital_file_size,
        product_type, service_locations, service_options
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', NOW(), NOW(), $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      name, price, description, image_url, images, seller_id, aesthetic,
      is_digital, digital_file_path, digital_file_name, digital_file_size,
      product_type, service_locations, service_options
    ];

    const result = await client.query(query, values);
    return toCamelCase(result.rows[0]);
  }

  async decrementInventory(productId, quantity, client = this.db) {
    const query = `
      UPDATE products
      SET quantity = quantity - $1, updated_at = NOW()
      WHERE id = $2 AND track_inventory = true AND quantity >= $1
      RETURNING id, quantity, low_stock_threshold, name
    `;
    const result = await client.query(query, [quantity, productId]);
    return toCamelCase(result.rows[0]);
  }

  async findByIdsWithLock(ids, client = this.db) {
    const query = `
      SELECT id, quantity, price, name, low_stock_threshold FROM products
      WHERE id = ANY($1::int[]) AND track_inventory = true
      FOR UPDATE
    `;
    const result = await client.query(query, [ids]);
    return result.rows.map(toCamelCase);
  }

  async findDetailsByIds(ids, client = this.db) {
    const query = `
      SELECT id, product_type::text as product_type, is_digital, service_options, track_inventory, quantity 
      FROM products WHERE id = ANY($1)
    `;
    const result = await client.query(query, [ids]);
    return result.rows;
  }
}
