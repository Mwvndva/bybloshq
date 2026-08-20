import { validate } from '../middleware/validate.js';
import * as V from '../../shared/validations/buyer.validation.js';
import express from 'express';
import * as buyerController from '../../domains/commerce/buyers/buyer.controller.js';
import * as membershipController from '../../domains/growth/membership/membership.controller.js';
import { protect, hasPermission } from '../middleware/auth.js';
import { AppError } from '../../shared/utils/errorHandler.js';
import wishlistRoutes from './wishlist.routes.js';
import { validateRegistration, validateLogin } from '../middleware/authValidation.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import { withdrawalRateLimiter, publicApiRateLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();



// Public routes
router.post('/register', authLimiter, validateRegistration, buyerController.register);
router.post('/login', authLimiter, validateLogin, buyerController.login);
router.post('/forgot-password', authLimiter, validate(V.forgotPassword), buyerController.forgotPassword);
router.post('/reset-password', authLimiter, validate(V.resetPassword), buyerController.resetPassword);
router.get('/verify-email', buyerController.verifyEmail);
router.post('/resend-verification', authLimiter, validate(V.resendVerification), buyerController.resendVerification);
router.post('/check-phone', publicApiRateLimiter, validate(V.checkPhone), buyerController.checkBuyerByPhone);
router.post('/save-info', authLimiter, validate(V.saveInfo), buyerController.saveBuyerInfo);
router.post('/auto-login', publicApiRateLimiter, validate(V.autoLogin), buyerController.autoLogin);
router.post('/logout', buyerController.logout);

// Protected routes - require buyer authentication
router.use(protect);
router.use(hasPermission('manage-profile'));

// Get current buyer's profile
router.get('/profile', buyerController.getProfile);

// Update profile
router.patch('/update-profile', validate(V.updateProfile), buyerController.updateProfile);

// Byblos membership card — status + opt-in (mints the membership number)
router.get('/membership', membershipController.getMembership);
router.post('/membership/join', membershipController.joinMembership);

// Request refund withdrawal
router.post('/refund-request', withdrawalRateLimiter, validate(V.refundRequest), buyerController.requestRefund);

// Get pending refund requests
router.get('/refund-requests/pending', buyerController.getPendingRefundRequests);

// Mark order as collected
router.post('/orders/:orderId/collected', validate(V.orderCollected), buyerController.markOrderAsCollected);

import * as sellerController from '../../domains/commerce/sellers/seller.controller.js';

// Wishlist routes
router.use('/wishlist', wishlistRoutes);

// Get followed shops
router.get('/shops', sellerController.getBuyerShops);

// Follow a seller
router.post('/sellers/:sellerId/become-client', validate(V.becomeClient), sellerController.handleBecomeClient);

// Unfollow a seller
router.post('/sellers/:sellerId/leave-client', validate(V.leaveClient), sellerController.handleLeaveClient);





// Delete account (Play data-deletion requirement)
router.delete('/account', buyerController.deleteAccount);

export default router;


