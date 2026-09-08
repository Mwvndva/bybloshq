import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../shared/config/redis.js';
import logger from '../../shared/utils/logger.js';

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
// not each hand out the full quota. Built lazily on first use (see
// getRedisLimiter below) rather than at module load — RedisStore's constructor
// issues a command immediately to load its Lua scripts, and building it eagerly
// meant a Redis outage at boot (or NODE_ENV=test's enableOfflineQueue:false)
// threw an unhandled rejection that crashed the whole process, defeating the
// fail-open design this middleware is supposed to provide.
let redisLimiter = null;

function getRedisLimiter() {
    if (redisLimiter) return redisLimiter;
    try {
        redisLimiter = rateLimit({
            ...GLOBAL_LIMIT_OPTIONS,
            store: new RedisStore({
                prefix: 'grl:',
                sendCommand: (...args) => getRedisClient().call(...args),
            }),
        });
    } catch (err) {
        logger.warn('[GLOBAL-LIMITER] Failed to build Redis-backed limiter, staying on in-memory store:', err?.message);
        return null;
    }
    return redisLimiter;
}

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

    const limiter = getRedisLimiter();
    if (!limiter) {
        return memoryLimiter(req, res, next);
    }

    return limiter(req, res, (err) => {
        if (err) {
            logger.warn('[GLOBAL-LIMITER] Redis limiter failed, failing open to in-memory store:', err?.message);
            return memoryLimiter(req, res, next);
        }
        return next();
    });
};

export default globalLimiter;
