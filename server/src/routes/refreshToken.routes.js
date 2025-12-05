import express from 'express';
import { refreshToken } from '../controllers/refreshToken.controller.js';

const router = express.Router();

// POST /api/auth/refresh-token
router.post('/refresh-token', refreshToken);

export default router;
