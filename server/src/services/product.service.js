import ProductModel from '../models/product.model.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import cacheService from './cache.service.js';

class ProductService {
    /**
     * Create a new product
     */
    static async createProduct(sellerId, data) {
        const {
            name, price, description, image, image_url, aesthetic = 'noir',
            is_digital = false, digital_file_path, digital_file_name, digital_file_size,
            product_type = 'physical', service_locations, service_options
        } = data;

        // Validation Logic
        if (!name || !price || !description) {
            throw new Error('Name, price, and description are required');
        }

        if (is_digital && !digital_file_path) {
            throw new Error('Digital file is required for digital products');
        }

        const validProductTypes = ['physical', 'digital', 'service'];
        if (product_type && !validProductTypes.includes(product_type)) {
            throw new Error('Invalid product type');
        }

        if (product_type === 'service' && (!service_options || !service_options.availability_days)) {
            throw new Error('Availability days are required for services');
        }

        // Image Handling - now optional
        let imageData = image_url || image || null;

        if (imageData) {
            // Validate image format only if image is provided
            // Allow: base64 (data:image/), local fallback (/uploads/), and remote Cloudinary URLs (http/https)
            const isBase64 = imageData.startsWith('data:image/');
            const isLocal = imageData.startsWith('/uploads/');
            const isRemote = imageData.startsWith('http');

            if (isRemote) {
                try {
                    const url = new URL(imageData);
                    const hostname = url.hostname.toLowerCase();

                    // Block internal/private IPs and localhost
                    const isInternal = hostname === 'localhost' ||
                        hostname === '127.0.0.1' ||
                        hostname.startsWith('192.168.') ||
                        hostname.startsWith('10.') ||
                        hostname.startsWith('172.16.') ||
                        hostname.endsWith('.local') ||
                        hostname.endsWith('.internal');

                    if (isInternal) {
                        throw new Error('Invalid remote image URL: Internal addresses are not allowed.');
                    }

                    // Optional: Whitelist Cloudinary if required
                    // if (!hostname.includes('cloudinary.com')) { ... }
                } catch (e) {
                    throw new Error(e.message.includes('Internal addresses') ? e.message : 'Invalid remote image URL format.');
                }
            }

            if (!isBase64 && !isLocal && !isRemote) {
                throw new Error('Invalid image format. Expected base64, local path, or remote URL.');
            }

            // Size validation only applies to raw base64 data before upload
            // Remote/Local URLs are already "physical" files on disk or cloud
            if (isBase64) {
                const imageSize = (imageData.length * 0.75);
                if (imageSize > 5 * 1024 * 1024) { // Increased to 5MB for modern assets
                    throw new Error('Image size exceeds 5MB limit');
                }
            }
        }

        let finalProductType = product_type;
        if (is_digital) finalProductType = 'digital';

        const productData = {
            name: name.trim(),
            price: Number.parseFloat(price),
            description: description.trim(),
            image_url: imageData,
            images: data.images ? JSON.stringify(data.images) : '[]',
            seller_id: sellerId,
            aesthetic,
            is_digital: is_digital || false,
            digital_file_path: digital_file_path || null,
            digital_file_name: digital_file_name || null,
            digital_file_size: digital_file_size || null,
            product_type: finalProductType,
            service_locations: service_locations || null,
            service_options: service_options || null
        };

        // Ensure images is always stored as a stringified array
        if (typeof productData.images !== 'string') {
            productData.images = JSON.stringify(productData.images || []);
        }

        const product = await ProductModel.create(null, productData); // Use default pool
        logger.info('Product created:', { id: product.id, sellerId });

        // Invalidate cache
        await cacheService.clearPattern("products:*");

        return product;
    }

