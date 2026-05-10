import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../shared/db/database.js';
import { AppError } from '../shared/utils/errorHandler.js';
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import LogisticsTrackingLinkService from './logisticsTrackingLink.service.js';

const MZIGO_EGO_SLUG = 'mzigo-ego';
const DROPOFF_LOCATION = process.env.DROPOFF_LOCATION || 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32';
const COMPLETED_PAYMENT_STATUSES = new Set(['completed', 'success', 'paid']);
const LOGISTICS_VISIBLE_REQUEST_STATUSES = new Set([
    'active',
    'in_progress',
    'completed',
    'failed',
    'manual_review'
]);

const TIMING_DUMMY_HASH = '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

const LOGISTICS_STATUS_MAP = {
    pickup: {
        pickup_pending: 'pending',
        pickup_assigned: 'assigned',
        pickup_started: 'started',
        picked_up_from_seller: 'picked_up',
        dropped_at_hub: 'dropped_at_hub',
        pickup_failed: 'failed'
    },
    delivery: {
        delivery_pending: 'delivery_pending',
        courier_assigned: 'assigned',
        out_for_delivery: 'out_for_delivery',
        delivered: 'delivered',
        delivery_failed: 'failed',
        delivery_delayed: 'delayed'
    }
};

const LOGISTICS_STATUS_MESSAGES = {
    pickup_pending: 'Pickup is pending.',
    pickup_assigned: 'Pickup was assigned to a courier.',
    pickup_started: 'Pickup has started.',
    picked_up_from_seller: 'Package was picked up from the seller.',
    dropped_at_hub: 'Package was dropped at the hub.',
    pickup_failed: 'Pickup failed.',
    delivery_pending: 'Delivery is pending.',
    courier_assigned: 'Courier was assigned for delivery.',
    out_for_delivery: 'Package is out for delivery.',
    delivered: 'Package was delivered.',
    delivery_failed: 'Delivery failed.',
    delivery_delayed: 'Delivery was delayed.'
};

const ALLOWED_LOGISTICS_TRANSITIONS = {
    pickup: {
        pending: new Set(['assigned', 'failed']),
        assigned: new Set(['started', 'failed']),
        started: new Set(['picked_up', 'failed']),
        picked_up: new Set(['dropped_at_hub', 'failed']),
        dropped_at_hub: new Set([]),
        failed: new Set([])
    },
    delivery: {
        delivery_pending: new Set(['assigned', 'delayed', 'failed']),
        assigned: new Set(['out_for_delivery', 'delayed', 'failed']),
        out_for_delivery: new Set(['delivered', 'delayed', 'failed']),
        delayed: new Set(['assigned', 'out_for_delivery', 'delivered', 'failed']),
        delivered: new Set([]),
        failed: new Set([])
    }
};

const REQUEST_PROGRESS_STATUSES = new Set([
    'assigned',
    'started',
    'picked_up',
    'dropped_at_hub',
    'out_for_delivery',
    'delayed'
]);

const IMPORTANT_LOGISTICS_STATUS_NOTIFICATIONS = new Set([
    'pickup_assigned',
    'picked_up_from_seller',
    'dropped_at_hub',
    'out_for_delivery',
    'delivered',
    'delivery_delayed',
    'delivery_failed',
    'pickup_failed'
]);

const ADMIN_LOGISTICS_STATUS_FILTERS = new Set([
    'all',
    'active',
    'in_progress',
    'completed',
    'failed',
    'delayed',
    'manual_review',
    'overdue'
]);

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeSort(sort) {
    const value = String(sort || 'priority').trim().toLowerCase();
    if (['priority', 'deadline', 'oldest_paid', 'newest_paid'].includes(value)) {
        return value;
    }
    return 'priority';
}

function normalizeAdminStatusFilter(status) {
    const value = String(status || 'all').trim().toLowerCase();
    return ADMIN_LOGISTICS_STATUS_FILTERS.has(value) ? value : 'all';
}

function normalizeLegType(legType) {
    const normalized = String(legType || '').trim().toLowerCase();
    if (!['pickup', 'delivery'].includes(normalized)) {
        throw new AppError('Invalid logistics leg type', 400);
    }
    return normalized;
}

function normalizeRequestedLogisticsStatus(legType, status) {
    const normalized = String(status || '').trim().toLowerCase();
    const mappedStatus = LOGISTICS_STATUS_MAP[legType]?.[normalized];
    if (!mappedStatus) {
        throw new AppError(`Invalid ${legType} status`, 400);
    }

    return {
        externalStatus: normalized,
        internalStatus: mappedStatus
    };
}

function assertValidLegTransition({ legType, currentStatus, targetStatus, paymentComplete = false }) {
    if (currentStatus === 'payment_pending') {
        if (!paymentComplete) {
            throw new AppError('Cannot update logistics status before the logistics fee is paid', 409);
        }

        const initialPaidStatus = legType === 'pickup' ? 'pending' : 'delivery_pending';
        if (targetStatus === initialPaidStatus) return;

        throw new AppError(
            `Invalid ${legType} transition from ${currentStatus} to ${targetStatus}`,
            409
        );
    }

    if (currentStatus === targetStatus) return;

    const allowed = ALLOWED_LOGISTICS_TRANSITIONS[legType]?.[currentStatus];
    if (!allowed || !allowed.has(targetStatus)) {
        throw new AppError(
            `Invalid ${legType} transition from ${currentStatus} to ${targetStatus}`,
            409
        );
    }
}

function timestampAssignments(targetStatus) {
    return {
        assigned_at: targetStatus === 'assigned',
        started_at: ['started', 'out_for_delivery'].includes(targetStatus),
        completed_at: ['dropped_at_hub', 'delivered'].includes(targetStatus),
        failed_at: targetStatus === 'failed'
    };
}

