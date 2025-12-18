import express from 'express';
import * as sellerController from '../controllers/seller.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as orderController from '../controllers/order.controller.js';
import { upload } from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';

import { authLimiter } from '../middleware/authRateLimiter.js';
import { validateSellerRegistration, validateSellerLogin } from '../middleware/sellerValidation.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateSellerRegistration, sellerController.register);
router.post('/login', authLimiter, validateSellerLogin, sellerController.login);
router.post('/forgot-password', sellerController.forgotPassword);
router.post('/reset-password', sellerController.resetPassword);
router.get('/check-shop-name', sellerController.checkShopNameAvailability);
router.get('/shop/:shopName', sellerController.getSellerByShopName);

// Search route - must come before other GET routes to avoid conflicts
router.get('/search', sellerController.searchSellers);

// Public product listing for a specific seller
router.get('/:sellerId/products', sellerController.getSellerProducts);

// Protected routes (require authentication)
router.use(protect);

// Seller profile routes
router.get('/profile', sellerController.getProfile);
router.patch('/profile', sellerController.updateProfile);
router.post('/upload-banner', sellerController.uploadBanner);
router.patch('/theme', sellerController.updateTheme);

// Seller analytics
router.get('/analytics', analyticsController.getSellerAnalytics);

// Seller orders
router.route('/orders')
  .get(orderController.getSellerOrders)  // Get all orders for the current seller
  .post(orderController.createOrder);    // Create a new order

router.route('/orders/:id')
  .get(orderController.getOrderById)     // Get a specific order
  .patch(orderController.updateOrderStatus); // Update order status

// Get seller by ID (protected)
// This must come after other specific routes to avoid conflicts
router.get('/:id(\\d+)', sellerController.getSellerById);

// Product management routes for the authenticated seller
router.route('/products')
  .get(productController.getSellerProducts)  // Get all products for the current seller
  .post(productController.createProduct);    // Create a new product

router.route('/products/:id')
  .get(productController.getProduct)         // Get a single product
  .patch(productController.updateProduct)     // Update a product
  .delete(productController.deleteProduct);   // Delete a product

// Withdrawal request routes
router.post('/withdrawal-request', sellerController.createWithdrawalRequest);
router.get('/withdrawal-requests', sellerController.getWithdrawalRequests);

// Withdrawal route removed - no longer needed since button was removed from frontend

export default router;
