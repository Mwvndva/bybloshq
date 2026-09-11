import logger from '../../shared/utils/logger.js';
import { createResilientRateLimiter } from './createResilientRateLimiter.js';

/**
 * Granular Rate Limiting Configuration (P1-003)
 *
 * Different endpoints have different rate limit requirements:
 * - Authentication: Strict limits to prevent brute force
 * - Webhooks: Moderate limits (handled in provider webhook security middleware)
 * - Public API: Generous limits for normal usage
 * - Admin: More generous for authenticated admins
 *
 * Every limiter below is built via createResilientRateLimiter: Redis-backed
 * (one shared counter across every instance) whenever Redis is ready, failing
 * open to an in-memory, per-process counter otherwise -- with an alert when
 * that fallback is actually in use. These five used to be built with plain
 * `rateLimit(...)` -- always in-memory, unconditionally, with no relationship
 * to Redis's availability at all. Harmless on today's single instance; would
 * have silently multiplied the effective limit by instance count the moment
 * this API ever ran more than one. See createResilientRateLimiter.js.
 */

// ========================================
// 4. Payment Initiation (MODERATE)
// ========================================
export const paymentRateLimiter = createResilientRateLimiter('payment', {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 payment initiations per 5 minutes
    message: {
        status: 'error',
        message: 'Too many payment requests. Please wait a moment before trying again.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        const userId = req.user?.id || req.user?.userId;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Payment initiation rate limit exceeded', {
            ip: req.ip,
            userId: req.user?.id,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many payment requests. Please wait before initiating another payment.',
            retryAfter: 300
        });
    }
});

// ========================================
// 5. Withdrawal Requests (MODERATE)
// ========================================
export const withdrawalRateLimiter = createResilientRateLimiter('withdrawal', {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 withdrawal requests per hour
    message: {
        status: 'error',
        message: 'Too many withdrawal requests. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?.id || req.user?.userId;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Withdrawal rate limit exceeded', {
            ip: req.ip,
            userId: req.user?.id,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many withdrawal requests. Please wait before requesting another withdrawal.',
            retryAfter: 3600
        });
    }
});

// ========================================
// 6. Public API (GENEROUS)
// ========================================
export const publicApiRateLimiter = createResilientRateLimiter('public-api', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
        status: 'error',
        message: 'Too many requests. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Public API rate limit exceeded', {
            ip: req.ip,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 900
        });
    }
});

// ========================================
// 7. Public Tracking (60 req/min)
// ========================================
export const publicTrackingRateLimiter = createResilientRateLimiter('public-tracking', {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
        status: 'error',
        message: 'Too many tracking requests. Please wait a moment before trying again.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Public tracking link rate limit exceeded', {
            ip: req.ip,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many tracking link requests. Please wait a moment.',
            retryAfter: 60
        });
    }
});

// ========================================
// 8. File Upload (STRICT)
// ========================================
export const uploadRateLimiter = createResilientRateLimiter('upload', {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: {
        status: 'error',
        message: 'Too many file uploads. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?.id || req.user?.userId;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] File upload rate limit exceeded', {
            ip: req.ip,
            userId: req.user?.id,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many file uploads. Please wait before uploading more files.',
            retryAfter: 3600
        });
    }
});

// ========================================
// Helper: Create Custom Rate Limiter
// ========================================
// Unused today (verified: no callers anywhere in src/) but kept as the
// documented escape hatch for a one-off limiter -- built resiliently like
// every other limiter above rather than left on the old always-in-memory
// path. `name` is required (not defaulted) so a future caller can't end up
// with an unlabeled limiter in logs/alerts.
export const createRateLimiter = (name, options) => {
    return createResilientRateLimiter(name, {
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('[RATE-LIMIT] Custom rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                limit: options.max,
                window: options.windowMs
            });

            res.status(429).json({
                status: 'error',
                message: options.message || 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000)
            });
        },
        ...options
    });
};

export default {
    payment: paymentRateLimiter,
    withdrawal: withdrawalRateLimiter,
    publicApi: publicApiRateLimiter,
    upload: uploadRateLimiter,
    create: createRateLimiter
};
