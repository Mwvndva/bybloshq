import express from 'express';
import { bondHardware, verifyHardware } from '../controllers/activation.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Activation endpoints
// Use protect if you want to ensure only the buyer can activate, 
// though hardware locking already provides security.
// For now, let's protect it to be safe.
router.post('/bond', protect, bondHardware);
router.post('/verify', protect, verifyHardware);

export default router;
