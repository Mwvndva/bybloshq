import { validate } from '../middleware/validate.js';
import * as V from '../validations/wishlist.validation.js';
import express from 'express';
import * as wishlistController from '../controllers/wishlist.controller.js';
import { protect, hasPermission } from '../middleware/auth.js';

const router = express.Router();

// All routes in this file are protected and require a buyer to be logged in
router.use(protect);
router.use(hasPermission('manage-profile')); // Wishlist is part of profile management

router.get('/', wishlistController.getWishlist);
router.post('/', validate(V.addToWishlist), wishlistController.addToWishlist);
router.delete('/:productId', validate(V.removeFromWishlist), wishlistController.removeFromWishlist);

export default router;