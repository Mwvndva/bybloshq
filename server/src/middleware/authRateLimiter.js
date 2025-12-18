import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        status: 'fail',
        message: 'Too many login attempts, please try again in 15 minutes',
    },
    keyGenerator: (req) => {
        // Use IP and potentially user agent or other identifiers if behind proxy consistently
        // For now, simpler is better to avoid locking out legitimate users on shared IPs too easily if configured wrong,
        // but IP is standard for this.
        return req.ip;
    }
});
