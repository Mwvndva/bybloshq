import express from 'express';
import { refreshToken } from '../controllers/refreshToken.controller.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import { verifyToken } from '../../shared/utils/jwt.js';

const router = express.Router();

// POST /api/auth/refresh-token
router.post('/refresh-token', authLimiter, refreshToken);

// POST /api/auth/revoke-token — Revoke active/previous JWT sessions on server (e.g. during role-switch)
router.post('/revoke-token', async (req, res) => {
  const tokens = [];
  if (req.body?.token && typeof req.body.token === 'string') {
    tokens.push(req.body.token);
  }
  if (Array.isArray(req.body?.tokens)) {
    for (const t of req.body.tokens) {
      if (t && typeof t === 'string') tokens.push(t);
    }
  }
  if (tokens.length === 0 && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    tokens.push(req.headers.authorization.replace('Bearer ', '').trim());
  }

  try {
    const tokenBlacklist = (await import('../../domains/identity/tokens/tokenBlacklist.service.js')).default;
    for (const t of tokens) {
      try {
        const decoded = verifyToken(t);
        if (decoded && decoded.exp) {
          await tokenBlacklist.addToken(t, decoded.exp);
        }
      } catch {
        // Token already invalid/expired or malformed — ignore
      }
    }
  } catch {
    // Graceful error handling
  }

  return res.status(200).json({ status: 'success', message: 'Token(s) revoked' });
});

export default router;
