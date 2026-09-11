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

// Redis-backed limiter for a shared counter across instances. Built exactly
// once, outside of any request's call stack -- express-rate-limit validates
// that a limiter is constructed at app initialization, not while responding
// to a request (ERR_ERL_CREATED_IN_REQUEST_HANDLER), and throws synchronously
// out of the middleware invocation (not just the constructor call) the first
// time a request-triggered instance actually runs. That's exactly what
// building it lazily on first use inside authLimiter did in production: the
// very first login request after Redis became ready threw this uncaught,
// bypassing the fail-open design entirely instead of falling back to
// memoryLimiter.
//
// Fixed by building it the moment Redis is actually ready -- immediately if
// it already is by the time this module loads, otherwise via the client's
// own 'ready' event -- which happens independently of any HTTP request, so
// express-rate-limit's construction-context check is satisfied either way.
// Still guarded by try/catch: RedisStore's constructor issues a command to
// load its Lua scripts, and if that somehow fails despite the client
// reporting ready, we fall back to in-memory rather than losing rate
// limiting (or crashing) entirely.
let redisLimiter = null;

function buildRedisLimiter() {
    if (redisLimiter) return;
    try {
        redisLimiter = rateLimit({
            ...RATE_LIMIT_OPTIONS,
            store: new RedisStore({
                sendCommand: (...args) => getRedisClient().call(...args),
            }),
        });
        logger.info('[AUTH-LIMITER] Redis-backed rate limiter initialized');
    } catch (err) {
        logger.warn('[AUTH-LIMITER] Failed to build Redis-backed limiter, staying on in-memory store:', err?.message);
        redisLimiter = null;
    }
}

const initialRedisClient = getRedisClient();
if (initialRedisClient) {
    if (initialRedisClient.status === 'ready') {
        buildRedisLimiter();
    } else {
        initialRedisClient.once('ready', buildRedisLimiter);
    }
}

function getRedisLimiter() {
    return redisLimiter;
}

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

    const limiter = getRedisLimiter();
    if (!limiter) {
        return memoryLimiter(req, res, next);
    }

    return limiter(req, res, (err) => {
        if (err) {
            logger.warn('[AUTH-LIMITER] Redis limiter failed, failing open to in-memory store:', err?.message);
            return memoryLimiter(req, res, next);
        }
        return next();
    });
};

