import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * Granular Rate Limiting Configuration (P1-003)
 * 
 * Different endpoints have different rate limit requirements:
 * - Authentication: Strict limits to prevent brute force
 * - Webhooks: Moderate limits (already handled in paydWebhookSecurity.js)
 * - Public API: Generous limits for normal usage
 * - Admin: More generous for authenticated admins
 */

// ========================================
// 1. Authentication Endpoints (STRICT)
// ========================================
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        status: 'error',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use IP + email combination for more accurate tracking
    keyGenerator: (req) => {
        const email = req.body?.email || req.body?.username || '';
        return `${req.ip}:${email}`;
    },
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Authentication rate limit exceeded', {
            ip: req.ip,
            email: req.body?.email,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many login attempts. Please try again in 15 minutes.',
            retryAfter: 900 // seconds
        });
    },
    skip: (req) => {
        // Skip rate limiting in development for easier testing
        return process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH_RATE_LIMIT === 'true';
    }
});

// ========================================
// 2. Password Reset (VERY STRICT)
// ========================================
export const passwordResetRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Only 3 reset attempts per hour
    message: {
        status: 'error',
        message: 'Too many password reset requests. Please try again in 1 hour.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = req.body?.email || '';
        return `${req.ip}:${email}`;
    },
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Password reset rate limit exceeded', {
            ip: req.ip,
            email: req.body?.email
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many password reset requests. Please try again later.',
            retryAfter: 3600
        });
    }
});

// ========================================
// 3. Registration (MODERATE)
// ========================================
export const registrationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 registrations per hour per IP
    message: {
        status: 'error',
        message: 'Too many registration attempts. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('[RATE-LIMIT] Registration rate limit exceeded', {
            ip: req.ip,
            path: req.path
        });

        res.status(429).json({
            status: 'error',
            message: 'Too many registration attempts from this IP. Please try again later.',
            retryAfter: 3600
        });
    }
});

// ========================================
// 4. Payment Initiation (MODERATE)
// ========================================
export const paymentRateLimiter = rateLimit({
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
export const withdrawalRateLimiter = rateLimit({
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
export const publicApiRateLimiter = rateLimit({
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
// 7. File Upload (STRICT)
// ========================================
export const uploadRateLimiter = rateLimit({
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
// 8. Admin Operations (GENEROUS)
// ========================================
export const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes for admins
    message: {
        status: 'error',
        message: 'Rate limit exceeded. Please contact support if you need higher limits.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip for super admins in development
        return process.env.NODE_ENV === 'development' && req.user?.userType === 'admin';
    }
});

// ========================================
// Helper: Create Custom Rate Limiter
// ========================================
export const createRateLimiter = (options) => {
    return rateLimit({
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
    auth: authRateLimiter,
    passwordReset: passwordResetRateLimiter,
    registration: registrationRateLimiter,
    payment: paymentRateLimiter,
    withdrawal: withdrawalRateLimiter,
    publicApi: publicApiRateLimiter,
    upload: uploadRateLimiter,
    admin: adminRateLimiter,
    create: createRateLimiter
};
