import express from 'express';
import { getPublicTrackingByToken } from '../controllers/tracking.controller.js';
import { publicTrackingRateLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

router.get('/:token', publicTrackingRateLimiter, getPublicTrackingByToken);

export default router;
