import express from 'express';
import { getSellerOrders, updateOrderStatus, markOrderAsDelivered } from '../controllers/sellerOrderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.use(protect);

// Get all orders for the authenticated seller
router.get('/', getSellerOrders);

// Update order status
router.patch('/:orderId/status', updateOrderStatus);

// Mark order as delivered
router.post('/:orderId/delivered', markOrderAsDelivered);

export default router;