function getOrderBy(sort) {
    switch (normalizeSort(sort)) {
        case 'deadline':
            return `
                COALESCE(pl.deadline_at, dl.deadline_at, lr.deadline_at) ASC NULLS LAST,
                po.paid_at ASC NULLS LAST,
                lr.created_at ASC
            `;
        case 'oldest_paid':
            return `
                po.paid_at ASC NULLS LAST,
                lr.created_at ASC
            `;
        case 'newest_paid':
            return `
                po.paid_at DESC NULLS LAST,
                lr.created_at DESC
            `;
        case 'priority':
        default:
            return `
                CASE
                    WHEN COALESCE(pl.deadline_at, dl.deadline_at, lr.deadline_at) IS NOT NULL
                     AND COALESCE(pl.deadline_at, dl.deadline_at, lr.deadline_at) < NOW()
                     AND lr.status NOT IN ('completed', 'cancelled')
                    THEN 0
                    ELSE 1
                END ASC,
                COALESCE(pl.deadline_at, dl.deadline_at, lr.deadline_at) ASC NULLS LAST,
                po.paid_at ASC NULLS LAST,
                lr.created_at ASC
            `;
    }
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function mapLink(latitude, longitude, address) {
    const lat = parseNumber(latitude);
    const lng = parseNumber(longitude);
    if (lat !== null && lng !== null) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    if (address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return null;
}

function isVisibleLeg(row, prefix) {
    const id = row[`${prefix}_leg_id`];
    if (!id) return false;

    const status = String(row[`${prefix}_status`] || '').toLowerCase();
    const paymentStatus = String(row[`${prefix}_payment_status`] || '').toLowerCase();

    return status !== 'payment_pending' || COMPLETED_PAYMENT_STATUSES.has(paymentStatus);
}

function feeStatus(row, prefix) {
    if (!row[`${prefix}_leg_id`]) return 'not_requested';
    const paymentStatus = String(row[`${prefix}_payment_status`] || '').toLowerCase();
    if (COMPLETED_PAYMENT_STATUSES.has(paymentStatus)) return 'paid';
    return paymentStatus || row[`${prefix}_status`] || 'pending';
}

function mapLeg(row, prefix) {
    if (!isVisibleLeg(row, prefix)) return null;

    const originAddress = row[`${prefix}_origin_address`] || null;
    const destinationAddress = row[`${prefix}_destination_address`] || null;

    return {
        id: row[`${prefix}_leg_id`],
        status: row[`${prefix}_status`],
        feeAmount: parseNumber(row[`${prefix}_fee_amount`]) || 0,
        feeCurrency: row[`${prefix}_fee_currency`] || 'KES',
        feeStatus: feeStatus(row, prefix),
        distanceKm: parseNumber(row[`${prefix}_distance_km`]),
        origin: {
            label: row[`${prefix}_origin_label`] || null,
            address: originAddress,
            latitude: parseNumber(row[`${prefix}_origin_lat`]),
            longitude: parseNumber(row[`${prefix}_origin_lng`]),
            mapLink: mapLink(
                row[`${prefix}_origin_lat`],
                row[`${prefix}_origin_lng`],
                originAddress
            )
        },
        destination: {
            label: row[`${prefix}_destination_label`] || null,
            address: destinationAddress,
            latitude: parseNumber(row[`${prefix}_destination_lat`]),
            longitude: parseNumber(row[`${prefix}_destination_lng`]),
            mapLink: mapLink(
                row[`${prefix}_destination_lat`],
                row[`${prefix}_destination_lng`],
                destinationAddress
            )
        },
        deadlineAt: row[`${prefix}_deadline_at`] || null,
        completedAt: row[`${prefix}_completed_at`] || null
    };
}

function groupType(hasPickup, hasDelivery) {
    if (hasPickup && hasDelivery) return 'pickup_delivery';
    if (hasDelivery) return 'delivery_only';
    if (hasPickup) return 'pickup_only';
    return 'hub_dropoff';
}

function mapRequestRow(row) {
    const hasPickup = isVisibleLeg(row, 'pickup');
    const hasDelivery = isVisibleLeg(row, 'delivery');
    const pickupLeg = mapLeg(row, 'pickup');
    const deliveryLeg = mapLeg(row, 'delivery');
    const deadlineAt = row.pickup_deadline_at
        || row.delivery_deadline_at
        || row.request_deadline_at
        || null;

    return {
        id: row.request_id,
        packageCode: row.package_code,
        group: groupType(hasPickup, hasDelivery),
        status: row.request_status,
        serviceLevel: row.service_level,
        deadlineAt,
        completedAt: row.request_completed_at || null,
        createdAt: row.request_created_at,
        updatedAt: row.request_updated_at,
        isOverdue: Boolean(deadlineAt && new Date(deadlineAt).getTime() < Date.now()
            && !['completed', 'cancelled'].includes(String(row.request_status || '').toLowerCase())),
        partner: row.partner_id ? {
            id: row.partner_id,
            name: row.partner_name || 'Mzigo Ego',
            phone: row.partner_phone || null,
            whatsappNumber: row.partner_whatsapp_number || null
        } : null,
        order: {
            id: row.order_id,
            orderNumber: row.order_number,
            totalAmount: parseNumber(row.total_amount) || 0,
            paymentStatus: row.order_payment_status,
            status: row.order_status || null,
            paidAt: row.paid_at,
            createdAt: row.order_created_at
        },
        product: {
            items: row.items || [],
            summary: (row.items || [])
                .map(item => `${item.name} x${item.quantity}`)
                .join(', ')
        },
        seller: {
            id: row.seller_id,
            name: row.seller_name,
            shopName: row.shop_name,
            phone: row.seller_phone,
            physicalAddress: row.seller_physical_address,
            location: row.seller_location,
            mapLink: mapLink(row.seller_latitude, row.seller_longitude, row.seller_physical_address || row.seller_location)
        },
        buyer: {
            name: row.buyer_profile_name || row.buyer_name,
            email: row.buyer_email,
            phone: row.buyer_profile_phone || row.buyer_whatsapp_number || row.buyer_mobile_payment
        },
        pickupLeg,
        deliveryLeg,
        pickupFeeStatus: pickupLeg?.feeStatus || 'not_requested',
        deliveryFeeStatus: deliveryLeg?.feeStatus || 'not_requested',
        sellerDropoff: {
            address: pickupLeg?.destination?.address || deliveryLeg?.origin?.address || DROPOFF_LOCATION,
            label: pickupLeg?.destination?.label || deliveryLeg?.origin?.label || 'Hub drop-off',
            mapLink: pickupLeg?.destination?.mapLink || deliveryLeg?.origin?.mapLink || null
        },
        events: row.events || [],
        dispute: row.dispute || null
    };
}

function groupRequests(requests) {
    return {
        pickupDelivery: requests.filter(request => request.group === 'pickup_delivery'),
        deliveryOnly: requests.filter(request => request.group === 'delivery_only'),
        pickupOnly: requests.filter(request => request.group === 'pickup_only'),
        hubDropoff: requests.filter(request => request.group === 'hub_dropoff')
    };
}

function signLogisticsToken(account) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    return jwt.sign(
        {
            id: account.partner_id,
            partnerId: account.partner_id,
            partnerSlug: account.partner_slug,
            userId: account.user_id,
            role: 'logistics',
            email: account.email
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.LOGISTICS_JWT_EXPIRES_IN || '12h' }
    );
}

class LogisticsDashboardService {
    static async findAccountByEmail(email, client = pool) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return null;

        const { rows } = await client.query(
            `SELECT
                lp.id AS partner_id,
                lp.name AS partner_name,
                lp.slug AS partner_slug,
                lp.active AS partner_active,
                lp.email AS partner_email,
                lp.phone AS partner_phone,
                lp.whatsapp_number AS partner_whatsapp_number,
                u.id AS user_id,
                u.email,
                u.password_hash,
                u.is_active,
                u.is_verified,
                u.password_changed_at
             FROM users u
             JOIN logistics_partners lp ON lp.user_id = u.id
             WHERE LOWER(u.email) = $1
               AND u.role = 'logistics'
               AND lp.active = TRUE
             LIMIT 1`,
            [normalizedEmail]
        );

        return rows[0] || null;
    }

    static async bootstrapMzigoAccountIfConfigured(email, password) {
        const normalizedEmail = normalizeEmail(email);
        const configuredEmail = normalizeEmail(process.env.MZIGO_EGO_EMAIL);
        const configuredPassword = process.env.MZIGO_EGO_PASSWORD || '';

        if (!configuredEmail || !configuredPassword) return null;
        if (normalizedEmail !== configuredEmail || password !== configuredPassword) return null;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let notificationEvent = null;

            await client.query(
                `INSERT INTO roles (name, slug)
                 VALUES ('Logistics', 'logistics')
                 ON CONFLICT (slug) DO NOTHING`
            );

            const passwordHash = await bcrypt.hash(password, 12);
            const { rows: existingUsers } = await client.query(
                `SELECT id, email, role
                 FROM users
                 WHERE LOWER(email) = $1
                 FOR UPDATE`,
                [normalizedEmail]
            );

            if (existingUsers[0] && existingUsers[0].role !== 'logistics') {
                throw new AppError('Configured logistics email is already used by another account', 409);
            }

            const { rows: userRows } = existingUsers[0]
                ? await client.query(
                    `UPDATE users
                     SET password_hash = $2,
                         is_verified = TRUE,
                         updated_at = NOW()
                     WHERE id = $1
                     RETURNING id, email, password_hash, is_active, is_verified`,
                    [existingUsers[0].id, passwordHash]
                )
                : await client.query(
                    `INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
                     VALUES ($1, $2, 'logistics', TRUE, NOW(), NOW())
                     RETURNING id, email, password_hash, is_active, is_verified`,
                    [normalizedEmail, passwordHash]
                );
            const user = userRows[0];

            const { rows: partnerRows } = await client.query(
                `INSERT INTO logistics_partners
                    (user_id, name, slug, email, active, metadata, created_at, updated_at)
                 VALUES ($1, 'Mzigo Ego', $2, $3, TRUE, $4::jsonb, NOW(), NOW())
                 ON CONFLICT (slug)
                 DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    email = COALESCE(logistics_partners.email, EXCLUDED.email),
                    active = TRUE,
                    metadata = logistics_partners.metadata || EXCLUDED.metadata,
                    updated_at = NOW()
                 RETURNING id AS partner_id,
                           name AS partner_name,
                           slug AS partner_slug,
                           active AS partner_active,
                           email AS partner_email,
                           phone AS partner_phone,
                           whatsapp_number AS partner_whatsapp_number`,
                [
                    user.id,
                    MZIGO_EGO_SLUG,
                    normalizedEmail,
                    JSON.stringify({ credentials_bootstrapped_from_env: true })
                ]
            );

            await client.query('COMMIT');

            return {
                ...partnerRows[0],
                user_id: user.id,
                email: user.email,
                password_hash: user.password_hash,
                is_active: user.is_active,
                is_verified: user.is_verified
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    static async login({ email, password }) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !password) {
            throw new AppError('Please provide email and password', 400);
        }

        let account = await this.findAccountByEmail(normalizedEmail);
        let hashToCompare = account?.password_hash || TIMING_DUMMY_HASH;
        let isMatch = await bcrypt.compare(password, hashToCompare);

        if (!account || !isMatch) {
            const bootstrapped = await this.bootstrapMzigoAccountIfConfigured(normalizedEmail, password);
            if (bootstrapped) {
                account = bootstrapped;
                hashToCompare = account.password_hash;
                isMatch = await bcrypt.compare(password, hashToCompare);
            }
        }

        if (!account || !isMatch) {
            throw new AppError('Invalid email or password', 401);
        }

        if (account.is_active === false || account.partner_active === false) {
            throw new AppError('This logistics account is not active', 403);
        }

        await pool.query(
            `UPDATE users
             SET last_login = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [account.user_id]
        );

        const token = signLogisticsToken(account);
        return {
            token,
            partner: {
                id: account.partner_id,
                name: account.partner_name,
                slug: account.partner_slug,
                email: account.partner_email || account.email,
                phone: account.partner_phone,
                whatsappNumber: account.partner_whatsapp_number
            }
        };
    }

    static async getPartnerByTokenPayload(payload) {
        const partnerId = payload?.partnerId || payload?.id;
        const userId = payload?.userId || null;

        if (!partnerId) {
            throw new AppError('Invalid logistics token', 401);
        }

        const params = [partnerId];
        let userFilter = '';
        if (userId) {
            params.push(userId);
            userFilter = `AND u.id = $2`;
        }

        const { rows } = await pool.query(
            `SELECT
                lp.id,
                lp.name,
                lp.slug,
                lp.email,
                lp.phone,
                lp.whatsapp_number,
                lp.active,
                u.id AS user_id,
                u.email AS user_email,
                u.is_active AS user_active
             FROM logistics_partners lp
             LEFT JOIN users u ON u.id = lp.user_id
             WHERE lp.id = $1
               AND lp.active = TRUE
               ${userFilter}
             LIMIT 1`,
            params
        );

        const partner = rows[0];
        if (!partner || partner.user_active === false) {
            throw new AppError('The logistics account for this token is no longer active', 401);
        }

        return {
            id: partner.id,
            name: partner.name,
            slug: partner.slug,
            email: partner.email || partner.user_email,
            phone: partner.phone,
            whatsappNumber: partner.whatsapp_number,
            userId: partner.user_id
        };
    }

    static async reconcileRequestStatusLocked(client, requestId) {
        const { rows: legs } = await client.query(
            `SELECT leg_type, status
             FROM logistics_legs
             WHERE logistics_request_id = $1
               AND status <> 'payment_pending'
             FOR UPDATE`,
            [requestId]
        );

        if (legs.length === 0) {
            const { rows } = await client.query(
                `UPDATE logistics_requests
                 SET status = 'payment_pending',
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING status, completed_at`,
                [requestId]
            );
            return rows[0];
        }

        let nextStatus = 'active';
        const hasFailedLeg = legs.some(leg => leg.status === 'failed');
        const allComplete = legs.every(leg => {
            if (leg.leg_type === 'pickup') return leg.status === 'dropped_at_hub';
            if (leg.leg_type === 'delivery') return leg.status === 'delivered';
            return false;
        });
        const hasProgress = legs.some(leg => REQUEST_PROGRESS_STATUSES.has(leg.status));

        if (hasFailedLeg) {
            nextStatus = 'failed';
        } else if (allComplete) {
            nextStatus = 'completed';
        } else if (hasProgress) {
            nextStatus = 'in_progress';
        }

        const { rows } = await client.query(
            `UPDATE logistics_requests
             SET status = $2,
                 completed_at = CASE
                    WHEN $2 = 'completed' THEN COALESCE(completed_at, NOW())
                    ELSE completed_at
                 END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING status, completed_at`,
            [requestId, nextStatus]
        );

        return rows[0];
    }

    static async updateLegStatus({
        partner,
        partnerId,
        requestId,
        legType,
        status
    }) {
        const normalizedLegType = normalizeLegType(legType);
        const { externalStatus, internalStatus } = normalizeRequestedLogisticsStatus(
            normalizedLegType,
            status
        );
        const safeRequestId = Number(requestId);
        if (!Number.isInteger(safeRequestId) || safeRequestId <= 0) {
            throw new AppError('Invalid logistics request id', 400);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let notificationEvent = null;

            const { rows } = await client.query(
                `SELECT
                    lr.id AS request_id,
                    lr.order_id,
                    lr.status AS request_status,
                    ll.id AS leg_id,
                    ll.leg_type,
                    ll.status AS leg_status,
                    ll.payment_id,
                    p.status AS payment_status
                 FROM logistics_requests lr
                 JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
                                      AND ll.leg_type = $3
                 LEFT JOIN payments p ON p.id = ll.payment_id
                 WHERE lr.id = $1
                   AND lr.partner_id = $2
                 FOR UPDATE OF lr, ll`,
                [safeRequestId, partnerId, normalizedLegType]
            );

            const record = rows[0];
            if (!record) {
                throw new AppError('Logistics leg not found for this partner', 404);
            }

            const paymentStatus = String(record.payment_status || '').toLowerCase();
            if (record.leg_status === 'payment_pending' && !COMPLETED_PAYMENT_STATUSES.has(paymentStatus)) {
                throw new AppError('Cannot update an unpaid logistics leg', 409);
            }

            assertValidLegTransition({
                legType: normalizedLegType,
                currentStatus: record.leg_status,
                targetStatus: internalStatus,
                paymentComplete: COMPLETED_PAYMENT_STATUSES.has(paymentStatus)
            });

            if (record.leg_status === internalStatus) {
                await client.query('COMMIT');
                return {
                    updated: false,
                    requestId: record.request_id,
                    legId: record.leg_id,
                    legType: normalizedLegType,
                    previousStatus: record.leg_status,
                    status: internalStatus,
                    externalStatus,
                    logisticsStatus: record.request_status
                };
            }

            const timestamps = timestampAssignments(internalStatus);

            const { rows: updatedLegRows } = await client.query(
                `UPDATE logistics_legs
                 SET status = $2,
                     assigned_at = CASE WHEN $3 THEN COALESCE(assigned_at, NOW()) ELSE assigned_at END,
                     started_at = CASE WHEN $4 THEN COALESCE(started_at, NOW()) ELSE started_at END,
                     completed_at = CASE WHEN $5 THEN NOW() ELSE completed_at END,
                     failed_at = CASE WHEN $6 THEN NOW() ELSE failed_at END,
                     metadata = metadata || $7::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, status, updated_at`,
                [
                    record.leg_id,
                    internalStatus,
                    timestamps.assigned_at,
                    timestamps.started_at,
                    timestamps.completed_at,
                    timestamps.failed_at,
                    JSON.stringify({
                        last_mzigo_status_update: {
                            from: record.leg_status,
                            to: internalStatus,
                            external_status: externalStatus,
                            updated_at: new Date().toISOString()
                        }
                    })
                ]
            );
            const updatedLeg = updatedLegRows[0];

            const requestStatus = await this.reconcileRequestStatusLocked(client, record.request_id);

            await client.query(
                `INSERT INTO logistics_tracking_events
                    (
                        logistics_request_id,
                        logistics_leg_id,
                        event_type,
                        status,
                        message,
                        source,
                        actor_user_id,
                        actor_label,
                        metadata
                    )
                 VALUES ($1, $2, $3, $4, $5, 'mzigo', $6, $7, $8::jsonb)`,
                [
                    record.request_id,
                    record.leg_id,
                    `${normalizedLegType}.status_updated`,
                    internalStatus,
                    LOGISTICS_STATUS_MESSAGES[externalStatus] || `${normalizedLegType} status updated.`,
                    partner?.userId || null,
                    partner?.name || 'Mzigo Ego',
                    JSON.stringify({
                        order_id: record.order_id,
                        partner_id: partnerId,
                        previous_status: record.leg_status,
                        status: internalStatus,
                        external_status: externalStatus
                    })
                ]
            );

            if (IMPORTANT_LOGISTICS_STATUS_NOTIFICATIONS.has(externalStatus)) {
                await LogisticsTrackingLinkService.ensureLinksForRequest(client, record.request_id);
                notificationEvent = await eventBus.enqueueInTransaction(client, AppEvents.LOGISTICS.NOTIFICATION, {
                    eventId: `logistics.notification.${externalStatus}:${record.request_id}:${record.leg_id}`,
                    notificationType: externalStatus,
                    requestId: record.request_id,
                    legId: record.leg_id,
                    legType: normalizedLegType,
                    orderId: record.order_id,
                    previousStatus: record.leg_status,
                    status: internalStatus,
                    source: 'mzigo'
                });
            }

            await client.query('COMMIT');
            eventBus.dispatchAfterCommit(notificationEvent?.eventId, 'LogisticsStatusNotification');

            return {
                updated: true,
                requestId: record.request_id,
                legId: record.leg_id,
                legType: normalizedLegType,
                previousStatus: record.leg_status,
                status: updatedLeg.status,
                externalStatus,
                logisticsStatus: requestStatus?.status || record.request_status,
                logisticsCompletedAt: requestStatus?.completed_at || null,
                updatedAt: updatedLeg.updated_at
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    static async adminUpdateLegStatus({
        admin,
        requestId,
        legType,
        status,
        reason = null
    }) {
        const normalizedLegType = normalizeLegType(legType);
        const { externalStatus, internalStatus } = normalizeRequestedLogisticsStatus(
            normalizedLegType,
            status
        );
        const safeRequestId = Number(requestId);
        if (!Number.isInteger(safeRequestId) || safeRequestId <= 0) {
            throw new AppError('Invalid logistics request id', 400);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let notificationEvent = null;

            const { rows } = await client.query(
                `SELECT
                    lr.id AS request_id,
                    lr.order_id,
                    lr.status AS request_status,
                    lr.partner_id,
                    ll.id AS leg_id,
                    ll.leg_type,
                    ll.status AS leg_status,
                    ll.payment_id,
                    p.status AS payment_status
                 FROM logistics_requests lr
                 JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
                                      AND ll.leg_type = $2
                 LEFT JOIN payments p ON p.id = ll.payment_id
                 WHERE lr.id = $1
                 FOR UPDATE OF lr, ll`,
                [safeRequestId, normalizedLegType]
            );

            const record = rows[0];
            if (!record) {
                throw new AppError('Logistics leg not found', 404);
            }

            const paymentStatus = String(record.payment_status || '').toLowerCase();
            if (record.leg_status === 'payment_pending' && !COMPLETED_PAYMENT_STATUSES.has(paymentStatus)) {
                throw new AppError('Cannot update an unpaid logistics leg', 409);
            }

            assertValidLegTransition({
                legType: normalizedLegType,
                currentStatus: record.leg_status,
                targetStatus: internalStatus,
                paymentComplete: COMPLETED_PAYMENT_STATUSES.has(paymentStatus)
            });

            if (record.leg_status === internalStatus) {
                await client.query(
                    `INSERT INTO logistics_tracking_events
                        (
                            logistics_request_id,
                            logistics_leg_id,
                            event_type,
                            status,
                            message,
                            source,
                            actor_user_id,
                            actor_label,
                            metadata
                        )
                     VALUES ($1, $2, 'admin.status_reviewed', $3, $4, 'admin', $5, $6, $7::jsonb)`,
                    [
                        record.request_id,
                        record.leg_id,
                        internalStatus,
                        reason || `Admin reviewed ${normalizedLegType} status; no change was required.`,
                        admin?.id || null,
                        admin?.email || 'Admin',
                        JSON.stringify({
                            previous_status: record.leg_status,
                            status: internalStatus,
                            external_status: externalStatus,
                            no_state_change: true
                        })
                    ]
                );

                await client.query('COMMIT');
                return {
                    updated: false,
                    requestId: record.request_id,
                    legId: record.leg_id,
                    legType: normalizedLegType,
                    previousStatus: record.leg_status,
                    status: internalStatus,
                    externalStatus,
                    logisticsStatus: record.request_status
                };
            }

            const timestamps = timestampAssignments(internalStatus);

            const { rows: updatedLegRows } = await client.query(
                `UPDATE logistics_legs
                 SET status = $2,
                     assigned_at = CASE WHEN $3 THEN COALESCE(assigned_at, NOW()) ELSE assigned_at END,
                     started_at = CASE WHEN $4 THEN COALESCE(started_at, NOW()) ELSE started_at END,
                     completed_at = CASE WHEN $5 THEN NOW() ELSE completed_at END,
                     failed_at = CASE WHEN $6 THEN NOW() ELSE failed_at END,
                     metadata = metadata || $7::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, status, updated_at`,
                [
                    record.leg_id,
                    internalStatus,
                    timestamps.assigned_at,
                    timestamps.started_at,
                    timestamps.completed_at,
                    timestamps.failed_at,
                    JSON.stringify({
                        last_admin_status_override: {
                            from: record.leg_status,
                            to: internalStatus,
                            external_status: externalStatus,
                            reason,
                            admin_id: admin?.id || null,
                            updated_at: new Date().toISOString()
                        }
                    })
                ]
            );
            const updatedLeg = updatedLegRows[0];
            const requestStatus = await this.reconcileRequestStatusLocked(client, record.request_id);

            await client.query(
                `INSERT INTO logistics_tracking_events
                    (
                        logistics_request_id,
                        logistics_leg_id,
                        event_type,
                        status,
                        message,
                        source,
                        actor_user_id,
                        actor_label,
                        metadata
                    )
                 VALUES ($1, $2, 'admin.status_override', $3, $4, 'admin', $5, $6, $7::jsonb)`,
                [
                    record.request_id,
                    record.leg_id,
                    internalStatus,
                    reason || LOGISTICS_STATUS_MESSAGES[externalStatus] || `${normalizedLegType} status updated by admin.`,
                    admin?.id || null,
                    admin?.email || 'Admin',
                    JSON.stringify({
                        order_id: record.order_id,
                        partner_id: record.partner_id,
                        previous_status: record.leg_status,
                        status: internalStatus,
                        external_status: externalStatus,
                        admin_override: true
                    })
                ]
            );

            if (IMPORTANT_LOGISTICS_STATUS_NOTIFICATIONS.has(externalStatus)) {
                await LogisticsTrackingLinkService.ensureLinksForRequest(client, record.request_id);
                notificationEvent = await eventBus.enqueueInTransaction(client, AppEvents.LOGISTICS.NOTIFICATION, {
                    eventId: `logistics.notification.${externalStatus}:${record.request_id}:${record.leg_id}:admin`,
                    notificationType: externalStatus,
                    requestId: record.request_id,
                    legId: record.leg_id,
                    legType: normalizedLegType,
                    orderId: record.order_id,
                    previousStatus: record.leg_status,
                    status: internalStatus,
                    source: 'admin'
                });
            }

            await client.query('COMMIT');
            eventBus.dispatchAfterCommit(notificationEvent?.eventId, 'AdminLogisticsStatusNotification');

            return {
                updated: true,
                requestId: record.request_id,
                legId: record.leg_id,
                legType: normalizedLegType,
                previousStatus: record.leg_status,
                status: updatedLeg.status,
                externalStatus,
                logisticsStatus: requestStatus?.status || record.request_status,
                logisticsCompletedAt: requestStatus?.completed_at || null,
                updatedAt: updatedLeg.updated_at
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    static async adminResolveDispute({
        admin,
        requestId,
        resolution,
        note = null
    }) {
        const safeRequestId = Number(requestId);
        if (!Number.isInteger(safeRequestId) || safeRequestId <= 0) {
            throw new AppError('Invalid logistics request id', 400);
        }

        const normalizedResolution = String(resolution || '').trim().toLowerCase();
        if (!['manual_review', 'continue_delivery', 'mark_failed', 'resolved'].includes(normalizedResolution)) {
            throw new AppError('Invalid logistics dispute resolution', 400);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `SELECT id, order_id, status, metadata
                 FROM logistics_requests
                 WHERE id = $1
                 FOR UPDATE`,
                [safeRequestId]
            );
            const request = rows[0];
            if (!request) {
                throw new AppError('Logistics request not found', 404);
            }

            let nextStatus = request.status;
            if (normalizedResolution === 'manual_review') nextStatus = 'manual_review';
            if (normalizedResolution === 'continue_delivery') nextStatus = 'active';
            if (normalizedResolution === 'mark_failed') nextStatus = 'failed';

            await client.query(
                `UPDATE logistics_requests
                 SET status = $2,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [
                    safeRequestId,
                    nextStatus,
                    JSON.stringify({
                        admin_dispute_resolution: {
                            resolution: normalizedResolution,
                            note,
                            admin_id: admin?.id || null,
                            updated_at: new Date().toISOString()
                        }
                    })
                ]
            );

            await client.query(
                `INSERT INTO logistics_tracking_events
                    (
                        logistics_request_id,
                        event_type,
                        status,
                        message,
                        source,
                        actor_user_id,
                        actor_label,
                        metadata
                    )
                 VALUES ($1, 'admin.dispute_resolved', $2, $3, 'admin', $4, $5, $6::jsonb)`,
                [
                    safeRequestId,
                    nextStatus,
                    note || `Admin dispute resolution: ${normalizedResolution.replace(/_/g, ' ')}`,
                    admin?.id || null,
                    admin?.email || 'Admin',
                    JSON.stringify({
                        order_id: request.order_id,
                        previous_status: request.status,
                        status: nextStatus,
                        resolution: normalizedResolution
                    })
                ]
            );

            await client.query('COMMIT');
            return {
                requestId: safeRequestId,
                previousStatus: request.status,
                status: nextStatus,
                resolution: normalizedResolution
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    static async getDashboardRequests({ partnerId, sort = 'priority', limit = 100, offset = 0 }) {
        const normalizedSort = normalizeSort(sort);
        const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
        const safeOffset = Math.max(Number(offset) || 0, 0);
        const orderBy = getOrderBy(normalizedSort);

        const { rows } = await pool.query(
            `SELECT
                lr.id AS request_id,
                lr.package_code,
                lr.status AS request_status,
                lr.service_level,
                lr.deadline_at AS request_deadline_at,
                lr.completed_at AS request_completed_at,
                lr.created_at AS request_created_at,
                lr.updated_at AS request_updated_at,

                po.id AS order_id,
                po.order_number,
                po.total_amount,
                po.payment_status AS order_payment_status,
                po.paid_at,
                po.created_at AS order_created_at,
                po.buyer_name,
                po.buyer_email,
                po.buyer_mobile_payment,
                po.buyer_whatsapp_number,

                s.id AS seller_id,
                s.full_name AS seller_name,
                s.shop_name,
                s.whatsapp_number AS seller_phone,
                s.physical_address AS seller_physical_address,
                s.location AS seller_location,
                s.latitude AS seller_latitude,
                s.longitude AS seller_longitude,

                b.full_name AS buyer_profile_name,
                b.whatsapp_number AS buyer_profile_phone,

                pl.id AS pickup_leg_id,
                pl.status AS pickup_status,
                pl.fee_amount AS pickup_fee_amount,
                pl.fee_currency AS pickup_fee_currency,
                pl.distance_km AS pickup_distance_km,
                pl.origin_label AS pickup_origin_label,
                pl.origin_address AS pickup_origin_address,
                pl.origin_lat AS pickup_origin_lat,
                pl.origin_lng AS pickup_origin_lng,
                pl.destination_label AS pickup_destination_label,
                pl.destination_address AS pickup_destination_address,
                pl.destination_lat AS pickup_destination_lat,
                pl.destination_lng AS pickup_destination_lng,
                pl.deadline_at AS pickup_deadline_at,
                pl.completed_at AS pickup_completed_at,
                pp.status AS pickup_payment_status,

                dl.id AS delivery_leg_id,
                dl.status AS delivery_status,
                dl.fee_amount AS delivery_fee_amount,
                dl.fee_currency AS delivery_fee_currency,
                dl.distance_km AS delivery_distance_km,
                dl.origin_label AS delivery_origin_label,
                dl.origin_address AS delivery_origin_address,
                dl.origin_lat AS delivery_origin_lat,
                dl.origin_lng AS delivery_origin_lng,
                dl.destination_label AS delivery_destination_label,
                dl.destination_address AS delivery_destination_address,
                dl.destination_lat AS delivery_destination_lat,
                dl.destination_lng AS delivery_destination_lng,
                dl.deadline_at AS delivery_deadline_at,
                dl.completed_at AS delivery_completed_at,
                dp.status AS delivery_payment_status,

                COALESCE(items.items, '[]'::json) AS items,
                COALESCE(events.events, '[]'::json) AS events
             FROM logistics_requests lr
             JOIN product_orders po ON po.id = lr.order_id
             LEFT JOIN sellers s ON s.id = po.seller_id
             LEFT JOIN buyers b ON b.id = po.buyer_id
             LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                                      AND pl.leg_type = 'pickup'
             LEFT JOIN payments pp ON pp.id = pl.payment_id
             LEFT JOIN logistics_legs dl ON dl.logistics_request_id = lr.id
                                      AND dl.leg_type = 'delivery'
             LEFT JOIN payments dp ON dp.id = dl.payment_id
             LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'id', oi.id,
                    'productId', oi.product_id,
                    'name', oi.product_name,
                    'price', oi.product_price,
                    'quantity', oi.quantity,
                    'subtotal', oi.subtotal,
                    'imageUrl', p.image_url,
                    'productType', p.product_type
                ) ORDER BY oi.id) AS items
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = po.id
             ) items ON TRUE
             LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'id', e.id,
                    'type', e.event_type,
                    'status', e.status,
                    'message', e.message,
                    'source', e.source,
                    'createdAt', e.created_at
                ) ORDER BY e.created_at DESC, e.id DESC) AS events
                FROM (
                    SELECT id, event_type, status, message, source, created_at
                    FROM logistics_tracking_events
                    WHERE logistics_request_id = lr.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 8
                ) e
             ) events ON TRUE
             WHERE lr.partner_id = $1
               AND lr.status = ANY($2::text[])
               AND (
                    (pl.id IS NOT NULL AND (pl.status <> 'payment_pending' OR pp.status::text = ANY($3::text[])))
                 OR (dl.id IS NOT NULL AND (dl.status <> 'payment_pending' OR dp.status::text = ANY($3::text[])))
                 OR (pl.id IS NULL AND dl.id IS NULL AND lr.metadata->>'seller_handoff_method' = 'seller_dropoff')
               )
             ORDER BY ${orderBy}
             LIMIT $4 OFFSET $5`,
            [
                partnerId,
                [...LOGISTICS_VISIBLE_REQUEST_STATUSES],
                [...COMPLETED_PAYMENT_STATUSES],
                safeLimit,
                safeOffset
            ]
        );

        const requests = rows.map(mapRequestRow);
        const groups = groupRequests(requests);

        logger.debug('[LOGISTICS] Dashboard requests fetched', {
            partnerId,
            sort: normalizedSort,
            count: requests.length
        });

        return {
            sort: normalizedSort,
            count: requests.length,
            requests,
            groups
        };
    }

    static async getAdminRequests({ status = 'all', sort = 'priority', limit = 100, offset = 0 }) {
        const normalizedStatus = normalizeAdminStatusFilter(status);
        const normalizedSort = normalizeSort(sort);
        const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
        const safeOffset = Math.max(Number(offset) || 0, 0);
        const orderBy = getOrderBy(normalizedSort);
        const params = [
            [...LOGISTICS_VISIBLE_REQUEST_STATUSES],
            [...COMPLETED_PAYMENT_STATUSES]
        ];

        const filters = [
            `lr.status = ANY($1::text[])`,
            `(
                (pl.id IS NOT NULL AND (pl.status <> 'payment_pending' OR pp.status::text = ANY($2::text[])))
             OR (dl.id IS NOT NULL AND (dl.status <> 'payment_pending' OR dp.status::text = ANY($2::text[])))
             OR (pl.id IS NULL AND dl.id IS NULL AND lr.metadata->>'seller_handoff_method' = 'seller_dropoff')
            )`
        ];

        if (normalizedStatus === 'failed') {
            filters.push(`(lr.status = 'failed' OR pl.status = 'failed' OR dl.status = 'failed')`);
        } else if (normalizedStatus === 'delayed') {
            filters.push(`(pl.status = 'delayed' OR dl.status = 'delayed')`);
        } else if (normalizedStatus === 'manual_review') {
            filters.push(`(lr.status = 'manual_review' OR lr.metadata->'admin_dispute_resolution'->>'resolution' = 'manual_review')`);
        } else if (normalizedStatus === 'overdue') {
            filters.push(`COALESCE(pl.deadline_at, dl.deadline_at, lr.deadline_at) < NOW()`);
            filters.push(`lr.status NOT IN ('completed', 'cancelled')`);
        } else if (normalizedStatus !== 'all') {
            params.push(normalizedStatus);
            filters.push(`lr.status = $${params.length}`);
        }

        params.push(safeLimit, safeOffset);
        const limitParam = params.length - 1;
        const offsetParam = params.length;

        const { rows } = await pool.query(
            `SELECT
                lr.id AS request_id,
                lr.package_code,
                lr.status AS request_status,
                lr.service_level,
                lr.deadline_at AS request_deadline_at,
                lr.completed_at AS request_completed_at,
                lr.created_at AS request_created_at,
                lr.updated_at AS request_updated_at,
                lr.metadata->'admin_dispute_resolution' AS dispute,

                lp.id AS partner_id,
                lp.name AS partner_name,
                lp.phone AS partner_phone,
                lp.whatsapp_number AS partner_whatsapp_number,

                po.id AS order_id,
                po.order_number,
                po.total_amount,
                po.payment_status AS order_payment_status,
                po.status AS order_status,
                po.paid_at,
                po.created_at AS order_created_at,
                po.buyer_name,
                po.buyer_email,
                po.buyer_mobile_payment,
                po.buyer_whatsapp_number,

                s.id AS seller_id,
                s.full_name AS seller_name,
                s.shop_name,
                s.whatsapp_number AS seller_phone,
                s.physical_address AS seller_physical_address,
                s.location AS seller_location,
                s.latitude AS seller_latitude,
                s.longitude AS seller_longitude,

                b.full_name AS buyer_profile_name,
                b.whatsapp_number AS buyer_profile_phone,

                pl.id AS pickup_leg_id,
                pl.status AS pickup_status,
                pl.fee_amount AS pickup_fee_amount,
                pl.fee_currency AS pickup_fee_currency,
                pl.distance_km AS pickup_distance_km,
                pl.origin_label AS pickup_origin_label,
                pl.origin_address AS pickup_origin_address,
                pl.origin_lat AS pickup_origin_lat,
                pl.origin_lng AS pickup_origin_lng,
                pl.destination_label AS pickup_destination_label,
                pl.destination_address AS pickup_destination_address,
                pl.destination_lat AS pickup_destination_lat,
                pl.destination_lng AS pickup_destination_lng,
                pl.deadline_at AS pickup_deadline_at,
                pl.completed_at AS pickup_completed_at,
                pp.status AS pickup_payment_status,

                dl.id AS delivery_leg_id,
                dl.status AS delivery_status,
                dl.fee_amount AS delivery_fee_amount,
                dl.fee_currency AS delivery_fee_currency,
                dl.distance_km AS delivery_distance_km,
                dl.origin_label AS delivery_origin_label,
                dl.origin_address AS delivery_origin_address,
                dl.origin_lat AS delivery_origin_lat,
                dl.origin_lng AS delivery_origin_lng,
                dl.destination_label AS delivery_destination_label,
                dl.destination_address AS delivery_destination_address,
                dl.destination_lat AS delivery_destination_lat,
                dl.destination_lng AS delivery_destination_lng,
                dl.deadline_at AS delivery_deadline_at,
                dl.completed_at AS delivery_completed_at,
                dp.status AS delivery_payment_status,

                COALESCE(items.items, '[]'::json) AS items,
                COALESCE(events.events, '[]'::json) AS events
             FROM logistics_requests lr
             JOIN logistics_partners lp ON lp.id = lr.partner_id
             JOIN product_orders po ON po.id = lr.order_id
             LEFT JOIN sellers s ON s.id = po.seller_id
             LEFT JOIN buyers b ON b.id = po.buyer_id
             LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                                      AND pl.leg_type = 'pickup'
             LEFT JOIN payments pp ON pp.id = pl.payment_id
             LEFT JOIN logistics_legs dl ON dl.logistics_request_id = lr.id
                                      AND dl.leg_type = 'delivery'
             LEFT JOIN payments dp ON dp.id = dl.payment_id
             LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'id', oi.id,
                    'productId', oi.product_id,
                    'name', oi.product_name,
                    'price', oi.product_price,
                    'quantity', oi.quantity,
                    'subtotal', oi.subtotal,
                    'imageUrl', p.image_url,
                    'productType', p.product_type
                ) ORDER BY oi.id) AS items
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = po.id
             ) items ON TRUE
             LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'id', e.id,
                    'type', e.event_type,
                    'status', e.status,
                    'message', e.message,
                    'source', e.source,
                    'actorLabel', e.actor_label,
                    'createdAt', e.created_at
                ) ORDER BY e.created_at DESC, e.id DESC) AS events
                FROM (
                    SELECT id, event_type, status, message, source, actor_label, created_at
                    FROM logistics_tracking_events
                    WHERE logistics_request_id = lr.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 40
                ) e
             ) events ON TRUE
             WHERE ${filters.join('\n               AND ')}
             ORDER BY ${orderBy}
             LIMIT $${limitParam} OFFSET $${offsetParam}`,
            params
        );

        const requests = rows.map(mapRequestRow);
        const groups = groupRequests(requests);

        return {
            sort: normalizedSort,
            status: normalizedStatus,
            count: requests.length,
            summary: {
                failed: requests.filter(request =>
                    request.status === 'failed'
                    || request.pickupLeg?.status === 'failed'
                    || request.deliveryLeg?.status === 'failed'
                ).length,
                delayed: requests.filter(request =>
                    request.pickupLeg?.status === 'delayed'
                    || request.deliveryLeg?.status === 'delayed'
                ).length,
                manualReview: requests.filter(request => request.status === 'manual_review').length
            },
            requests,
            groups
        };
    }
}

export default LogisticsDashboardService;
