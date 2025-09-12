import express from 'express';
import * as buyerController from '../controllers/buyer.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import wishlistRoutes from './wishlist.routes.js';

const router = express.Router();

console.log('Buyer routes loaded successfully');
console.log('Available buyer controller methods:', Object.keys(buyerController));

// Public routes
router.post('/register', buyerController.register);
router.post('/login', buyerController.login);
router.post('/forgot-password', buyerController.forgotPassword);
router.post('/reset-password', buyerController.resetPassword);

// Protected routes
router.use(protect(['buyer']));

router.get('/profile', buyerController.getProfile);
router.patch('/update-profile', buyerController.updateProfile);

// Wishlist routes
router.use('/wishlist', wishlistRoutes);

export default router;
