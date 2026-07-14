import express from 'express';
import { z } from 'zod';
import logger from '../shared/utils/logger.js';
import * as sellerController from '../controllers/seller.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as orderController from '../controllers/order.controller.js';
import { inviteCreator, listSellerInvites } from '../controllers/creator.controller.js';
import { upload } from '../middleware/upload.js';
import { protect, hasPermission } from '../middleware/auth.js';
import referralRoutes from './referral.routes.js';
import { createWithdrawal, getWithdrawals, getWithdrawalById } from '../controllers/withdrawal.controller.js';
import { AppError } from '../shared/utils/errorHandler.js';
import { softDeleteSeller } from '../models/seller.model.js';

import { authLimiter } from '../middleware/authRateLimiter.js';
import { uploadRateLimiter, withdrawalRateLimiter } from '../middleware/rateLimiting.js';
import { validateSellerRegistration, validateSellerLogin } from '../middleware/sellerValidation.js';
import digitalUpload from '../middleware/digitalUpload.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const requireSellerProfile = (req, res, next) => {
  if (!req.user?.sellerId) {
    return next(new AppError('Seller profile is required for this route.', 403));
  }
  return next();
};

const sellerPickupRequestSchema = z.object({
  mobilePayment: z.string().min(1, 'Mobile payment number is required').optional(),
  phone: z.string().min(1, 'Mobile payment number is required').optional(),
  pickupLocation: z.object({
    address: z.string().optional().nullable(),
    fullAddress: z.string().optional().nullable(),
    full_address: z.string().optional().nullable(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
  }).passthrough().optional(),
  location: z.object({
    address: z.string().optional().nullable(),
    fullAddress: z.string().optional().nullable(),
    full_address: z.string().optional().nullable(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
  }).passthrough().optional(),
  idempotencyKey: z.string().optional().nullable(),
  checkout_token: z.string().optional().nullable(),
}).refine((data) => data.mobilePayment || data.phone, {
  message: 'Mobile payment number is required',
  path: ['mobilePayment']
}).refine((data) => data.pickupLocation || data.location, {
  message: 'Pickup location is required',
  path: ['pickupLocation']
});

// Public routes
router.post('/register', authLimiter, validateSellerRegistration, sellerController.register);
router.post('/login', authLimiter, validateSellerLogin, sellerController.login);
router.post('/forgot-password', authLimiter, sellerController.forgotPassword);
router.post('/reset-password', authLimiter, sellerController.resetPassword);
router.get('/verify-email', sellerController.verifyEmail);
router.post('/resend-verification', authLimiter, sellerController.resendVerification);
router.get('/check-shop-name', sellerController.checkShopNameAvailability);
router.get('/shop/:shopName', sellerController.getSellerByShopName);

// Search route - must come before other GET routes to avoid conflicts
router.get('/search', sellerController.searchSellers);

// Public product listing for a specific seller
router.get('/:sellerId/products', sellerController.getSellerProducts);

router.post('/logout', sellerController.logout);

// Protected routes (require authentication)
router.use(protect);
router.use(requireSellerProfile);

// Seller profile routes
router.get('/profile', sellerController.getProfile);
router.patch('/profile', sellerController.updateProfile);
router.post('/upload-banner', uploadRateLimiter, upload.single('bannerImage'), sellerController.uploadBanner);
router.post('/upload-business-photo', uploadRateLimiter, upload.single('businessPhoto'), sellerController.uploadBusinessPhoto);
router.patch('/theme', sellerController.updateTheme);

// Seller analytics
router.get('/analytics', analyticsController.getSellerAnalytics);

// Seller orders
router.route('/orders')
  .get(orderController.getSellerOrders)  // Get all orders for the current seller
  .post(orderController.createOrder);    // Retired direct order creation endpoint

router.route('/orders/:id')
  .get(orderController.getOrderById)     // Get a specific order
  .patch(orderController.updateOrderStatus); // Update order status

router.post(
  '/orders/:id/request-pickup',
  validate(sellerPickupRequestSchema),
  orderController.requestSellerPickup
);

router.post('/orders/:id/select-hub-dropoff', orderController.selectHubDropoff);
router.post('/orders/:id/mark-dropped-at-hub', orderController.markDroppedAtHub);
router.post('/orders/:id/confirm-booking', orderController.confirmBooking);

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

// Update product inventory
router.patch('/products/:id/inventory', productController.updateInventory);

router.post('/products/upload-digital',
  uploadRateLimiter,
  requireSellerProfile,
  hasPermission('manage-products'),
  digitalUpload.single('digital_file'),
  productController.uploadDigitalFile
);

// Withdrawal requests
router.post('/withdrawal-request', withdrawalRateLimiter, createWithdrawal);
router.get('/withdrawal-requests', getWithdrawals);
router.get('/withdrawal-requests/:id', getWithdrawalById);

// Creator invites
router.get('/creator-invites', listSellerInvites);
router.post('/creator-invites', inviteCreator);

// Referral routes
router.use('/referral', referralRoutes);

// Delete account (Play data-deletion requirement)
router.delete('/account', requireSellerProfile, async (req, res, next) => {
  try {
    await softDeleteSeller(req.user.sellerId, req.user.userId || req.user.id);
    res.clearCookie('token');
    res.status(200).json({ status: 'success', message: 'Your account has been deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;

