import { createResilientRateLimiter } from './createResilientRateLimiter.js';
import logger from '../../shared/utils/logger.js';

const getDualKey = (req) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
    return `auth:${ip}:${email}`;
};

const RATE_LIMIT_OPTIONS = {
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getDualKey,
    handler: (req, res) => {
        const key = getDualKey(req);
        logger.warn('[RATE-LIMIT] Dual-key auth rate limit exceeded', {
            key,
            ip: req.ip,
            email: req.body?.email,
            path: req.path
        });
        res.status(429).json({
            status: 'fail',
            message: 'Too many login attempts for this IP and account. Please try again in 15 minutes.',
            retryAfter: 900
        });
    },
    skip: () => process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH_RATE_LIMIT === 'true',
};

/**
 * Fail-open progressive auth rate limiter with IP + Email dual key.
 * 5 failed attempts -> 1-minute lock
 * 10+ failed attempts -> 15-minute lock
 *
 * Redis-backed (shared counter across instances) whenever Redis is ready;
 * fails open to an in-memory, per-process counter otherwise -- see
 * createResilientRateLimiter.js for why, and for the alerting this now gets
 * when running on that fallback.
 */
export const authLimiter = createResilientRateLimiter('auth', RATE_LIMIT_OPTIONS);
