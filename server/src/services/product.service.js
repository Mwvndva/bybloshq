import ProductModel from '../models/product.model.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';

class ProductService {
    /**
     * Create a new product
     */
    static async createProduct(sellerId, data) {
        const {
            name, price, description, image, image_url, aesthetic = 'noir',
            is_digital = false, digital_file_path, digital_file_name,
            product_type = 'physical', service_locations, service_options
        } = data;

        // Validation Logic
        if (!name || !price || !description || (!image && !image_url)) {
            throw new Error('Name, price, description, and image are required');
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

        // Image Handling
        const imageData = image_url || image;
        if (!imageData.startsWith('data:image/') && !imageData.startsWith('/uploads/')) {
            throw new Error('Invalid image format');
        }
        const imageSize = (imageData.length * 0.75);
        if (imageSize > 2 * 1024 * 1024) {
            throw new Error('Image size exceeds 2MB limit');
        }

        let finalProductType = product_type;
        if (is_digital) finalProductType = 'digital';

        const productData = {
            name: name.trim(),
            price: parseFloat(price),
            description: description.trim(),
            image_url: imageData,
            seller_id: sellerId,
            aesthetic,
            is_digital: is_digital || false,
            digital_file_path: digital_file_path || null,
            digital_file_name: digital_file_name || null,
            product_type: finalProductType,
            service_locations: service_locations || null,
            service_options: service_options || null
        };

        const product = await ProductModel.create(null, productData); // Use default pool
        logger.info('Product created:', { id: product.id, sellerId });
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
        const { name, price, description, image_url, aesthetic, status, soldAt } = data;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verify Ownership
            // Model.findById could be used, but we need FOR UPDATE logic maybe?
            // The controller used FOR UPDATE.
            // Let's implement a concise lock check or just trust `UPDATE ... WHERE seller_id=` returns 0 rows if unauthorized.
            // ProductModel.update includes seller_id in WHERE clause.

            const updateFields = {};
            if (name !== undefined) updateFields.name = name;
            if (price !== undefined) updateFields.price = parseFloat(price);
            if (description !== undefined) updateFields.description = description;
            if (image_url !== undefined) updateFields.image_url = image_url;
            if (aesthetic !== undefined) updateFields.aesthetic = aesthetic;

            // Status & SoldAt logic
            // Check columns (Schema aware code from controller)
            const columns = await ProductModel.checkColumns(client, ['sold_at', 'updated_at']);
            const hasSoldAt = columns.includes('sold_at');

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
            return updatedProduct;

        } catch (error) {
            await client.query('ROLLBACK');
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
        return true;
    }
}

export default ProductService;
