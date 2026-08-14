import express from 'express';
import { refreshToken } from '../controllers/refreshToken.controller.js';
import { authLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

// POST /api/auth/refresh-token
router.post('/refresh-token', authLimiter, refreshToken);

export default router;
