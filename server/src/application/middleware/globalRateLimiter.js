import { createResilientRateLimiter } from './createResilientRateLimiter.js';

const GLOBAL_LIMIT_OPTIONS = {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again in an hour!',
};

/**
 * Fail-open global limiter. A Redis outage must never take down the API:
 * Redis-backed (shared counter across instances) whenever Redis is ready;
 * fails open to an in-memory, per-process counter otherwise -- see
 * createResilientRateLimiter.js for why, and for the alerting this now gets
 * when running on that fallback.
 */
export const globalLimiter = createResilientRateLimiter('global', GLOBAL_LIMIT_OPTIONS);

export default globalLimiter;
