import { container } from '../../container.js';
import { sanitizeProduct } from '../../utils/sanitize.js';
import { BaseController } from './BaseController.js';

export class ProductController extends BaseController {
    async getSellerProducts(req, res) {
        return this.handle(req, res, async () => {
            const sellerId = req.user.sellerId;
            const products = await container.productRepository.findBySellerId(sellerId);
            const sanitized = products.map(p => sanitizeProduct(p));

            return this.success(res, { products: sanitized }, 200, { results: sanitized.length });
        }, 'getSellerProducts');
    }

    async getProduct(req, res) {
        return this.handle(req, res, async () => {
            const { id } = req.params;
            const product = await container.productRepository.findById(id);
            if (!product) return this.error(res, 'Product not found', 404);

            return this.success(res, { product: sanitizeProduct(product) });
        }, 'getProduct');
    }
}

export const productController = new ProductController();
