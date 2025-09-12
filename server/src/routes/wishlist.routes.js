import express from 'express';
import * as wishlistController from '../controllers/wishlist.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes in this file are protected and require a buyer to be logged in
router.use(protect(['buyer']));

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);

export default router;