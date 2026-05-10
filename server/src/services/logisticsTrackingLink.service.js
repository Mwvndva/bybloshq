import crypto from 'node:crypto';
import { pool } from '../shared/db/database.js';
import { AppError } from '../shared/utils/errorHandler.js';

const TOKEN_VERSION = 'v1';
const TRACKING_AUDIENCES = ['buyer', 'seller'];
const VISIBLE_REQUEST_STATUSES = new Set(['active', 'in_progress', 'completed', 'failed', 'manual_review']);

function getSecret() {
    return process.env.TRACKING_LINK_SECRET || process.env.JWT_SECRET;
}

function sign(publicId, audience) {
    const secret = getSecret();
    if (!secret) {
        throw new Error('TRACKING_LINK_SECRET or JWT_SECRET is required for tracking links');
    }
    return crypto
        .createHmac('sha256', secret)
        .update(`${TOKEN_VERSION}.${audience}.${publicId}`)
        .digest('base64url');
}

function timingSafeEqualString(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function buildToken(publicId, audience) {
    return `${TOKEN_VERSION}_${audience}_${publicId}_${sign(publicId, audience)}`;
}

function parseToken(rawToken) {
    const token = String(rawToken || '').trim();
    const match = token.match(/^v1_(buyer|seller)_([a-f0-9-]{36})_([A-Za-z0-9_-]{32,96})$/);
    if (!match) {
        throw new AppError('Tracking link is invalid', 404);
    }

    const [, audience, publicId, signature] = match;
    if (!timingSafeEqualString(signature, sign(publicId, audience))) {
        throw new AppError('Tracking link is invalid', 404);
    }

    return { audience, publicId };
}

function frontendBaseUrl() {
    return (process.env.FRONTEND_URL || 'https://bybloshq.space').replace(/\/+$/, '');
}

function mapSafeLeg(row, prefix, audience) {
    const hasLeg = row[`${prefix}_leg_id`] !== null && row[`${prefix}_leg_id`] !== undefined;
    if (!hasLeg) return null;

    const isBuyer = audience === 'buyer';
    const isSeller = audience === 'seller';
    const isDelivery = prefix === 'delivery';
    const isPickup = prefix === 'pickup';

    return {
        type: prefix,
        status: row[`${prefix}_status`] || null,
        eta: row[`${prefix}_deadline_at`] || row.request_deadline_at || null,
        origin: {
            label: row[`${prefix}_origin_label`] || null,
            address: isSeller || !isPickup ? row[`${prefix}_origin_address`] || null : null
        },
        destination: {
            label: row[`${prefix}_destination_label`] || null,
            address: isBuyer || !isDelivery ? row[`${prefix}_destination_address`] || null : null
        },
        safeNote: isSeller && isDelivery
            ? 'Buyer delivery address is hidden for privacy.'
            : null
    };
}

function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

class LogisticsTrackingLinkService {
    static tokenFor(publicId, audience) {
        return buildToken(publicId, audience);
    }

    static urlFor(publicId, audience) {
        return `${frontendBaseUrl()}/track/${this.tokenFor(publicId, audience)}`;
    }

    static async ensureLinksForRequest(client, logisticsRequestId) {
        if (!client?.query) {
            throw new Error('ensureLinksForRequest requires an active database client');
        }

        for (const audience of TRACKING_AUDIENCES) {
            await client.query(
                `INSERT INTO logistics_tracking_links
                    (logistics_request_id, audience, public_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (logistics_request_id, audience)
                 DO UPDATE SET
                    active = TRUE,
                    expires_at = NULL,
                    updated_at = NOW()`,
                [logisticsRequestId, audience, crypto.randomUUID()]
            );
        }
    }

    static async getLinksForRequest(logisticsRequestId) {
        const { rows } = await pool.query(
            `SELECT audience, public_id
             FROM logistics_tracking_links
             WHERE logistics_request_id = $1
               AND active = TRUE
               AND (expires_at IS NULL OR expires_at > NOW())`,
            [logisticsRequestId]
        );

        return rows.reduce((links, row) => {
            links[row.audience] = {
                token: this.tokenFor(row.public_id, row.audience),
                path: `/track/${this.tokenFor(row.public_id, row.audience)}`,
                url: this.urlFor(row.public_id, row.audience)
            };
            return links;
        }, {});
    }

    static async getSafeTrackingByToken(token) {
        const { audience, publicId } = parseToken(token);
        const { rows } = await pool.query(
            `SELECT
                l.audience,
                lr.status AS request_status,
                lr.deadline_at AS request_deadline_at,
                lr.completed_at AS request_completed_at,
                po.order_number,
                po.created_at AS order_created_at,
                s.shop_name,
                s.full_name AS seller_name,
                dl.id AS delivery_leg_id,
                dl.status AS delivery_status,
                dl.origin_label AS delivery_origin_label,
                dl.origin_address AS delivery_origin_address,
                dl.destination_label AS delivery_destination_label,
                dl.destination_address AS delivery_destination_address,
                dl.deadline_at AS delivery_deadline_at,
                dl.completed_at AS delivery_completed_at,
                pl.id AS pickup_leg_id,
                pl.status AS pickup_status,
                pl.origin_label AS pickup_origin_label,
                pl.origin_address AS pickup_origin_address,
                pl.destination_label AS pickup_destination_label,
                pl.destination_address AS pickup_destination_address,
                pl.deadline_at AS pickup_deadline_at,
                pl.completed_at AS pickup_completed_at,
                COALESCE(items.items, '[]'::json) AS items,
                COALESCE(events.events, '[]'::json) AS events
             FROM logistics_tracking_links l
             JOIN logistics_requests lr ON lr.id = l.logistics_request_id
             JOIN product_orders po ON po.id = lr.order_id
             LEFT JOIN sellers s ON s.id = po.seller_id
             LEFT JOIN logistics_legs dl ON dl.logistics_request_id = lr.id
                                      AND dl.leg_type = 'delivery'
             LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                                      AND pl.leg_type = 'pickup'
             LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'name', oi.product_name,
                    'quantity', oi.quantity
                ) ORDER BY oi.id) AS items
                FROM order_items oi
                WHERE oi.order_id = po.id
             ) items ON TRUE
             LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'type', e.event_type,
                    'status', e.status,
                    'message', e.message,
                    'source', e.source,
                    'createdAt', e.created_at
                ) ORDER BY e.created_at ASC, e.id ASC) AS events
                FROM logistics_tracking_events e
                WHERE e.logistics_request_id = lr.id
             ) events ON TRUE
             WHERE l.public_id = $1
               AND l.audience = $2
               AND l.active = TRUE
               AND (l.expires_at IS NULL OR l.expires_at > NOW())
             LIMIT 1`,
            [publicId, audience]
        );

        const row = rows[0];
        if (!row || !VISIBLE_REQUEST_STATUSES.has(String(row.request_status || '').toLowerCase())) {
            throw new AppError('Tracking link is invalid or not active yet', 404);
        }

        const delivery = mapSafeLeg(row, 'delivery', audience);
        const pickup = mapSafeLeg(row, 'pickup', audience);
        const eta = delivery?.eta || pickup?.eta || row.request_deadline_at || null;

        return {
            audience,
            orderNumber: row.order_number,
            shopName: row.shop_name || row.seller_name || 'Shop',
            status: row.request_status,
            eta,
            estimate: 'Deliveries are made within 24 hours after payment confirmation.',
            items: parseJsonArray(row.items).map(item => ({
                name: item.name,
                quantity: Number(item.quantity || 1)
            })),
            delivery,
            pickup,
            timeline: parseJsonArray(row.events).map(event => ({
                type: event.type,
                status: event.status,
                message: event.message,
                source: event.source,
                createdAt: event.createdAt
            }))
        };
    }
}

export default LogisticsTrackingLinkService;
