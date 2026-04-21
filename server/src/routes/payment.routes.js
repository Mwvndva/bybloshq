import express from 'express';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import paymentController from '../controllers/payment.controller.js';
import { protect, hasPermission } from '../middleware/auth.js';
import { verifyPaydWebhook } from '../middleware/paydWebhookSecurity.js';
import paymentRequestLogger from '../middleware/payment-logger.middleware.js';
import { paymentRateLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

const initiateProductSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  amount: z.coerce.number().positive('Valid amount is required'),
  productId: z.coerce.string().min(1, 'Product ID is required'),
  sellerId: z.coerce.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  narrative: z.string().optional().nullable(),
  paymentMethod: z.enum(['paystack', 'payd']).optional(),
  // PIN-12: PERSISTENCE SHIELD (Do not strip these fields)
  buyerLocation: z.any().optional(),
  metadata: z.any().optional(),
});

const checkStatusSchema = z.object({
  invoiceId: z.coerce.string().min(1, 'Invoice ID is required'),
});

// Public routes (no authentication required)
const publicRouter = express.Router();

// Apply payment logger to all public routes
publicRouter.use(paymentRequestLogger);


// Product payment initiation (public) — same flow as tickets, but for products
publicRouter.post(
  '/initiate-product',
  paymentRateLimiter,
  validate(initiateProductSchema),
  paymentController.initiateProductPayment
);

// Webhook endpoint (public) - Paystack
publicRouter.post(
  '/webhook/payd',
  verifyPaydWebhook,
  paymentController.handlePaydWebhook // Updated method name
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
  validate(checkStatusSchema),
  (req, res, next) => {
    // Map invoiceId to paymentId for backward compatibility
    req.params.paymentId = req.params.invoiceId;
    paymentController.checkStatus(req, res, next);
  }
);

// Mount public routes
router.use(publicRouter);

// Mount protected routes
const protectedRouter = express.Router();
protectedRouter.use(protect);

// Add health check routes (admin only)
protectedRouter.get('/health/payd-agent',
  hasPermission('manage-all'),
  paymentController.getAgentStatus
);

protectedRouter.post('/health/payd-agent/reset',
  hasPermission('manage-all'),
  paymentController.resetAgent
);

protectedRouter.get('/health/network',
  hasPermission('manage-all'),
  paymentController.checkNetwork
);

router.use(protectedRouter);

export default router;
