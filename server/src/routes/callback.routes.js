import express from 'express';
import { handlePaystackTransferCallback } from '../controllers/callback.controller.js';
import { requirePaystackWebhookHmac, verifyPaystackWebhook, webhookRateLimiter } from '../middleware/paystackWebhookSecurity.js';

const router = express.Router();

router.post(
    '/paystack-transfer',
    verifyPaystackWebhook,
    webhookRateLimiter,
    requirePaystackWebhookHmac,
    handlePaystackTransferCallback
);

export default router;
