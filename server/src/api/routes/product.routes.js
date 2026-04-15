import express from 'express';
import { productController } from '../controllers/ProductController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.get('/', protect, (req, res) => productController.getSellerProducts(req, res));
router.get('/:id', (req, res) => productController.getProduct(req, res));

export default router;
