import express from 'express';
import * as buyerController from '../controllers/buyer.controller.js';
import { protect, hasPermission } from '../middleware/auth.js';
import AppError from '../utils/appError.js';
import wishlistRoutes from './wishlist.routes.js';
import { validateRegistration, validateLogin } from '../middleware/authValidation.js';
import { authLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

console.log('Buyer routes loaded');

// Public routes
router.post('/register', authLimiter, validateRegistration, buyerController.register);
router.post('/login', authLimiter, validateLogin, buyerController.login);
router.post('/forgot-password', buyerController.forgotPassword);
router.post('/reset-password', buyerController.resetPassword);
router.post('/check-phone', buyerController.checkBuyerByPhone);
router.post('/save-info', buyerController.saveBuyerInfo);

// Protected routes - require buyer authentication
router.use(protect);
router.use(hasPermission('manage-profile'));

// Get current buyer's profile
router.get('/profile', buyerController.getProfile);

// Update profile
router.patch('/update-profile', buyerController.updateProfile);

// Request refund withdrawal
router.post('/refund-request', buyerController.requestRefund);

// Get pending refund requests
router.get('/refund-requests/pending', buyerController.getPendingRefundRequests);

// Mark order as collected
router.post('/orders/:orderId/collected', buyerController.markOrderAsCollected);

import * as sellerController from '../controllers/seller.controller.js';

// Wishlist routes
router.use('/wishlist', wishlistRoutes);

// Become a client of a seller
router.post('/sellers/:sellerId/become-client', sellerController.handleBecomeClient);

// Leave a seller's clientele
router.post('/sellers/:sellerId/leave-client', sellerController.handleLeaveClient);





export default router;

