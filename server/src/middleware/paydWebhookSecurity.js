import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Middleware to verify Payd callback signature (HMAC)
 * and optionally whitelist IPs.
 */
export const verifyPaydWebhook = (req, res, next) => {
    const signature = req.headers['x-payd-signature'] || req.headers['signature'];
    const webhookSecret = process.env.PAYD_WEBHOOK_SECRET;

    // 1. IP Whitelisting (Optional but recommended)
    const allowedIPs = process.env.PAYD_ALLOWED_IPS ? process.env.PAYD_ALLOWED_IPS.split(',') : [];
    const clientIP = req.ip || req.connection.remoteAddress;

    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
        logger.warn(`Rejected callback from unauthorized IP: ${clientIP}`);
        // return res.status(403).json({ status: 'error', message: 'Forbidden: IP not whitelisted' });
        // Note: Logging only for now to avoid breaking existing integrations if IPs change.
    }

    // 2. HMAC Signature Verification
    if (webhookSecret) {
        if (!signature) {
            logger.warn('Missing Payd signature in callback headers');
            return res.status(401).json({ status: 'error', message: 'Missing signature' });
        }

        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            logger.error(`Invalid Payd signature. Expected ${expectedSignature}, got ${signature}`);
            return res.status(401).json({ status: 'error', message: 'Invalid signature' });
        }
    } else {
        if (process.env.NODE_ENV === 'production') {
            logger.warn('PAYD_WEBHOOK_SECRET is not set in production. Signature verification skipped!');
        }
    }

    next();
};
