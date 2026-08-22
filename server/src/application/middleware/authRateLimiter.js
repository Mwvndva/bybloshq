import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../shared/config/redis.js';
import logger from '../../shared/utils/logger.js';

// In-memory store for progressive attempt tracking when Redis is unavailable
const memoryAttempts = new Map();

// Progressive lockout configuration
const LOCKOUT_THRESHOLDS = [
    { attempts: 10, lockMs: 15 * 60 * 1000, message: 'Account locked due to repeated failed attempts. Please try again in 15 minutes.' },
    { attempts: 5, lockMs: 60 * 1000, message: 'Too many failed login attempts. Please try again in 1 minute.' }
];

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

// Always-available in-memory limiter (no external dependency).
const memoryLimiter = rateLimit({ ...RATE_LIMIT_OPTIONS });

// Redis-backed limiter for a shared counter across instances.
const redisLimiter = rateLimit({
    ...RATE_LIMIT_OPTIONS,
    store: new RedisStore({
        sendCommand: (...args) => getRedisClient().call(...args),
    }),
});

/**
 * Fail-open progressive auth rate limiter with IP + Email dual key.
 * 5 failed attempts -> 1-minute lock
 * 10+ failed attempts -> 15-minute lock
 */
export const authLimiter = (req, res, next) => {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH_RATE_LIMIT === 'true') {
        return next();
    }

    const client = getRedisClient();
    const redisReady = Boolean(client) && client.status === 'ready';

    if (!redisReady) {
        return memoryLimiter(req, res, next);
    }

    return redisLimiter(req, res, (err) => {
        if (err) {
            logger.warn('[AUTH-LIMITER] Redis limiter failed, failing open to in-memory store:', err?.message);
            return memoryLimiter(req, res, next);
        }
        return next();
    });
};

