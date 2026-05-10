import express from 'express';
import { getPublicTrackingByToken } from '../controllers/tracking.controller.js';
import { publicApiRateLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

router.get('/:token', publicApiRateLimiter, getPublicTrackingByToken);

export default router;
