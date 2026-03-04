import express from 'express';
import { bondHardware, verifyHardware, redeemSession } from '../controllers/activation.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Activation endpoints
router.post('/bond', protect, bondHardware);
router.post('/verify', protect, verifyHardware);
router.post('/redeem', protect, redeemSession);

export default router;
