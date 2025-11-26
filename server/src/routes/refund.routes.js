import express from 'express';
import * as refundController from '../controllers/refund.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All refund management routes require admin authentication
router.use(protect(['admin']));

// Get all refund requests
router.get('/', refundController.getAllRefundRequests);

// Get specific refund request
router.get('/:id', refundController.getRefundRequestById);

// Confirm/Complete refund request (deducts from buyer)
router.patch('/:id/confirm', refundController.confirmRefundRequest);

// Reject refund request
router.patch('/:id/reject', refundController.rejectRefundRequest);

export default router;

