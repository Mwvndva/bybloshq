import eventBus, { AppEvents } from './eventBus.js';
import whatsappService from '../services/whatsapp.service.js';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import LogisticsTrackingLinkService from '../services/logisticsTrackingLink.service.js';
import notificationService from '../services/notification.service.js';

const IMPORTANT_LOGISTICS_NOTIFICATION_TYPES = new Set([
    'new_order',
    'delivery_paid',
    'pickup_paid',
    'pickup_assigned',
    'picked_up_from_seller',
    'dropped_at_hub',
    'out_for_delivery',
    'delivered',
    'delivery_delayed',
    'delivery_failed',
    'pickup_failed'
]);

function firstPresent(...values) {
    return values.find(value => value !== null && value !== undefined && String(value).trim() !== '') || null;
}

function parseItems(items) {
    if (Array.isArray(items)) return items;
    if (!items) return [];
    try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeNotificationType(payload) {
    return String(payload?.notificationType || payload?.externalStatus || payload?.status || '')
        .trim()
        .toLowerCase();
}

async function loadLogisticsNotificationContext({ requestId, legId, orderId }) {
    const { rows } = await pool.query(
        `SELECT
            lr.id AS request_id,
            lr.package_code,
            lr.status AS request_status,
            lr.deadline_at AS request_deadline_at,
            lp.id AS partner_id,
            lp.name AS partner_name,
            lp.phone AS partner_phone,
            lp.whatsapp_number AS partner_whatsapp_number,
            lp.user_id AS partner_user_id,
            po.id AS order_id,
            po.order_number,
            po.total_amount,
            po.metadata AS order_metadata,
            po.custom_production_deadline_at,
            po.custom_production_grace_deadline_at,
            po.buyer_name,
            po.buyer_mobile_payment,
            po.buyer_whatsapp_number,
            po.location_address,
            s.id AS seller_id,
            s.user_id AS seller_user_id,
            s.full_name AS seller_name,
            s.shop_name,
            s.whatsapp_number AS seller_whatsapp_number,
            s.physical_address AS seller_physical_address,
            s.location AS seller_location,
            b.full_name AS buyer_profile_name,
            b.whatsapp_number AS buyer_profile_whatsapp_number,
            b.user_id AS buyer_user_id,
            ll.id AS leg_id,
            ll.leg_type,
            ll.status AS leg_status,
            ll.fee_amount,
            ll.fee_currency,
            ll.distance_km,
            ll.origin_label,
            ll.origin_address,
            ll.destination_label,
            ll.destination_address,
            ll.deadline_at AS leg_deadline_at,
            COALESCE(items.items, '[]'::json) AS items
         FROM logistics_requests lr
         JOIN logistics_partners lp ON lp.id = lr.partner_id
         JOIN product_orders po ON po.id = lr.order_id
         LEFT JOIN sellers s ON s.id = po.seller_id
         LEFT JOIN buyers b ON b.id = po.buyer_id
         LEFT JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
             AND ($2::bigint IS NULL OR ll.id = $2::bigint)
         LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                 'name', oi.product_name,
                 'quantity', oi.quantity,
                 'price', oi.product_price,
                 'metadata', oi.metadata
             ) ORDER BY oi.id) AS items
             FROM order_items oi
             WHERE oi.order_id = po.id
         ) items ON TRUE
         WHERE ($1::bigint IS NULL OR lr.id = $1::bigint)
           AND ($3::integer IS NULL OR lr.order_id = $3::integer)
         ORDER BY CASE
             WHEN $2::bigint IS NOT NULL AND ll.id = $2::bigint THEN 0
             WHEN ll.leg_type = 'pickup' THEN 1
             WHEN ll.leg_type = 'delivery' THEN 2
             ELSE 3
         END
         LIMIT 1`,
        [requestId || null, legId || null, orderId || null]
    );

    const row = rows[0];
    if (!row) return null;

    const trackingLinks = await LogisticsTrackingLinkService.getLinksForRequest(row.request_id);

    return {
        request: {
            id: row.request_id,
            packageCode: row.package_code,
            status: row.request_status,
            deadlineAt: row.request_deadline_at
        },
        order: {
            id: row.order_id,
            orderNumber: row.order_number,
            totalAmount: Number(row.total_amount || 0),
            metadata: row.order_metadata || {},
            custom_production_deadline_at: row.custom_production_deadline_at,
            custom_production_grace_deadline_at: row.custom_production_grace_deadline_at,
            items: parseItems(row.items)
        },
        buyer: {
            userId: row.buyer_user_id || null,
            name: firstPresent(row.buyer_profile_name, row.buyer_name, 'Buyer'),
            phone: firstPresent(row.buyer_profile_whatsapp_number, row.buyer_whatsapp_number, row.buyer_mobile_payment)
        },
        seller: {
            id: row.seller_id,
            userId: row.seller_user_id || null,
            name: firstPresent(row.shop_name, row.seller_name, 'Seller'),
            phone: row.seller_whatsapp_number,
            location: firstPresent(row.seller_physical_address, row.seller_location)
        },
        partner: {
            id: row.partner_id,
            userId: row.partner_user_id || null,
            name: row.partner_name || 'Mzigo Ego',
            phone: firstPresent(row.partner_whatsapp_number, row.partner_phone, whatsappService.COURIER_NUMBER)
        },
        leg: {
            id: row.leg_id,
            type: row.leg_type,
            status: row.leg_status,
            feeAmount: Number(row.fee_amount || 0),
            feeCurrency: row.fee_currency || 'KES',
            distanceKm: row.distance_km === null ? null : Number(row.distance_km),
            origin: firstPresent(row.origin_address, row.origin_label),
            destination: firstPresent(row.destination_address, row.destination_label, row.location_address),
            deadlineAt: row.leg_deadline_at
        },
        trackingLinks
    };
}

function logisticsFeedTitle(notificationType) {
    if (notificationType === 'new_order') return 'New pickup available';
    if (String(notificationType).includes('cancel')) return 'Delivery cancelled';
    return 'Delivery update';
}

function logisticsFeedBody(notificationType, context) {
    const ref = context.order?.orderNumber || ('#' + (context.order?.id || ''));
    if (notificationType === 'new_order') return `Order ${ref} is ready for pickup at ${context.seller?.location || 'the seller'}.`;
    const status = context.leg?.status || context.request?.status || 'updated';
    const leg = context.leg?.type ? `${context.leg.type} ` : '';
    return `Order ${ref}: ${leg}${status}.`;
}

async function deliverAll(eventId, context, notificationType) {
    const requestKey = context.leg?.id
        ? `logistics:${context.request.id}:${context.leg.id}:${notificationType}`
        : `logistics:${context.request.id}:request:${notificationType}`;
    const partnerOnly = notificationType === 'new_order';
    const skipPartner = ['delivery_paid', 'pickup_paid'].includes(notificationType);

    const deliveries = [
        !partnerOnly && context.buyer.phone
            ? {
                key: `${requestKey}:buyer`,
                role: 'buyer',
                phone: context.buyer.phone
            }
            : null,
        !partnerOnly && context.seller.phone
            ? {
                key: `${requestKey}:seller`,
                role: 'seller',
                phone: context.seller.phone
            }
            : null,
        !skipPartner && context.partner.phone
            ? {
                key: `${requestKey}:partner`,
                role: 'partner',
                phone: context.partner.phone
            }
            : null
    ].filter(Boolean);

    // Additive in-app feed writes (best-effort; gated on userId, independent of phone).
    const feedRecipients = [
        !partnerOnly && context.buyer.userId ? { key: `${requestKey}:buyer`, role: 'buyer', userId: context.buyer.userId } : null,
        !partnerOnly && context.seller.userId ? { key: `${requestKey}:seller`, role: 'seller', userId: context.seller.userId } : null,
        !skipPartner && context.partner.userId ? { key: `${requestKey}:partner`, role: 'partner', userId: context.partner.userId } : null
    ].filter(Boolean);
    if (feedRecipients.length) {
        await Promise.allSettled(feedRecipients.map(recipient =>
            eventBus.deliverRecipient(eventId, `${recipient.key}:feed`, () =>
                notificationService.send({
                    recipientUserId: recipient.userId,
                    recipientRole: recipient.role === 'partner' ? 'logistics' : recipient.role,
                    type: `logistics_${notificationType}`,
                    title: logisticsFeedTitle(notificationType),
                    body: logisticsFeedBody(notificationType, context),
                    data: {
                        path: recipient.role === 'partner' ? '/mzigo/dashboard' : (recipient.role === 'seller' ? '/seller' : '/buyer'),
                        orderId: context.order.id,
                        requestId: context.request.id
                    },
                    channels: ['in_app']
                }).catch(error => logger.warn('[Feed] logistics notification write failed', { key: recipient.key, error: error.message }))
            )
        ));
    }

    if (!deliveries.length) {
        logger.warn('[Event:LogisticsNotification] No WhatsApp recipients for logistics notification', {
            requestId: context.request.id,
            legId: context.leg.id,
            notificationType
        });
        return;
    }

    const results = await Promise.allSettled(deliveries.map(delivery =>
        eventBus.deliverRecipient(
            eventId,
            delivery.key,
            () => whatsappService.sendLogisticsMilestoneNotification(delivery.phone, {
                recipientRole: delivery.role,
                notificationType,
                context
            })
        )
    ));

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
        const error = new Error(`Logistics WhatsApp notification failed for ${failures.length} recipient(s)`);
        error.causes = failures.map(result => result.reason);
        error.retryable = failures.some(result => result.reason?.retryable !== false);
        throw error;
    }
}

eventBus.on(AppEvents.LOGISTICS.NOTIFICATION, async (payload) => {
    const notificationType = normalizeNotificationType(payload);
    if (!IMPORTANT_LOGISTICS_NOTIFICATION_TYPES.has(notificationType)) {
        logger.info('[Event:LogisticsNotification] Skipped non-important logistics notification', {
            notificationType,
            requestId: payload?.requestId,
            legId: payload?.legId
        });
        return;
    }

    const context = await loadLogisticsNotificationContext({
        requestId: payload.requestId,
        legId: payload.legId,
        orderId: payload.orderId
    });

    if (!context) {
        const error = new Error('Missing logistics notification context');
        error.retryable = false;
        throw error;
    }

    // WhatsApp is notification-only. Tracking, payments, escrow, and payouts are
    // already durably updated before this event is dispatched.
    await deliverAll(payload.eventId, context, notificationType);
});

export default eventBus;
