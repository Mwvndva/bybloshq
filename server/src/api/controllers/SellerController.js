import { container } from '../../container.js';
import { sanitizeSeller, sanitizePublicSeller } from '../../utils/sanitize.js';
import { BaseController } from './BaseController.js';

export class SellerController extends BaseController {
    async getProfile(req, res) {
        return this.handle(req, res, async () => {
            const seller = await container.sellerRepository.findByUserId(req.user.id);
            if (!seller) return this.error(res, 'Seller profile not found', 404);

            return this.success(res, { seller: sanitizeSeller(seller) });
        }, 'getProfile');
    }

    async updateProfile(req, res) {
        return this.handle(req, res, async () => {
            const sellerId = req.user.sellerId;
            const updatedSeller = await container.updateSellerProfile.execute(sellerId, req.body);

            return this.success(res, { seller: sanitizeSeller(updatedSeller) });
        }, 'updateProfile');
    }

    async getSellerByShopName(req, res) {
        return this.handle(req, res, async () => {
            const { shopName } = req.params;
            const seller = await container.sellerRepository.findByShopNameOrSlug(shopName);
            if (!seller) return this.error(res, 'Seller not found', 404);

            return this.success(res, { seller: sanitizePublicSeller(seller) });
        }, 'getSellerByShopName');
    }
}

export const sellerController = new SellerController();
