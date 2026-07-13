// Pure helpers + constants extracted verbatim from logisticsDashboard.service.js
// (Phase 15.7). No behavior change: definitions moved as-is; the service now
// imports them. Isolating these keeps the god-service focused on orchestration.

import jwt from 'jsonwebtoken';
import { AppError } from '../shared/utils/errorHandler.js';

const MZIGO_EGO_SLUG = 'mzigo-ego';
const DROPOFF_LOCATION = process.env.DROPOFF_LOCATION || 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32';
const COMPLETED_PAYMENT_STATUSES = new Set(['completed', 'success', 'paid']);
const COMPLETED_ORDER_STATUSES = new Set(['COMPLETED']);
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

async function markOrderReadyForBuyerAfterDeliveredLeg(client, orderId, source) {
    const { rows } = await client.query(
        `UPDATE product_orders
         SET status = 'READY_FOR_BUYER',
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
           AND status IN (
               'PAID',
               'AWAITING_SELLER_ACTION',
               'FULFILLING',
               'PROCESSING',
               'DELIVERY_PENDING',
               'DELIVERY_COMPLETE',
               'COLLECTION_PENDING',
               'CONFIRMED'
           )
         RETURNING id, status`,
        [
            orderId,
            JSON.stringify({
                logistics_delivery_ready_for_buyer: {
                    source,
                    updated_at: new Date().toISOString()
                }
            })
        ]
    );

    return rows[0] || null;
}

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

function coordinateMapLink(latitude, longitude) {
    const lat = parseNumber(latitude);
    const lng = parseNumber(longitude);
    if (lat === null || lng === null) return null;
    if (lat === 0 && lng === 0) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
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

function isCompletedRequest(row, hasPickup, hasDelivery) {
    const orderStatus = String(row.order_status || '').toUpperCase();
    const requestStatus = String(row.request_status || '').toLowerCase();
    if (COMPLETED_ORDER_STATUSES.has(orderStatus) || requestStatus === 'completed') {
        return true;
    }

    const pickupStatus = String(row.pickup_status || '').toLowerCase();
    const deliveryStatus = String(row.delivery_status || '').toLowerCase();
    const pickupComplete = !hasPickup || ['dropped_at_hub', 'completed'].includes(pickupStatus);
    const deliveryComplete = !hasDelivery || ['delivered', 'completed'].includes(deliveryStatus);

    return (hasPickup || hasDelivery) && pickupComplete && deliveryComplete;
}

function mapRequestRow(row) {
    const hasPickup = isVisibleLeg(row, 'pickup');
    const hasDelivery = isVisibleLeg(row, 'delivery');
    const pickupLeg = mapLeg(row, 'pickup');
    const deliveryLeg = mapLeg(row, 'delivery');
    const isCompleted = isCompletedRequest(row, hasPickup, hasDelivery);
    const deadlineAt = row.pickup_deadline_at
        || row.delivery_deadline_at
        || row.request_deadline_at
        || null;
    const completedAt = row.request_completed_at
        || row.order_completed_at
        || row.delivery_completed_at
        || row.pickup_completed_at
        || null;

    return {
        id: row.request_id,
        packageCode: row.package_code,
        group: isCompleted ? 'completed' : groupType(hasPickup, hasDelivery),
        status: isCompleted ? 'completed' : row.request_status,
        serviceLevel: row.service_level,
        deadlineAt,
        completedAt,
        createdAt: row.request_created_at,
        updatedAt: row.request_updated_at,
        isCompleted,
        isOverdue: Boolean(deadlineAt && new Date(deadlineAt).getTime() < Date.now()
            && !isCompleted
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
            completedAt: row.order_completed_at || null,
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
            mapLink: coordinateMapLink(row.seller_latitude, row.seller_longitude)
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
    const completed = requests
        .filter(request => request.isCompleted)
        .sort((left, right) => {
            const rightTime = new Date(right.completedAt || right.updatedAt || right.createdAt || 0).getTime();
            const leftTime = new Date(left.completedAt || left.updatedAt || left.createdAt || 0).getTime();
            return rightTime - leftTime;
        });

    return {
        pickupDelivery: requests.filter(request => request.group === 'pickup_delivery'),
        deliveryOnly: requests.filter(request => request.group === 'delivery_only'),
        pickupOnly: requests.filter(request => request.group === 'pickup_only'),
        hubDropoff: requests.filter(request => request.group === 'hub_dropoff'),
        completed
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


export {
  MZIGO_EGO_SLUG,
  DROPOFF_LOCATION,
  COMPLETED_PAYMENT_STATUSES,
  COMPLETED_ORDER_STATUSES,
  LOGISTICS_VISIBLE_REQUEST_STATUSES,
  TIMING_DUMMY_HASH,
  LOGISTICS_STATUS_MAP,
  LOGISTICS_STATUS_MESSAGES,
  ALLOWED_LOGISTICS_TRANSITIONS,
  REQUEST_PROGRESS_STATUSES,
  IMPORTANT_LOGISTICS_STATUS_NOTIFICATIONS,
  markOrderReadyForBuyerAfterDeliveredLeg,
  ADMIN_LOGISTICS_STATUS_FILTERS,
  normalizeEmail,
  normalizeSort,
  normalizeAdminStatusFilter,
  normalizeLegType,
  normalizeRequestedLogisticsStatus,
  assertValidLegTransition,
  timestampAssignments,
  getOrderBy,
  parseNumber,
  mapLink,
  coordinateMapLink,
  isVisibleLeg,
  feeStatus,
  mapLeg,
  groupType,
  isCompletedRequest,
  mapRequestRow,
  groupRequests,
  signLogisticsToken
};
