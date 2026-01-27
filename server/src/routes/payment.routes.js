import express from 'express';
import { body, param } from 'express-validator';
import paymentController from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.js';
import { verifyPaydWebhook } from '../middleware/paydWebhookSecurity.js';
import validate from '../middleware/validation.middleware.js';
import paymentRequestLogger from '../middleware/payment-logger.middleware.js';

const router = express.Router();

// Public routes (no authentication required)
const publicRouter = express.Router();

// Apply payment logger to all public routes
publicRouter.use(paymentRequestLogger);

// Payment initiation (public)
publicRouter.post(
  '/initiate',
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('amount').isNumeric().withMessage('Valid amount is required'),
    body('ticketId').isInt().withMessage('Valid ticket ID is required'),
    body('eventId').isInt().withMessage('Valid event ID is required'),
    validate
  ],
  paymentController.initiatePayment
);

// Product payment initiation (public) — same flow as tickets, but for products
publicRouter.post(
  '/initiate-product',
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    // Email is optional here because authenticated users might not send it (we fallback to DB)
    // However, if provided, it must be valid.
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('amount').isNumeric().withMessage('Valid amount is required'),
    body('productId').notEmpty().withMessage('Product ID is required'),
    // Optional metadata
    body('sellerId').optional(),
    body('productName').optional(),
    body('customerName').optional(),
    body('narrative').optional(),
    body('paymentMethod').optional().isIn(['paystack', 'payd']).withMessage('Invalid payment method'),
    validate
  ],
  paymentController.initiateProductPayment
);

// Webhook endpoint (public) - Paystack
publicRouter.post(
  '/webhook/payd',
  express.json(),
  verifyPaydWebhook,
  paymentController.handlePaydWebhook // Updated method name
);

// Test webhook endpoint (for development)
publicRouter.post(
  '/webhook/test',
  express.json(),
  paymentController.testWebhook
);

// Paystack callback endpoint (public) - Legacy support
// Paystack callback endpoint (public) - Legacy support
// publicRouter.post(
//   '/paystack/callback',
//   express.json(),
//   paymentController.handlePaydWebhook // Was handlePaystackWebhook, commented out as we migrated
// );

// Check payment status (public)
publicRouter.get(
  '/status/:invoiceId',
  [
    param('invoiceId').notEmpty().withMessage('Invoice ID is required'),
    validate
  ],
  (req, res, next) => {
    // Map invoiceId to paymentId for backward compatibility
    req.params.paymentId = req.params.invoiceId;
    paymentController.checkStatus(req, res, next);
  }
);

// Mount public routes
router.use(publicRouter);

// Protected routes (require authentication)
const protectedRouter = express.Router();
protectedRouter.use(protect);

// Add protected payment routes here if needed

// Mount protected routes
// Note: No protected payment routes at the moment. Keep public endpoints open for checkout + webhooks.
// router.use(protectedRouter);

export default router;
