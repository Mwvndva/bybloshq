import express from 'express';
import * as buyerController from '../controllers/buyer.controller.js';
import * as orderController from '../controllers/orderController.js';
import { protect } from '../middleware/auth.middleware.js';
import AppError from '../utils/appError.js';
import wishlistRoutes from './wishlist.routes.js';

const router = express.Router();

console.log('Buyer routes loaded successfully');
console.log('Available buyer controller methods:', Object.keys(buyerController));

// Public routes
router.post('/register', buyerController.register);
router.post('/login', buyerController.login);
router.post('/forgot-password', buyerController.forgotPassword);
router.post('/reset-password', buyerController.resetPassword);

// Protected routes - require buyer authentication
router.use(protect(['buyer']));

// Get current buyer's profile
router.get('/profile', buyerController.getProfile);

// Update profile
router.patch('/update-profile', buyerController.updateProfile);

// Wishlist routes
router.use('/wishlist', wishlistRoutes);

// Order routes
router.get('/orders', (req, res, next) => {
  console.log('GET /buyers/orders route hit');
  console.log('Request URL:', req.originalUrl);
  console.log('Request method:', req.method);
  console.log('Request headers:', req.headers);
  next();
}, orderController.getBuyerOrders);

// Log all registered routes
console.log('Registered buyer routes:');
router.stack.forEach(layer => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).filter(method => layer.route.methods[method]);
    console.log(`${methods.join(', ').toUpperCase()} /api/buyers${layer.route.path}`);
  }
});

export default router;

