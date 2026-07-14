import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import { sendFcmV1, isFcmConfigured } from '../config/fcm.js';

const VALID_CHANNELS = new Set(['in_app', 'push', 'email']);
const VALID_PLATFORMS = new Set(['android', 'ios', 'web']);
const VALID_ROLES = new Set(['buyer', 'seller', 'creator', 'admin', 'logistics']);

function normalizeRole(role) {
    const normalized = String(role || '').toLowerCase();
    return normalized === 'mzigo' ? 'logistics' : normalized;
}

function normalizeChannels(channels = ['in_app']) {
    const list = Array.isArray(channels) ? channels : [channels];
    const normalized = list
        .map(channel => String(channel || '').trim().toLowerCase())
        .filter(channel => VALID_CHANNELS.has(channel));
    return normalized.length > 0 ? [...new Set(normalized)] : ['in_app'];
}

class NotificationService {
    async registerDeviceToken({ userId, role, platform, token, deviceId = null, appVersion = null }) {
        const normalizedRole = normalizeRole(role);
        const normalizedPlatform = String(platform || '').toLowerCase();
        const trimmedToken = String(token || '').trim();

        if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
            throw new Error('Valid user id is required');
        }
        if (!VALID_ROLES.has(normalizedRole)) {
            throw new Error('Valid notification role is required');
        }
        if (!VALID_PLATFORMS.has(normalizedPlatform)) {
            throw new Error('Valid notification platform is required');
        }
        if (!trimmedToken) {
            throw new Error('Device token is required');
        }

        const { rows } = await pool.query(
            `INSERT INTO notification_device_tokens
                (user_id, role, platform, token, device_id, app_version, is_active, last_seen_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
             ON CONFLICT (token) DO UPDATE
             SET user_id = EXCLUDED.user_id,
                 role = EXCLUDED.role,
                 platform = EXCLUDED.platform,
                 device_id = EXCLUDED.device_id,
                 app_version = EXCLUDED.app_version,
                 is_active = TRUE,
                 last_seen_at = NOW(),
                 updated_at = NOW()
             RETURNING id, user_id, role, platform, device_id, app_version, is_active, last_seen_at`,
            [
                Number(userId),
                normalizedRole,
                normalizedPlatform,
                trimmedToken,
                deviceId ? String(deviceId).trim() : null,
                appVersion ? String(appVersion).trim() : null
            ]
        );

        return rows[0];
    }

    async unregisterDeviceToken({ userId, token }) {
        const trimmedToken = String(token || '').trim();
        if (!trimmedToken) throw new Error('Device token is required');

        const { rowCount } = await pool.query(
            `UPDATE notification_device_tokens
             SET is_active = FALSE,
                 updated_at = NOW()
             WHERE user_id = $1
               AND token = $2`,
            [Number(userId), trimmedToken]
        );

        return rowCount > 0;
    }

    async createInAppNotification({ recipientUserId, recipientRole, type, title, body, data = {}, channels = ['in_app'] }) {
        const normalizedRole = normalizeRole(recipientRole);
        if (!VALID_ROLES.has(normalizedRole)) throw new Error('Valid recipient role is required');

        const { rows } = await pool.query(
            `INSERT INTO app_notifications
                (recipient_user_id, recipient_role, type, title, body, data, channels)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::text[])
             RETURNING id, recipient_user_id, recipient_role, type, title, body, data, channels, read_at, created_at`,
            [
                Number(recipientUserId),
                normalizedRole,
                String(type || 'general'),
                String(title || '').trim(),
                String(body || '').trim(),
                JSON.stringify(data || {}),
                normalizeChannels(channels)
            ]
        );

        return rows[0];
    }

    async send(notification) {
        const channels = normalizeChannels(notification.channels);
        const results = {};

        if (channels.includes('in_app')) {
            results.in_app = await this.createInAppNotification({
                ...notification,
                channels
            });
        }

        if (channels.includes('push')) {
            results.push = await this.sendPush(notification).catch(error => {
                logger.error('[NotificationService] Push delivery failed', {
                    recipientUserId: notification.recipientUserId,
                    type: notification.type,
                    error: error.message
                });
                return { delivered: false, error: error.message };
            });
        }

        // Email stays behind its existing direct service for now. This facade
        // gives new app flows a stable API while that sender is migrated.
        if (channels.includes('email')) {
            results.email = { delivered: false, deferred: true };
        }

        return results;
    }

    async sendPush({ recipientUserId, title, body, data = {} }) {
        const { rows: tokens } = await pool.query(
            `SELECT token, platform
             FROM notification_device_tokens
             WHERE user_id = $1
               AND is_active = TRUE`,
            [Number(recipientUserId)]
        );

        if (tokens.length === 0) {
            return { delivered: false, reason: 'no_active_device_tokens' };
        }

        if (!isFcmConfigured()) {
            logger.info('[NotificationService] Push skipped: FCM service account not configured', {
                recipientUserId,
                tokenCount: tokens.length
            });
            return { delivered: false, reason: 'push_provider_not_configured', tokenCount: tokens.length };
        }

        const stringData = Object.fromEntries(
            Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')])
        );

        const responses = [];
        const invalidTokens = [];
        for (const device of tokens) {
            const result = await sendFcmV1({ token: device.token, title, body, data: stringData });
            responses.push({ ok: result.ok, status: result.status });

            if (!result.ok) {
                logger.warn('[NotificationService] Push provider returned a non-success response', {
                    recipientUserId,
                    platform: device.platform,
                    status: result.status,
                    error: result.error
                });
                if (result.unregistered) {
                    invalidTokens.push(device.token);
                }
            }
        }

        if (invalidTokens.length > 0) {
            await pool.query(
                `UPDATE notification_device_tokens
                 SET is_active = FALSE
                 WHERE token = ANY($1::text[])`,
                [invalidTokens]
            ).catch(error => logger.error('[NotificationService] Failed to deactivate invalid device tokens', {
                error: error.message
            }));
        }

        return { delivered: responses.some(item => item.ok), responses };
    }

    async listForUser({ userId, limit = 50, unreadOnly = false }) {
        const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
        const { rows } = await pool.query(
            `SELECT id, recipient_role, type, title, body, data, channels, read_at, created_at
             FROM app_notifications
             WHERE recipient_user_id = $1
               AND ($2::boolean = FALSE OR read_at IS NULL)
             ORDER BY created_at DESC
             LIMIT $3`,
            [Number(userId), Boolean(unreadOnly), safeLimit]
        );
        return rows;
    }

    async markRead({ userId, notificationId }) {
        const { rows } = await pool.query(
            `UPDATE app_notifications
             SET read_at = COALESCE(read_at, NOW())
             WHERE id = $1
               AND recipient_user_id = $2
             RETURNING id, read_at`,
            [Number(notificationId), Number(userId)]
        );
        return rows[0] || null;
    }

    async markAllRead({ userId }) {
        const { rowCount } = await pool.query(
            `UPDATE app_notifications
             SET read_at = COALESCE(read_at, NOW())
             WHERE recipient_user_id = $1
               AND read_at IS NULL`,
            [Number(userId)]
        );
        return rowCount;
    }
}

export default new NotificationService();
