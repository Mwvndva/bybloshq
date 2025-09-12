import express from 'express';
import * as sellerController from '../controllers/seller.controller.js';
import * as productController from '../controllers/product.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', sellerController.register);
router.post('/login', sellerController.login);
router.post('/forgot-password', sellerController.forgotPassword);
router.post('/reset-password', sellerController.resetPassword);
router.get('/check-shop-name', sellerController.checkShopNameAvailability);
router.get('/shop/:shopName', sellerController.getSellerByShopName);

// Protected routes (require authentication)
router.use(protect);

// Seller profile routes
router.get('/profile', sellerController.getProfile);
router.patch('/profile', sellerController.updateProfile);

// Get seller by ID (protected)
router.get('/:id(\\d+)', sellerController.getSellerById);

// Product routes
router.route('/products')
  .get(productController.getSellerProducts)  // Get all products for the current seller
  .post(productController.createProduct);    // Create a new product

router.route('/products/:id')
  .get(productController.getProduct)         // Get a single product
  .patch(productController.updateProduct)     // Update a product
  .delete(productController.deleteProduct);   // Delete a product

export default router;
