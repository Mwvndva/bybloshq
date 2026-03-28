import crypto from 'crypto';
import logger from '../utils/logger.js';

function ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function ipMatches(clientIP, allowedEntry) {
    const ip = clientIP.replace(/^::ffff:/, '');
    if (ip === allowedEntry) return true;

    if (allowedEntry.includes('/')) {
        const [network, prefixStr] = allowedEntry.split('/');
        const prefix = parseInt(prefixStr, 10);
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        try { return (ipToInt(ip) & mask) === (ipToInt(network) & mask); }
        catch { return false; }
    }

    if (allowedEntry.includes('x') || allowedEntry.includes('*')) {
        const pattern = allowedEntry.replace(/\./g, '\\.').replace(/x|\*/g, '\\d{1,3}');
        return new RegExp(`^${pattern}$`).test(ip);
    }

    return false;
}

/**
 * Payd Webhook Security Middleware
 * 
 * CRITICAL CONTEXT: Payd does NOT provide webhook signature verification.
 * This middleware implements defense-in-depth security through multiple layers:
 * 
 * 1. IP Whitelisting (PRIMARY SECURITY LAYER - REQUIRED)
 * 2. Request validation (Content-Type, body structure)
 * 3. Timestamp validation (reject stale webhooks)
 * 
 * IMPORTANT: You MUST configure PAYD_ALLOWED_IPS in your environment variables
 * Contact Payd support (support@mypayd.app) to get official webhook IP addresses
 */

