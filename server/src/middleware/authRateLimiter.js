import rateLimit from 'express-rate-limit';

// NOTE: Redis store integration is available but disabled by default
// to prevent application crashes when Redis is not running.
// To enable Redis-backed rate limiting:
// 1. Ensure Redis is running (sudo systemctl start redis-server)
// 2. Uncomment the Redis store configuration below
// 3. Restart the application

import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';

const redisClient = getRedisClient();
const store = new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Reduced from 10 to match rateLimiting.js
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: {
        status: 'fail',
        message: 'Too many login attempts, please try again in 15 minutes',
    },
    keyGenerator: (req) => {
        // Use IP + email for precise tracking
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
            message: 'Too many login attempts, please try again in 15 minutes',
            retryAfter: 900
        });
    }
});
