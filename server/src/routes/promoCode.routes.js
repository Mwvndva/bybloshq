import express from 'express';
import promoCodeController from '../controllers/promoCode.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public route - validate promo code (for ticket purchase)
router.post('/validate', promoCodeController.validate);

// Protected organizer routes
router.use(protect); // All routes below require authentication

// Get all promo codes for an organizer
router.get('/organizer', promoCodeController.getByOrganizer);

// Get promo codes for a specific event
router.get('/event/:eventId', promoCodeController.getByEvent);

// Create promo code
router.post('/', promoCodeController.create);

// Get promo code statistics
router.get('/:id/stats', promoCodeController.getStats);

// Update promo code
router.patch('/:id', promoCodeController.update);

// Delete promo code
router.delete('/:id', promoCodeController.delete);

export default router;

