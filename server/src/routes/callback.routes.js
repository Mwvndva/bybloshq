import express from 'express';
import { handlePaydPayoutCallback } from '../controllers/callback.controller.js';
import { verifyPaydWebhook } from '../middleware/paydWebhookSecurity.js';

const router = express.Router();

// Payout (withdrawal) webhook — called by Payd after M-Pesa payout resolves
router.post('/payd-payout', verifyPaydWebhook, handlePaydPayoutCallback);

// NOTE: Payment (STK push) callbacks are handled at /api/payments/webhook/payd
// DO NOT route payment callbacks here

export default router;