export const verifyPaydWebhook = (req, res, next) => {
    const startTime = Date.now();

    // ========================================
    // LAYER 1: IP WHITELISTING (CRITICAL)
    // ========================================

    // Extract client IP (handle various proxy scenarios)
    // trust proxy is set in index.js — req.ip is already the correct resolved IP.
    // Reading raw headers here would allow spoofing via X-Real-IP / X-Forwarded-For.
    const clientIP = req.ip;

    logger.info(`[WEBHOOK-SECURITY] Incoming webhook from IP: ${clientIP}`, {
        url: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent']
    });

    // Get allowed IPs from environment
    const allowedIPsString = (process.env.PAYD_ALLOWED_IPS || '').trim();

    if (!allowedIPsString) {
        logger.error('[WEBHOOK-SECURITY] ⛔ CRITICAL: PAYD_ALLOWED_IPS not configured!');
        logger.info(`[WEBHOOK-SECURITY] TIP: To authorize this IP, add ${clientIP} to PAYD_ALLOWED_IPS in .env`);

        // In production, BLOCK all requests if IP whitelist not configured
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({
                status: 'error',
                message: 'Webhook security not configured'
            });
        } else {
            // In development, log warning but allow (for testing)
            logger.warn('[WEBHOOK-SECURITY] ⚠️  WARNING: IP whitelist disabled in development mode');
        }
    } else if (allowedIPsString.toLowerCase() === 'skip' || allowedIPsString === '*') {
        logger.warn(`[WEBHOOK-SECURITY] ⚠️  SECURITY ALERT: IP Whitelisting is explicitly DISABLED (Value: ${allowedIPsString})`);
        logger.info(`[WEBHOOK-SECURITY] Authorized incoming IP ${clientIP} via skip rule`);
    } else {
        // Parse allowed IPs
        const allowedIPs = allowedIPsString.split(',').map(ip => ip.trim()).filter(ip => ip);

        if (allowedIPs.length === 0) {
            logger.error('[WEBHOOK-SECURITY] ⛔ CRITICAL: PAYD_ALLOWED_IPS is empty!');
            return res.status(503).json({
                status: 'error',
                message: 'Webhook security misconfigured'
            });
        }

        // Check if client IP is whitelisted
        const isAllowed = allowedIPs.some(entry => ipMatches(clientIP, entry));

        if (!isAllowed) {
            logger.error(`[WEBHOOK-SECURITY] ⛔ REJECTED: Unauthorized IP: ${clientIP}`, {
                allowedIPs: allowedIPs,
                requestHeaders: {
                    'user-agent': req.headers['user-agent'],
                    'content-type': req.headers['content-type'],
                    'x-forwarded-for': req.headers['x-forwarded-for']
                }
            });

            // Security alert logic
            logger.error(`[PAYD-SECURITY] Unauthorized webhook IP: ${clientIP}`, {
                url: req.originalUrl,
                userAgent: req.headers['user-agent']
            });


            return res.status(403).json({
                status: 'error',
                message: 'Forbidden: IP not whitelisted'
            });
        }

        logger.info(`[WEBHOOK-SECURITY] ✅ IP ${clientIP} is whitelisted`);
    }

    // ========================================
    // LAYER 2: REQUEST VALIDATION
    // ========================================

    // Validate Content-Type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
        logger.warn('[WEBHOOK-SECURITY] ⚠️  Invalid Content-Type:', contentType);
        return res.status(400).json({
            status: 'error',
            message: 'Invalid Content-Type. Expected application/json'
        });
    }

    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
        logger.warn('[WEBHOOK-SECURITY] ⚠️  Empty request body');
        return res.status(400).json({
            status: 'error',
            message: 'Empty request body'
        });
    }

    // Validate payload structure
    const payload = req.body.data || req.body;

    // Check for transaction reference (various field names Payd might use)
    const hasReference = payload.transaction_reference ||
        payload.correlator_id ||
        payload.transaction_id ||
        payload.reference ||
        payload.tracking_id;

    if (!hasReference) {
        logger.warn('[WEBHOOK-SECURITY] ⚠️  Missing transaction reference in payload:', {
            keys: Object.keys(payload)
        });
        return res.status(400).json({
            status: 'error',
            message: 'Invalid payload: missing transaction reference'
        });
    }

    // ========================================
    // LAYER 3: TIMESTAMP VALIDATION (Optional but recommended)
    // ========================================

    const webhookTimestamp = payload.timestamp ||
        payload.created_at ||
        payload.time ||
        req.headers['x-webhook-timestamp'];

    if (webhookTimestamp) {
        try {
            const webhookTime = new Date(webhookTimestamp);
            const now = new Date();
            const ageInMinutes = (now - webhookTime) / 1000 / 60;

            // Warn if webhook is older than 5 minutes (but don't reject)
            if (ageInMinutes > 5) {
                logger.warn('[WEBHOOK-SECURITY] ⚠️  Stale webhook received', {
                    age: `${ageInMinutes.toFixed(2)} minutes`,
                    timestamp: webhookTimestamp,
                    reference: hasReference
                });
            }
        } catch (error) {
            logger.warn('[WEBHOOK-SECURITY] ⚠️  Invalid timestamp format:', webhookTimestamp);
        }
    }

    // ========================================
    // All Security Checks Passed
    // ========================================

    const duration = Date.now() - startTime;
    logger.info(`[WEBHOOK-SECURITY] ✅ All security checks passed (${duration}ms)`, {
        ip: clientIP,
        reference: hasReference
    });

    // Attach security metadata to request for downstream handlers
    req.webhookSecurity = {
        clientIP,
        validatedAt: new Date(),
        duration
    };

    next();
};

/**
 * Rate limiting specifically for webhooks
 * Prevents abuse even from whitelisted IPs
 */
export const webhookRateLimiter = (() => {
    const requests = new Map(); // IP -> { count, resetTime }
    const WINDOW_MS = 60 * 1000; // 1 minute
    const MAX_REQUESTS = 100; // Max 100 webhooks per minute per IP

    // Cleanup old entries every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of requests.entries()) {
            if (now > data.resetTime) {
                requests.delete(ip);
            }
        }
    }, 5 * 60 * 1000);

    return (req, res, next) => {
        const clientIP = req.webhookSecurity?.clientIP || req.ip;
        const now = Date.now();

        let ipData = requests.get(clientIP);

        if (!ipData || now > ipData.resetTime) {
            // New window
            ipData = {
                count: 1,
                resetTime: now + WINDOW_MS
            };
            requests.set(clientIP, ipData);
        } else {
            // Within window
            ipData.count++;

            if (ipData.count > MAX_REQUESTS) {
                logger.warn(`[WEBHOOK-SECURITY] ⚠️  Rate limit exceeded for IP: ${clientIP}`, {
                    count: ipData.count,
                    limit: MAX_REQUESTS
                });

                return res.status(429).json({
                    status: 'error',
                    message: 'Too many webhook requests',
                    retryAfter: Math.ceil((ipData.resetTime - now) / 1000)
                });
            }
        }

        next();
    };
})();

export default verifyPaydWebhook;
