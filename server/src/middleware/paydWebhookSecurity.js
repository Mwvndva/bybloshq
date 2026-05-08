import crypto from 'crypto';
import logger from '../shared/utils/logger.js';
import { normalizeProviderReference } from '../shared/utils/providerReference.js';
import cacheService from '../services/cache.service.js';
import { pool } from '../shared/db/database.js';

function ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0;
}

function ipMatches(clientIP, allowedEntry) {
    const ip = clientIP.replace(/^::ffff:/, '');
    if (ip === allowedEntry) return true;

    if (allowedEntry.includes('/')) {
        const [network, prefixStr] = allowedEntry.split('/');
        const prefix = Number.parseInt(prefixStr, 10);
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
 * This middleware implements defense-in-depth security through multiple layers:
 * 
 * 1. IP Whitelisting (network allow-list)
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
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({
                status: 'error',
                message: 'Webhook IP whitelist cannot be disabled in production'
            });
        }
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

            // Log to security monitoring (if available)
            setImmediate(() => {
                import('../services/monitoring.service.js').then(({ default: monitoringService }) => {
                    monitoringService.alertSecurityTeam('Unauthorized webhook IP', {
                        ip: clientIP,
                        url: req.originalUrl,
                        userAgent: req.headers['user-agent']
                    }).catch(err => logger.error('Failed to send security alert:', err));
                });
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
    const hasReference = normalizeProviderReference(req.body);

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

            // FIXED BUG-PAY-SEC-02: Prevent replay attacks by rejecting old webhooks (>10 mins)
            const MAX_STALE_MS = 10 * 60 * 1000;
            if (process.env.NODE_ENV === 'production' && Math.abs(now - webhookTime) > MAX_STALE_MS) {
                logger.warn('[WEBHOOK-SECURITY] ⛔ Rejecting stale webhook:', {
                    timestamp: webhookTimestamp,
                    ageSeconds: Math.floor(Math.abs(now - webhookTime) / 1000)
                });
                return res.status(403).json({
                    status: 'error',
                    message: 'Webhook timestamp expired or invalid'
                });
            }
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

export function verifyPaydHmacSignature(signature, rawBody, secret = process.env.PAYD_WEBHOOK_SECRET || process.env.PAYD_CALLBACK_SECRET) {
    if (!signature || !rawBody || !secret) {
        return false;
    }

    try {
        const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
        const expected = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
        const received = String(signature).replace(/^sha256=/i, '').trim();
        const expectedBuffer = Buffer.from(expected, 'hex');
        const receivedBuffer = Buffer.from(received, 'hex');

        if (expectedBuffer.length !== receivedBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (error) {
        logger.error('[WEBHOOK-SECURITY] HMAC verification error', { error: error.message });
        return false;
    }
}

function parseWebhookTimestamp(req, payload) {
    const rawTimestamp = req.headers['x-payd-timestamp']
        || req.headers['x-webhook-timestamp']
        || req.headers['x-request-timestamp']
        || payload.timestamp
        || payload.created_at
        || payload.time;

    if (!rawTimestamp) return { valid: false, rawTimestamp: null, reason: 'missing_timestamp' };

    const numeric = Number(rawTimestamp);
    const timestamp = Number.isFinite(numeric)
        ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
        : new Date(rawTimestamp);

    if (Number.isNaN(timestamp.getTime())) {
        return { valid: false, rawTimestamp, reason: 'invalid_timestamp' };
    }

    const ageMs = Math.abs(Date.now() - timestamp.getTime());
    const maxAgeMs = Number.parseInt(process.env.PAYD_WEBHOOK_MAX_AGE_MS || `${10 * 60 * 1000}`, 10);
    if (ageMs > maxAgeMs) {
        return { valid: false, rawTimestamp, reason: 'stale_timestamp', ageMs };
    }

    return { valid: true, rawTimestamp, timestamp, ageMs };
}

function deriveReplayEventId(req, payload) {
    const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody || ''));
    const bodyHash = crypto.createHash('sha256').update(raw).digest('hex');
    return String(
        req.headers['x-payd-event-id']
        || req.headers['x-webhook-id']
        || req.headers['x-request-id']
        || payload.event_id
        || payload.callback_id
        || payload.transaction_id
        || payload.transaction_reference
        || payload.correlator_id
        || bodyHash
    ).trim();
}

export const requirePaydWebhookHmac = async (req, res, next) => {
    const payload = req.body?.data || req.body || {};
    const signature = req.headers['x-payd-signature'];
    const reference = normalizeProviderReference(req.body);

    if (!verifyPaydHmacSignature(signature, req.rawBody)) {
        logger.error('[WEBHOOK-SECURITY] Rejected webhook with invalid or missing HMAC signature', {
            ip: req.ip,
            path: req.originalUrl,
            reference
        });
        return res.status(401).json({ status: 'error', message: 'Invalid webhook signature' });
    }

    const timestampCheck = parseWebhookTimestamp(req, payload);
    if (!timestampCheck.valid) {
        logger.error('[WEBHOOK-SECURITY] Rejected webhook with invalid replay timestamp', {
            ip: req.ip,
            path: req.originalUrl,
            reference,
            reason: timestampCheck.reason,
            ageMs: timestampCheck.ageMs
        });
        return res.status(403).json({ status: 'error', message: 'Webhook timestamp rejected' });
    }

    const eventId = deriveReplayEventId(req, payload);
    if (!eventId) {
        logger.error('[WEBHOOK-SECURITY] Rejected webhook without replay event id', {
            ip: req.ip,
            path: req.originalUrl,
            reference
        });
        return res.status(400).json({ status: 'error', message: 'Webhook replay id missing' });
    }

    try {
        const { rows: [claim] } = await pool.query(
            `WITH upsert AS (
                INSERT INTO webhook_replay_dedupe (
                    event_id,
                    event_type,
                    provider_reference,
                    expires_at,
                    status,
                    attempts,
                    updated_at
                )
                VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours', 'processing', 1, NOW())
                ON CONFLICT (event_id)
                DO UPDATE SET
                    status = 'processing',
                    attempts = webhook_replay_dedupe.attempts + 1,
                    updated_at = NOW(),
                    last_error = NULL
                WHERE webhook_replay_dedupe.status <> 'completed'
                  AND (
                      webhook_replay_dedupe.status <> 'processing'
                      OR webhook_replay_dedupe.updated_at IS NULL
                      OR webhook_replay_dedupe.updated_at < NOW() - INTERVAL '2 minutes'
                  )
                RETURNING status, attempts, TRUE AS claimed
             )
             SELECT status, attempts, claimed FROM upsert
             UNION ALL
             SELECT status, attempts, FALSE AS claimed
             FROM webhook_replay_dedupe
             WHERE event_id = $1
               AND NOT EXISTS (SELECT 1 FROM upsert)
             LIMIT 1`,
            [eventId, req.originalUrl || req.path, reference || null]
        );

        if (!claim?.claimed) {
            if (claim?.status === 'completed') {
                logger.info('[WEBHOOK-SECURITY] Idempotent replay suppressed after completed processing', {
                    eventId,
                    reference,
                    path: req.originalUrl
                });
                return res.status(200).json({ status: 'success', message: 'Webhook already processed' });
            }

            logger.warn('[WEBHOOK-SECURITY] Rejected concurrent replay while original webhook is processing', {
                eventId,
                reference,
                path: req.originalUrl,
                status: claim?.status
            });
            return res.status(409).json({ status: 'error', message: 'Webhook already processing' });
        }

        res.on('finish', () => {
            const completed = res.statusCode < 500;
            pool.query(
                `UPDATE webhook_replay_dedupe
                 SET status = $2,
                     completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
                     last_error = CASE WHEN $2 = 'failed' THEN $3 ELSE NULL END,
                     updated_at = NOW()
                 WHERE event_id = $1`,
                [eventId, completed ? 'completed' : 'failed', `HTTP ${res.statusCode}`]
            ).catch(error => logger.warn('[WEBHOOK-SECURITY] Failed to finalize webhook replay state', {
                eventId,
                error: error.message
            }));
        });

        pool.query('DELETE FROM webhook_replay_dedupe WHERE expires_at < NOW()')
            .catch(error => logger.warn('[WEBHOOK-SECURITY] Replay dedupe cleanup failed', { error: error.message }));
    } catch (error) {
        logger.error('[WEBHOOK-SECURITY] Replay protection unavailable; rejecting webhook', {
            eventId,
            reference,
            error: error.message
        });
        return res.status(503).json({ status: 'error', message: 'Webhook replay protection unavailable' });
    }

    req.webhookSecurity = {
        ...(req.webhookSecurity || {}),
        hmacVerified: true,
        replayEventId: eventId,
        replayCheckedAt: new Date(),
        timestamp: timestampCheck.timestamp
    };
    return next();
};

/**
 * Rate limiting specifically for webhooks
 * Prevents abuse even from whitelisted IPs
 */
export const webhookRateLimiter = (() => {
    const requests = new Map();
    const WINDOW_MS = 60 * 1000;
    const MAX_REQUESTS = 100;

    setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of requests.entries()) {
            if (now > data.resetTime) {
                requests.delete(ip);
            }
        }
    }, 5 * 60 * 1000);

    const fallbackMemoryLimit = (clientIP, now) => {
        let ipData = requests.get(clientIP);
        if (!ipData || now > ipData.resetTime) {
            ipData = { count: 1, resetTime: now + WINDOW_MS };
            requests.set(clientIP, ipData);
        } else {
            ipData.count++;
        }
        return ipData;
    };

    return async (req, res, next) => {
        const clientIP = req.webhookSecurity?.clientIP || req.ip;
        const now = Date.now();

        try {
            const redis = cacheService?.redis;
            if (redis?.incr && redis?.expire) {
                const bucket = Math.floor(now / WINDOW_MS);
                const key = `rate:webhook:payd:${clientIP}:${bucket}`;
                const count = await redis.incr(key);
                if (count === 1) {
                    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
                }

                if (count > MAX_REQUESTS) {
                    logger.warn(`[WEBHOOK-SECURITY] Rate limit exceeded for IP via Redis: ${clientIP}`, {
                        count,
                        limit: MAX_REQUESTS
                    });

                    return res.status(429).json({
                        status: 'error',
                        message: 'Too many webhook requests',
                        retryAfter: Math.ceil(WINDOW_MS / 1000)
                    });
                }

                return next();
            }
        } catch (error) {
            logger.error('[WEBHOOK-SECURITY] Redis rate limiter unavailable; using local fallback', {
                ip: clientIP,
                error: error.message
            });
        }

        const ipData = fallbackMemoryLimit(clientIP, now);
        if (ipData.count > MAX_REQUESTS) {
            logger.warn(`[WEBHOOK-SECURITY] Rate limit exceeded for IP: ${clientIP}`, {
                count: ipData.count,
                limit: MAX_REQUESTS
            });

            return res.status(429).json({
                status: 'error',
                message: 'Too many webhook requests',
                retryAfter: Math.ceil((ipData.resetTime - now) / 1000)
            });
        }

        next();
    };
})();
export default verifyPaydWebhook;

