import express from 'express';
import { body } from 'express-validator';
import DiscountCodeController from '../controllers/discountCode.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const createDiscountCodeValidation = [
  body('event_id').isInt({ min: 1 }).withMessage('Valid event ID is required'),
  body('code')
    .isLength({ min: 3, max: 50 })
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('Code must be 3-50 characters, uppercase letters, numbers, hyphens, or underscores only'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('discount_type').isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discount_value').isFloat({ min: 0.01 }).withMessage('Discount value must be greater than 0'),
  body('min_order_amount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be non-negative'),
  body('max_discount_amount').optional().isFloat({ min: 0 }).withMessage('Maximum discount amount must be positive'),
  body('usage_limit').optional().isInt({ min: 1 }).withMessage('Usage limit must be at least 1'),
  body('valid_from').optional().isISO8601().withMessage('Valid from date must be a valid date'),
  body('valid_until').optional().isISO8601().withMessage('Valid until date must be a valid date')
];

const updateDiscountCodeValidation = [
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('discount_type').optional().isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discount_value').optional().isFloat({ min: 0.01 }).withMessage('Discount value must be greater than 0'),
  body('min_order_amount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be non-negative'),
  body('max_discount_amount').optional().isFloat({ min: 0 }).withMessage('Maximum discount amount must be positive'),
  body('usage_limit').optional().isInt({ min: 1 }).withMessage('Usage limit must be at least 1'),
  body('valid_from').optional().isISO8601().withMessage('Valid from date must be a valid date'),
  body('valid_until').optional().isISO8601().withMessage('Valid until date must be a valid date'),
  body('is_active').optional().isBoolean().withMessage('Is active must be a boolean')
];

const validateDiscountCodeValidation = [
  body('code').notEmpty().withMessage('Discount code is required'),
  body('order_amount').optional().isFloat({ min: 0 }).withMessage('Order amount must be non-negative')
];

// Public route for validating discount codes (no authentication required)
router.post('/validate', validateDiscountCodeValidation, DiscountCodeController.validateDiscountCode);

// Protected routes (require organizer authentication) - applied after the public validate route
router.use(protect);

// Create discount code
router.post('/', createDiscountCodeValidation, DiscountCodeController.createDiscountCode);

// Get all discount codes for an event
router.get('/event/:eventId', DiscountCodeController.getEventDiscountCodes);

// Get single discount code
router.get('/:id', DiscountCodeController.getDiscountCode);

// Update discount code
router.put('/:id', updateDiscountCodeValidation, DiscountCodeController.updateDiscountCode);

// Delete discount code
router.delete('/:id', DiscountCodeController.deleteDiscountCode);

// Internal route for recording discount usage (should be called during ticket purchase)
router.post('/usage', DiscountCodeController.recordDiscountUsage);

export default router;
