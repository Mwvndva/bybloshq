import express from 'express';
import { handlePaydCallback } from '../controllers/callback.controller.js';
import { verifyPaydWebhook } from '../middleware/paydWebhookSecurity.js';

const router = express.Router();

// Route for Payd callbacks
router.post('/payd', verifyPaydWebhook, handlePaydCallback);

export default router;
