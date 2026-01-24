import rateLimit from 'express-rate-limit';

// NOTE: Redis store integration is available but disabled by default
// to prevent application crashes when Redis is not running.
// To enable Redis-backed rate limiting:
// 1. Ensure Redis is running (sudo systemctl start redis-server)
// 2. Uncomment the Redis store configuration below
// 3. Restart the application

/*
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';

const redisClient = getRedisClient();
const store = new RedisStore({
  sendCommand: (...args) => redisClient.call(...args),
});
*/

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // store: store, // Uncomment to use Redis store
    message: {
        status: 'fail',
        message: 'Too many login attempts, please try again in 15 minutes',
    },
    keyGenerator: (req) => {
        return req.ip;
    },
});
