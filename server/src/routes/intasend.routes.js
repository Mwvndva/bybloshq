import express from 'express';
import intasendController from '../controllers/intasend.controller.js';
import { body, param } from 'express-validator';
import validate from '../middleware/validation.middleware.js';

const router = express.Router();

// Test IntaSend credentials (simple test)
router.get('/test-credentials', async (req, res) => {
  try {
    if (!process.env.INTASEND_PUBLIC_KEY || !process.env.INTASEND_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'IntaSend credentials not configured',
        error: 'Please set INTASEND_PUBLIC_KEY and INTASEND_SECRET_KEY environment variables'
      });
    }

    // Try to create a minimal IntaSend client
    const IntaSend = (await import('intasend-node')).default;
    const client = new IntaSend(
      process.env.INTASEND_PUBLIC_KEY,
      process.env.INTASEND_SECRET_KEY,
      process.env.NODE_ENV !== 'production'
    );

    res.json({
      success: true,
      message: 'IntaSend credentials are configured',
      config: {
        hasPublicKey: !!process.env.INTASEND_PUBLIC_KEY,
        hasSecretKey: !!process.env.INTASEND_SECRET_KEY,
        baseUrl: process.env.INTASEND_BASE_URL || 'https://sandbox.intasend.com',
        isSandbox: process.env.NODE_ENV !== 'production',
        publicKeyPreview: process.env.INTASEND_PUBLIC_KEY.substring(0, 8) + '...',
        secretKeyPreview: process.env.INTASEND_SECRET_KEY.substring(0, 8) + '...'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error testing IntaSend credentials',
      error: error.message
    });
  }
});

// Initialize IntaSend (test connection)
router.post(
  '/initialize',
  intasendController.initialize
);

// Process checkout with payment collection
router.post(
  '/checkout',
  [
    body('amount').isNumeric().withMessage('Valid amount is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('customer').isObject().withMessage('Customer information is required'),
    body('customer.email').isEmail().withMessage('Valid customer email is required'),
    body('customer.firstName').optional().isString().withMessage('Customer first name must be a string'),
    body('customer.lastName').optional().isString().withMessage('Customer last name must be a string'),
    body('customer.phone').optional().isString().withMessage('Customer phone must be a string'),
    body('productId').optional().isString().withMessage('Product ID must be a string'),
    body('sellerId').optional().isInt().withMessage('Seller ID must be a valid integer'),
    body('items').optional().isArray().withMessage('Items must be an array'),
    validate
  ],
  intasendController.checkout
);

// Create M-Pesa STK Push payment
router.post(
  '/mpesa-stk-push',
  [
    body('amount').isNumeric().withMessage('Valid amount is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('customer').isObject().withMessage('Customer information is required'),
    body('customer.email').isEmail().withMessage('Valid customer email is required'),
    body('phoneNumber').isString().notEmpty().withMessage('Phone number is required'),
    body('productId').optional().isString().withMessage('Product ID must be a string'),
    body('sellerId').optional().isInt().withMessage('Seller ID must be a valid integer'),
    validate
  ],
  intasendController.createMpesaStkPush
);

// Handle IntaSend callback
router.get(
  '/callback',
  [
    param('collection_id').optional().isString(),
    param('status').optional().isString(),
    param('reference').optional().isString(),
    validate
  ],
  intasendController.callback
);

// Handle IntaSend webhook
router.post(
  '/webhook',
  express.json(),
  intasendController.webhook
);

// Check payment status
router.get(
  '/status/:orderId',
  [
    param('orderId').isInt().withMessage('Valid order ID is required'),
    validate
  ],
  intasendController.checkStatus
);

// Test endpoints for debugging
router.get(
  '/test/check-payment/:orderId',
  [
    param('orderId').isInt().withMessage('Valid order ID is required'),
    validate
  ],
  intasendController.checkPaymentStatus
);

router.put(
  '/test/update-status/:orderId',
  [
    param('orderId').isInt().withMessage('Valid order ID is required'),
    body('status').isString().notEmpty().withMessage('Status is required'),
    body('paymentStatus').isString().notEmpty().withMessage('Payment status is required'),
    validate
  ],
  intasendController.updateOrderStatus
);

export default router;
