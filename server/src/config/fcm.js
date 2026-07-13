import jwt from 'jsonwebtoken';
import logger from '../shared/utils/logger.js';

// FCM HTTP v1 sender. The legacy fcm.googleapis.com/fcm/send + server-key API
// was decommissioned by Google in June 2024, so pushes now go through the v1
// endpoint authenticated with a service-account OAuth token (minted here from
// the service account's private key -> a short-lived Bearer token, cached).
//
// Config: set FIREBASE_SERVICE_ACCOUNT to the service-account JSON (raw JSON or
// base64-encoded). If unset, push is treated as not-configured and skipped.

let cachedServiceAccount; // undefined = not loaded, null = not configured
let cachedToken = null;   // { accessToken, expiresAt (epoch seconds) }

function getServiceAccount() {
    if (cachedServiceAccount !== undefined) return cachedServiceAccount;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) { cachedServiceAccount = null; return null; }
    try {
        const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        const parsed = JSON.parse(text);
        if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
            logger.error('[FCM] FIREBASE_SERVICE_ACCOUNT is missing client_email/private_key/project_id');
            cachedServiceAccount = null; return null;
        }
        cachedServiceAccount = parsed;
        return parsed;
    } catch (error) {
        logger.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT', { error: error.message });
        cachedServiceAccount = null; return null;
    }
}

export function isFcmConfigured() {
    return getServiceAccount() !== null;
}

export function getFcmProjectId() {
    return getServiceAccount()?.project_id || null;
}

async function getAccessToken() {
    const sa = getServiceAccount();
    if (!sa) return null;

    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.accessToken;

    const assertion = jwt.sign(
        { scope: 'https://www.googleapis.com/auth/firebase.messaging' },
        sa.private_key,
        {
            algorithm: 'RS256',
            issuer: sa.client_email,
            subject: sa.client_email,
            audience: 'https://oauth2.googleapis.com/token',
            expiresIn: 3600,
            keyid: sa.private_key_id,
        }
    );

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        logger.error('[FCM] Could not obtain OAuth access token', {
            status: res.status, error: data.error, description: data.error_description,
        });
        return null;
    }
    cachedToken = { accessToken: data.access_token, expiresAt: now + (data.expires_in || 3600) };
    return cachedToken.accessToken;
}

// Send one message to one device token via FCM HTTP v1.
// Returns { ok } on success, or { ok:false, unregistered, status, error } on failure.
// `unregistered` marks tokens that are permanently invalid so callers can prune them.
export async function sendFcmV1({ token, title, body, data = {} }) {
    const sa = getServiceAccount();
    if (!sa) return { ok: false, reason: 'not_configured' };

    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, reason: 'auth_failed' };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: {
                token,
                notification: { title, body },
                data,
                android: { priority: 'HIGH' },
            },
        }),
    });

    if (res.ok) return { ok: true };

    const payload = await res.json().catch(() => ({}));
    const errorCode = payload?.error?.details?.find?.(detail => detail.errorCode)?.errorCode
        || payload?.error?.status;
    const unregistered = res.status === 404
        || errorCode === 'UNREGISTERED'
        || errorCode === 'NOT_FOUND'
        || errorCode === 'INVALID_ARGUMENT';
    return { ok: false, unregistered, status: res.status, error: payload?.error };
}
