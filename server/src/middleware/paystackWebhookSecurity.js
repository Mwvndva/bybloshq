import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';
import { normalizeProviderReference } from '../shared/utils/providerReference.js';

const WEBHOOK_REPLAY_TTL_HOURS = 24;
const MAX_EVENT_ID_LENGTH = 255;

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return String(raw || req.ip || req.socket?.remoteAddress || '')
        .split(',')[0]
        .trim()
        .replace(/^::ffff:/, '');
}

function configuredWebhookIps() {
    return String(process.env.PAYSTACK_WEBHOOK_IPS || '')
        .split(',')
        .map(ip => ip.trim())
        .filter(Boolean);
}

export function verifyPaystackHmacSignature(signature, rawBody, secret = process.env.PAYSTACK_SECRET_KEY) {
    if (!signature || !rawBody || !secret) return false;

    const received = String(signature).trim();
    if (!/^[a-f0-9]{128}$/i.test(received)) return false;

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
    const expected = crypto
        .createHmac('sha512', secret)
        .update(bodyBuffer)
        .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');

    return expectedBuffer.length === receivedBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function compactEventId(eventId) {
    if (eventId.length <= MAX_EVENT_ID_LENGTH) return eventId;
    const hash = crypto.createHash('sha256').update(eventId).digest('hex');
    return `${eventId.slice(0, MAX_EVENT_ID_LENGTH - hash.length - 1)}:${hash}`;
}

function getPaystackPayload(req) {
    const root = req.body;
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
        return null;
    }

    const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
        ? root.data
        : root;

    return { root, data };
}

function getPaystackEventType(root, data, req) {
    return String(root.event || data.event || req.originalUrl || req.path || 'paystack.webhook');
}

function getPaystackProviderReference(root, data) {
    return normalizeProviderReference(root)
        || data.reference
        || root.reference
        || data.transfer_code
        || data.transferCode
        || null;
}

export function derivePaystackReplayEventId({ root = {}, data = {}, eventType = 'paystack.webhook', rawBody = null } = {}) {
    const providerId = root.event_id || root.eventId || data.event_id || data.eventId || data.id || root.id || null;
    if (providerId) return compactEventId(`paystack:${eventType}:${providerId}`);

    const reference = getPaystackProviderReference(root, data);
    const timestamp = data.paid_at
        || data.updatedAt
        || data.createdAt
        || data.transferred_at
        || data.updated_at
        || data.created_at
        || '';
    const status = data.status || root.status || '';

    if (reference) {
        return compactEventId(`paystack:${eventType}:${reference}:${status}:${timestamp}`);
    }

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(root));
    return compactEventId(`paystack:${eventType}:${crypto.createHash('sha256').update(bodyBuffer).digest('hex')}`);
}

function deriveReplayEventId(req) {
    const payload = getPaystackPayload(req);
    if (!payload) return null;
    const eventType = getPaystackEventType(payload.root, payload.data, req);

    return derivePaystackReplayEventId({
        root: payload.root,
        data: payload.data,
        eventType,
        rawBody: req.rawBody
    });
}

export const verifyPaystackWebhook = (req, res, next) => {
    const clientIp = getClientIp(req);
    const allowedIps = configuredWebhookIps();

    if (process.env.NODE_ENV === 'production' && allowedIps.length === 0) {
        logger.error('[PAYSTACK-WEBHOOK] PAYSTACK_WEBHOOK_IPS is not configured in production', {
            clientIp,
            path: req.originalUrl
        });
        return res.status(503).json({ status: 'error', message: 'Webhook IP policy unavailable' });
    }

    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
        logger.error('[PAYSTACK-WEBHOOK] Rejected webhook from unauthorized IP', {
            clientIp,
            path: req.originalUrl
        });
        return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    req.webhookSecurity = {
        ...(req.webhookSecurity || {}),
        clientIP: clientIp,
        ipVerified: allowedIps.length > 0
    };
    next();
};

export const requirePaystackWebhookHmac = async (req, res, next) => {
    const signature = req.headers['x-paystack-signature'];
    const payload = getPaystackPayload(req);

    if (!payload) {
        logger.error('[PAYSTACK-WEBHOOK] Rejected webhook with invalid JSON payload', {
            ip: req.webhookSecurity?.clientIP || req.ip,
            path: req.originalUrl
        });
        return res.status(400).json({ status: 'error', message: 'Invalid webhook payload' });
    }

    const { root, data } = payload;
    const reference = getPaystackProviderReference(root, data);
    const eventType = getPaystackEventType(root, data, req);

    if (!verifyPaystackHmacSignature(signature, req.rawBody)) {
        logger.error('[PAYSTACK-WEBHOOK] Rejected webhook with invalid signature', {
            ip: req.webhookSecurity?.clientIP || req.ip,
            path: req.originalUrl,
            reference
        });
        return res.status(401).json({ status: 'error', message: 'Invalid webhook signature' });
    }

    const eventId = deriveReplayEventId(req);
    if (!eventId) {
        logger.error('[PAYSTACK-WEBHOOK] Rejected webhook without replay event id', {
            ip: req.webhookSecurity?.clientIP || req.ip,
            path: req.originalUrl,
            reference
        });
        return res.status(400).json({ status: 'error', message: 'Invalid webhook event' });
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
                VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval, 'processing', 1, NOW())
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
            [eventId, eventType, reference || null, WEBHOOK_REPLAY_TTL_HOURS]
        );

        if (!claim?.claimed) {
            if (claim?.status === 'completed') {
                return res.status(200).json({ status: 'success', message: 'Webhook already processed' });
            }
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
            ).catch(error => logger.warn('[PAYSTACK-WEBHOOK] Failed to finalize replay state', {
                eventId,
                error: error.message
            }));
        });
    } catch (error) {
        logger.error('[PAYSTACK-WEBHOOK] Replay protection unavailable; rejecting webhook', {
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
        replayEventType: eventType,
        providerReference: reference || null,
        replayCheckedAt: new Date()
    };
    next();
};

export const webhookRateLimiter = (() => {
    const requests = new Map();
    const WINDOW_MS = 60 * 1000;
    const MAX_REQUESTS = 100;

    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of requests.entries()) {
            if (now > data.resetTime) requests.delete(ip);
        }
    }, 5 * 60 * 1000);
    cleanupTimer.unref?.();

    return (req, res, next) => {
        const clientIp = req.webhookSecurity?.clientIP || getClientIp(req);
        const now = Date.now();
        let ipData = requests.get(clientIp);
        if (!ipData || now > ipData.resetTime) {
            ipData = { count: 1, resetTime: now + WINDOW_MS };
            requests.set(clientIp, ipData);
        } else {
            ipData.count++;
        }

        if (ipData.count > MAX_REQUESTS) {
            return res.status(429).json({
                status: 'error',
                message: 'Too many webhook requests',
                retryAfter: Math.ceil((ipData.resetTime - now) / 1000)
            });
        }

        next();
    };
})();

export default verifyPaystackWebhook;
