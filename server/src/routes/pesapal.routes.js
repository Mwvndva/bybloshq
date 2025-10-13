import express from 'express';
import pesapalController from '../controllers/pesapal.controller.js';
import { body, param } from 'express-validator';
import validate from '../middleware/validation.middleware.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Pesapal routes are working!' });
});

// Initialize Pesapal (register IPN)
router.post(
  '/initialize',
  pesapalController.initialize
);

// Process checkout
router.post(
  '/checkout',
  [
    body('amount').isNumeric().withMessage('Valid amount is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('customer').isObject().withMessage('Customer information is required'),
    body('customer.email').isEmail().withMessage('Valid customer email is required'),
    body('productId').optional().isString().withMessage('Product ID must be a string'),
    validate
  ],
  pesapalController.checkout
);

// Handle Pesapal callback
router.get(
  '/callback',
  [
    param('OrderTrackingId').optional().isString(),
    param('OrderMerchantReference').optional().isString(),
    validate
  ],
  pesapalController.callback
);

// Handle Pesapal IPN (Instant Payment Notification)
router.post(
  '/ipn',
  express.json(),
  pesapalController.ipnHandler
);

// Check order status
router.get(
  '/status/:orderId',
  [
    param('orderId').isInt().withMessage('Valid order ID is required'),
    validate
  ],
  pesapalController.checkStatus
);

export default router;
