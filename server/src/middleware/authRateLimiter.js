import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import logger from '../shared/utils/logger.js';

const RATE_LIMIT_OPTIONS = {
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Too many login attempts, please try again in 5 minutes',
    },
    keyGenerator: (req) => {
        const email = req.body?.email || '';
        return `auth:${req.ip}:${email}`;
    },
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Auth rate limit exceeded', {
            ip: req.ip,
            email: req.body?.email,
            path: req.path
        });
        res.status(429).json({
            status: 'fail',
            message: 'Too many login attempts, please try again in 5 minutes',
            retryAfter: 300
        });
    },
    skip: () => process.env.NODE_ENV === 'development' &&
        process.env.SKIP_AUTH_RATE_LIMIT === 'true',
};

// Always-available in-memory limiter (no external dependency).
const memoryLimiter = rateLimit({ ...RATE_LIMIT_OPTIONS });

// Redis-backed limiter for a shared counter across instances. Only used while
// the Redis client is connected (see authLimiter below).
const redisLimiter = rateLimit({
    ...RATE_LIMIT_OPTIONS,
    store: new RedisStore({
        sendCommand: (...args) => getRedisClient().call(...args),
    }),
});

// Fail-open auth limiter. A Redis outage must never take down authentication:
// previously a closed Redis connection made every login throw
// "Connection is closed" -> 500. Use Redis only while the client is ready, and
// if a Redis command still fails mid-request, fall back to the in-memory
// limiter instead of surfacing an error.
export const authLimiter = (req, res, next) => {
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

