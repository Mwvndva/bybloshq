import express from 'express';
import { paymentController } from '../controllers/PaymentController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.post('/initiate', protect, (req, res) => paymentController.initiatePayment(req, res));
router.post('/callback', (req, res) => paymentController.handleCallback(req, res));

export default router;
