import express from 'express';
import * as publicController from '../controllers/public.controller.js';
import paymentController from '../../domains/payments/payments/payment.controller.js';
import { getCsrfToken } from '../controllers/csrf.controller.js';
import { publicApiRateLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

// CSRF Protection
router.get('/csrf-token', getCsrfToken);

// Public product routes
router.get('/aesthetics', publicController.getAesthetics);
router.get('/products', publicController.getProducts);
router.get('/products/:id', publicController.getProduct);

// Public seller info
router.get('/sellers/active', publicController.getSellers);
router.post('/sellers/:id/knock', publicApiRateLimiter, publicController.knockSeller);
router.get('/sellers/:id/public', publicController.getSellerPublicInfo);
router.get('/services/:productId/availability', publicController.getServiceAvailability);
router.get('/orders/:id/status', publicController.getOrderStatus);

export default router;