    static async getSellerProducts(sellerId) {
        // Logic transformation from controller (null checks etc)
        const products = await ProductModel.findBySellerId(sellerId);
        return products.map(p => ({
            ...p,
            status: p.status || 'published',
            soldAt: p.sold_at || null, // Map snake_case DB to expected camelCase response if needed? 
            // Controller mapped `soldAt: p.soldAt || null`.
            // DB returns snake_case usually unless aliased.
            // Model `findBySellerId` returns `SELECT *`.
            // Keep consistency with DB fields internally, map at Service exit or Controller?
            // Service should return Domain Objects.
            // Controller does formatting.
        }));
    }

    static async getProduct(id, sellerId) {
        const product = await ProductModel.findById(id);
        if (!product || (sellerId && product.seller_id !== sellerId)) {
            throw new Error('Product not found or unauthorized');
        }
        return product;
    }

    static async updateProduct(sellerId, productId, data) {
        const { name, price, description, image_url, images, aesthetic, status, soldAt } = data;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verify Ownership
            // Model.findById could be used, but we need FOR UPDATE logic maybe?
            // The controller used FOR UPDATE.
            // Let's implement a concise lock check or just trust `UPDATE ... WHERE seller_id=` returns 0 rows if unauthorized.
            // ProductModel.update includes seller_id in WHERE clause.
            // ProductModel.update includes seller_id in WHERE clause.

            const updateFields = {};
            if (name !== undefined) updateFields.name = name;
            if (price !== undefined) updateFields.price = Number.parseFloat(price);
            if (description !== undefined) updateFields.description = description;
            if (image_url !== undefined) updateFields.image_url = image_url;
            if (images !== undefined) {
                updateFields.images = Array.isArray(images) ? JSON.stringify(images) : images;
            }
            if (aesthetic !== undefined) updateFields.aesthetic = aesthetic;

            // Status & SoldAt logic
            const hasSoldAt = true; // sold_at column exists per schema (20260208_unified_schema_v3.sql)

            if (hasSoldAt) {
                if (soldAt !== undefined) {
                    updateFields.sold_at = soldAt;
                    updateFields.status = soldAt ? 'sold' : 'available';
                } else if (status) {
                    updateFields.status = status;
                }
            }

            const updatedProduct = await ProductModel.update(client, productId, sellerId, updateFields);

            if (!updatedProduct) {
                // Could be not found OR unauthorized (since seller_id is part of query)
                const exists = await ProductModel.findById(productId);
                if (!exists) throw new Error('Product not found');
                if (exists.seller_id !== sellerId) throw new Error('Unauthorized');
                throw new Error('Update failed');
            }

            await client.query('COMMIT');

            // Invalidate cache
            await cacheService.clearPattern("products:*");

            return updatedProduct;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateInventory(productId, inventoryData) {
        const { track_inventory, quantity, low_stock_threshold } = inventoryData;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Build update query
            const updateFields = [];
            const values = [];
            let paramCount = 1;

            if (track_inventory !== undefined) {
                updateFields.push(`track_inventory = $${paramCount++}`);
                values.push(track_inventory);
            }

            if (quantity !== undefined) {
                updateFields.push(`quantity = $${paramCount++}`);
                values.push(quantity);
            }

            if (low_stock_threshold !== undefined) {
                updateFields.push(`low_stock_threshold = $${paramCount++}`);
                values.push(low_stock_threshold);
            }

            if (updateFields.length === 0) {
                throw new Error('No inventory fields to update');
            }

            values.push(productId);
            const query = `
                UPDATE products 
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Product not found');
            }

            await client.query('COMMIT');
            logger.info(`[INVENTORY] Updated inventory for product ${productId}:`, {
                track_inventory,
                quantity,
                low_stock_threshold
            });

            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[INVENTORY] Error updating inventory:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    static async deleteProduct(sellerId, productId) {
        const deleted = await ProductModel.delete(null, productId, sellerId);
        if (!deleted) {
            const exists = await ProductModel.findById(productId);
            if (!exists) throw new Error('Product not found');
            if (exists.seller_id !== sellerId) throw new Error('Unauthorized');
        }

        // Invalidate cache
        await cacheService.clearPattern("products:*");

        return true;
    }
}

export default ProductService;
