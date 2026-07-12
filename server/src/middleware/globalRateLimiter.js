import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import logger from '../shared/utils/logger.js';

const GLOBAL_LIMIT_OPTIONS = {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again in an hour!',
};

// Always-available in-memory limiter (no external dependency).
const memoryLimiter = rateLimit({ ...GLOBAL_LIMIT_OPTIONS });

// Redis-backed limiter sharing one counter across all instances, so N pods do
// not each hand out the full quota. Only used while the Redis client is ready.
const redisLimiter = rateLimit({
    ...GLOBAL_LIMIT_OPTIONS,
    store: new RedisStore({
        prefix: 'grl:',
        sendCommand: (...args) => getRedisClient().call(...args),
    }),
});

// Fail-open global limiter. A Redis outage must never take down the API: use
// Redis only while the client is ready, and if a Redis command fails mid-request
// fall back to the in-memory limiter instead of surfacing an error. Mirrors the
// auth limiter (see middleware/authRateLimiter.js).
export const globalLimiter = (req, res, next) => {
    const client = getRedisClient();
    const redisReady = Boolean(client) && client.status === 'ready';

    if (!redisReady) {
        return memoryLimiter(req, res, next);
    }

    return redisLimiter(req, res, (err) => {
        if (err) {
            logger.warn('[GLOBAL-LIMITER] Redis limiter failed, failing open to in-memory store:', err?.message);
            return memoryLimiter(req, res, next);
        }
        return next();
    });
};

export default globalLimiter;
