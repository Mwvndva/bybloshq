import { pool } from '../config/database.js';

class ProductModel {
    static async create(client, data) {
        const {
            name, price, description, image_url, seller_id, aesthetic,
            is_digital, digital_file_path, digital_file_name,
            product_type, service_locations, service_options
        } = data;

        const query = `
      INSERT INTO products (
        name, price, description, image_url, seller_id, aesthetic,
        status, created_at, updated_at,
        is_digital, digital_file_path, digital_file_name,
        product_type, service_locations, service_options
      ) VALUES ($1, $2, $3, $4, $5, $6, 'available', NOW(), NOW(), $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

        const values = [
            name, price, description, image_url, seller_id, aesthetic,
            is_digital, digital_file_path, digital_file_name,
            product_type, service_locations, service_options
        ];

        // support transaction client or default pool
        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    static async findById(id) {
        const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        return rows[0];
    }

    static async findBySellerId(sellerId) {
        const query = `
      SELECT * FROM products 
      WHERE seller_id = $1 
      ORDER BY created_at DESC
    `;
        const { rows } = await pool.query(query, [sellerId]);
        return rows;
    }

    static async getAllProducts() {
        // Simple feed query, could be paginated later
        // JOIN to get seller details including physical shop info
        const query = `
            SELECT 
                p.*,
                s.shop_name,
                s.physical_address,
                s.latitude,
                s.longitude,
                s.location as seller_location,
                s.city as seller_city
            FROM products p
            JOIN sellers s ON p.seller_id = s.id
            WHERE p.status = 'available'
            ORDER BY p.created_at DESC
        `;
        const { rows } = await pool.query(query);
        return rows;
    }

    static async update(client, id, sellerId, updateData) {
        const keys = Object.keys(updateData);
        if (keys.length === 0) return null;

        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        const values = Object.values(updateData);

        const query = `
        UPDATE products 
        SET ${setClause}, updated_at = NOW() 
        WHERE id = $${keys.length + 1} AND seller_id = $${keys.length + 2}
        RETURNING *
      `;

        const executor = client || pool;
        const { rows } = await executor.query(query, [...values, id, sellerId]);
        return rows[0];
    }

    // Specialized check to see if columns exist (legacy support from controller)
    static async checkColumns(client, columns) {
        const executor = client || pool;
        // This is a bit specific, but kept for safe migration if schema varies
        const query = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products'
        AND column_name = ANY($1)
      `;
        const { rows } = await executor.query(query, [columns]);
        return rows.map(r => r.column_name);
    }

    static async delete(client, id, sellerId) {
        const executor = client || pool;
        const { rowCount } = await executor.query(
            'DELETE FROM products WHERE id = $1 AND seller_id = $2',
            [id, sellerId]
        );
        return rowCount > 0;
    }
}

export default ProductModel;
