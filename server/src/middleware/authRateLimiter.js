import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

const createAuthLimiter = () => {
    const redisClient = getRedisClient();

    let store;
    try {
        store = new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        });
    } catch (err) {
        logger.warn('[AUTH-LIMITER] Redis store unavailable, using memory store:', err.message);
        store = undefined; // Falls back to in-memory
    }

    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        ...(store ? { store } : {}),
        message: {
            status: 'fail',
            message: 'Too many login attempts, please try again in 15 minutes',
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
                message: 'Too many login attempts, please try again in 15 minutes',
                retryAfter: 900
            });
        },
        skip: (req) => {
            return process.env.NODE_ENV === 'development' &&
                process.env.SKIP_AUTH_RATE_LIMIT === 'true';
        }
    });
};

export const authLimiter = createAuthLimiter();
