import { pool } from '../config/database.js';
import { toJsonb } from '../utils/order.utils.js';

class ProductModel {
    /**
     * Create a new product.
     * Enforces JSONB safety for images, service_locations, and service_options.
     */
    static async create(client, data) {
        const query = `
            INSERT INTO products (
                name, price, description, image_url, images, seller_id, aesthetic,
                status, created_at, updated_at,
                is_digital, digital_file_path, digital_file_name, digital_file_size,
                product_type, service_locations, service_options
            ) VALUES (
                $1, $2, $3, $4, $5::jsonb, $6, $7, 
                'available', NOW(), NOW(), 
                $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb
            )
            RETURNING *
        `;

        const values = [
            data.name,                                       // $1
            data.price,                                      // $2
            data.description,                                // $3
            data.image_url,                                  // $4
            toJsonb(data.images || []),                      // $5 (JSONB)
            data.seller_id,                                  // $6
            data.aesthetic,                                  // $7
            data.is_digital ?? false,                       // $8
            data.digital_file_path ?? null,                  // $9
            data.digital_file_name ?? null,                  // $10
            data.digital_file_size ?? null,                  // $11
            data.product_type ?? 'physical',                 // $12
            toJsonb(data.service_locations ?? null),         // $13 (JSONB)
            toJsonb(data.service_options ?? null)            // $14 (JSONB)
        ];

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
            SELECT 
                p.id, p.name, p.description, p.price,
                p.image_url AS "imageUrl", p.images, p.aesthetic,
                p.seller_id AS "sellerId", p.status,
                p.created_at AS "createdAt", p.updated_at AS "updatedAt",
                p.is_digital AS "isDigital", p.product_type AS "productType",
                p.service_locations AS "serviceLocations", p.service_options AS "serviceOptions",
                s.shop_name AS "sellerName"
            FROM products p
            JOIN sellers s ON p.seller_id = s.id
            WHERE p.seller_id = $1 AND p.status = 'available'
            ORDER BY p.created_at DESC
        `;
        const { rows } = await pool.query(query, [sellerId]);
        return rows;
    }

    static async getAllProducts() {
        /**
         * RULE 4 & 5 - Verified: No shipping_address selected.
         * Only canonical location fields for sellers are included.
         */
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

    /**
     * RULE 2 — NO DYNAMIC SQL
     * Update method uses a static SQL query for updatable fields.
     */
    static async update(client, id, sellerId, data) {
        const query = `
            UPDATE products 
            SET 
                name = COALESCE($1, name),
                price = COALESCE($2, price),
                description = COALESCE($3, description),
                image_url = COALESCE($4, image_url),
                images = COALESCE($5::jsonb, images),
                aesthetic = COALESCE($6, aesthetic),
                status = COALESCE($7, status),
                is_sold = COALESCE($8, is_sold),
                sold_at = COALESCE($9, sold_at),
                track_inventory = COALESCE($10, track_inventory),
                quantity = COALESCE($11, quantity),
                low_stock_threshold = COALESCE($12, low_stock_threshold),
                service_options = COALESCE($13::jsonb, service_options),
                service_locations = COALESCE($14::jsonb, service_locations),
                updated_at = NOW()
            WHERE id = $15 AND seller_id = $16
            RETURNING *
        `;

        const values = [
            data.name ?? null,                               // $1
            data.price ?? null,                              // $2
            data.description ?? null,                        // $3
            data.image_url ?? null,                          // $4
            data.images ? toJsonb(data.images) : null,       // $5
            data.aesthetic ?? null,                          // $6
            data.status ?? null,                             // $7
            data.is_sold ?? null,                            // $8
            data.sold_at ?? null,                            // $9
            data.track_inventory ?? null,                    // $10
            data.quantity ?? null,                           // $11
            data.low_stock_threshold ?? null,                // $12
            data.service_options ? toJsonb(data.service_options) : null, // $13
            data.service_locations ? toJsonb(data.service_locations) : null, // $14
            id,                                              // $15
            sellerId                                         // $16
        ];

        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    static async delete(client, id, sellerId) {
        const executor = client || pool;
        const { rowCount } = await executor.query(
            'DELETE FROM products WHERE id = $1 AND seller_id = $2',
            [id, sellerId]
        );
        return rowCount > 0;
    }

    /**
     * PIN-08 / PIN-10: INVENTORY MANAGEMENT
     * Decrements available quantity and increments reserved/sold quantity.
     */
    static async decrementInventory(client, items) {
        const trackedItems = items.filter(i => i.track_inventory);
        if (trackedItems.length === 0) return [];

        const productIds = trackedItems.map(i => i.productId);

        // 1. Lock rows
        await client.query(
            `SELECT id, quantity FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
            [productIds]
        );

        // 2. Perform bulk decrement
        const results = [];
        for (const item of trackedItems) {
            const query = `
                UPDATE products 
                SET quantity = quantity - $1, 
                    reserved_quantity = reserved_quantity + $1,
                    updated_at = NOW()
                WHERE id = $2 AND quantity >= $1
                RETURNING id, quantity, low_stock_threshold, name
            `;
            const { rows } = await client.query(query, [item.quantity, item.productId]);
            if (rows.length === 0) {
                throw new Error(`Insufficient stock for product ${item.productId}`);
            }
            results.push(rows[0]);
        }
        return results;
    }

    static async finalizeInventory(client, items) {
        const trackedItems = items.filter(i => i.track_inventory);
        if (trackedItems.length === 0) return;

        for (const item of trackedItems) {
            const query = `
                UPDATE products 
                SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
                    updated_at = NOW()
                WHERE id = $2
            `;
            await client.query(query, [item.quantity, item.productId]);
        }
    }

    static async findByIds(ids, client = null) {
        const query = 'SELECT id, price, product_type::text as product_type, is_digital, service_options, track_inventory, quantity, reserved_quantity FROM products WHERE id = ANY($1)';
        const executor = client || pool;
        const { rows } = await executor.query(query, [ids]);
        return rows;
    }

    static async deleteBySellerId(client, sellerId) {
        const query = 'DELETE FROM products WHERE seller_id = $1';
        const executor = client || pool;
        await executor.query(query, [sellerId]);
    }

    static async updateInventory(client, id, data) {
        const fields = [];
        const values = [];
        let i = 1;

        if (data.track_inventory !== undefined) {
            fields.push(`track_inventory = $${i++}`);
            values.push(data.track_inventory);
        }
        if (data.quantity !== undefined) {
            fields.push(`quantity = $${i++}`);
            values.push(data.quantity);
        }
        if (data.low_stock_threshold !== undefined) {
            fields.push(`low_stock_threshold = $${i++}`);
            values.push(data.low_stock_threshold);
        }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    static async releaseInventory(client, items) {
        const trackedItems = items.filter(i => i.trackInventory);
        if (trackedItems.length === 0) return;

        const results = [];
        for (const item of trackedItems) {
            const qty = Number.parseInt(item.quantity, 10) || 1;
            const productId = Number.parseInt(item.productId, 10);

            const query = `
                UPDATE products 
                SET 
                    quantity = quantity + $1,
                    reserved_quantity = GREATEST(0, reserved_quantity - $1),
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, quantity, reserved_quantity
            `;
            const { rows } = await client.query(query, [qty, productId]);
            results.push(rows[0]);
        }
        return results;
    }
}

export default ProductModel;

