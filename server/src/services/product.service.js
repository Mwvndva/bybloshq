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
                } catch (e) {
                    throw new Error(e.message.includes('Internal addresses') ? e.message : 'Invalid remote image URL format.');
                }
            }

            if (!isBase64 && !isLocal && !isRemote) {
                throw new Error('Invalid image format. Expected base64, local path, or remote URL.');
            }

            if (isBase64) {
                const imageSize = (imageData.length * 0.75);
                if (imageSize > 5 * 1024 * 1024) {
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

        if (typeof productData.images !== 'string') {
            productData.images = JSON.stringify(productData.images || []);
        }

        const product = await ProductModel.create(null, productData);
        logger.info('Product created:', { id: product.id, sellerId });

        await cacheService.clearPattern("products:*");

        return product;
    }

    static async getSellerProducts(sellerId) {
        const products = await ProductModel.findBySellerId(sellerId);
        return products.map(p => ({
            ...p,
            status: p.status || 'published',
            soldAt: p.sold_at || null
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

            const updateFields = {};
            if (name !== undefined) updateFields.name = name;
            if (price !== undefined) updateFields.price = Number.parseFloat(price);
            if (description !== undefined) updateFields.description = description;
            if (image_url !== undefined) updateFields.image_url = image_url;
            if (images !== undefined) {
                updateFields.images = Array.isArray(images) ? JSON.stringify(images) : images;
            }
            if (aesthetic !== undefined) updateFields.aesthetic = aesthetic;

            if (soldAt !== undefined) {
                updateFields.sold_at = soldAt;
                updateFields.status = soldAt ? 'sold' : 'available';
            } else if (status) {
                updateFields.status = status;
            }

            const updatedProduct = await ProductModel.update(client, productId, sellerId, updateFields);

            if (!updatedProduct) {
                const exists = await ProductModel.findById(productId);
                if (!exists) throw new Error('Product not found');
                if (exists.seller_id !== sellerId) throw new Error('Unauthorized');
                throw new Error('Update failed');
            }

            await client.query('COMMIT');
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
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const updatedProduct = await ProductModel.updateInventory(client, productId, inventoryData);

            if (!updatedProduct) {
                throw new Error('Product not found');
            }

            await client.query('COMMIT');
            logger.info(`[INVENTORY] Updated inventory for product ${productId}`, inventoryData);

            return updatedProduct;

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

        await cacheService.clearPattern("products:*");

        return true;
    }
}

export default ProductService;

