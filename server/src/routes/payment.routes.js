import express from 'express';
import { body, param } from 'express-validator';
import paymentController from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validation.middleware.js';

const router = express.Router();

// Public routes (no authentication required)
const publicRouter = express.Router();

// Payment initiation (public)
publicRouter.post(
  '/initiate',
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('amount').isNumeric().withMessage('Valid amount is required'),
    body('ticketId').isInt().withMessage('Valid ticket ID is required'),
    body('eventId').isInt().withMessage('Valid event ID is required'),
    validate
  ],
  paymentController.initiatePayment
);

// Webhook endpoint (public)
publicRouter.post(
  '/webhook',
  // Parse JSON body
  express.json(),
  
  // Log the incoming request
  (req, res, next) => {
    console.log('Webhook received:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    });
    next();
  },
  
  // Handle the webhook
  async (req, res) => {
    try {
      // Basic validation
      if (!req.body) {
        console.error('No body received');
        return res.status(400).json({
          success: false,
          error: 'No request body received'
        });
      }
      
      // Process the webhook
      await paymentController.handleWebhook(req, res);
      
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

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
router.use(protectedRouter);

export default router;
