import express from 'express';
import { sellerController } from '../controllers/SellerController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.get('/shop/:shopName', (req, res) => sellerController.getSellerByShopName(req, res));
router.get('/profile', protect, (req, res) => sellerController.getProfile(req, res));
router.patch('/profile', protect, (req, res) => sellerController.updateProfile(req, res));

export default router;
