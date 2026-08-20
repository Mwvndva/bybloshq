import express from 'express';
import { handleUnifiedPaystackWebhook } from '../controllers/paystackWebhook.controller.js';
import { requirePaystackWebhookHmac, verifyPaystackWebhook, webhookRateLimiter } from '../middleware/paystackWebhookSecurity.js';

const router = express.Router();

router.post(
    '/paystack',
    verifyPaystackWebhook,
    webhookRateLimiter,
    requirePaystackWebhookHmac,
    handleUnifiedPaystackWebhook
);

export default router;
