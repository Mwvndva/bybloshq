import express from 'express';
import * as publicController from '../controllers/public.controller.js';
import paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Public product routes
router.get('/aesthetics', publicController.getAesthetics);
router.get('/products', publicController.getProducts);
router.get('/products/:id', publicController.getProduct);

// Public seller info
router.get('/sellers/active', publicController.getSellers);
router.get('/sellers/:id/public', publicController.getSellerPublicInfo);

export default router;
