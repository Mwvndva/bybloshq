import { pool } from '../shared/db/database.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import LogisticsTrackingLinkService from './logisticsTrackingLink.service.js';

const MZIGO_EGO_SLUG = 'mzigo-ego';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const COMPLETED_PAYMENT_STATUSES = new Set(['completed', 'success', 'paid']);

function logisticsDeadline() {
    return new Date(Date.now() + ONE_DAY_MS);
}

function buildPackageCode(order) {
    return `BYB-LOG-${order.id}`;
}

function locationPayload(location = {}) {
    return {
        label: location.label || null,
        address: location.address || null,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null
    };
}

function ensureQuote(quote) {
    if (!quote || quote.legType !== 'delivery' || quote.payer !== 'buyer') {
        throw new Error('A buyer delivery quote is required before creating a delivery leg');
    }

    if (!quote.destination?.address) {
        throw new Error('Buyer delivery address is required before creating a delivery leg');
    }
}

function ensurePickupQuote(quote) {
    if (!quote || quote.legType !== 'pickup' || quote.payer !== 'seller') {
        throw new Error('A seller pickup quote is required before creating a pickup leg');
    }

    if (!quote.origin?.address) {
        throw new Error('Seller pickup address is required before creating a pickup leg');
    }
}

function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function hasDoorDelivery(payment, order) {
    const paymentMetadata = parseJson(payment?.metadata);
    const orderMetadata = parseJson(order?.metadata);
    const delivery = paymentMetadata.delivery || orderMetadata.delivery || {};

    return delivery.doorDelivery === true
        || delivery.door_delivery === true
        || delivery.deliveryMode === 'DOOR_DELIVERY'
        || delivery.delivery_mode === 'DOOR_DELIVERY';
}

class LogisticsRequestService {
    static async getMzigoEgoPartner(client) {
        const { rows } = await client.query(
            `SELECT id, name, slug
             FROM logistics_partners
             WHERE slug = $1
               AND active = TRUE
             LIMIT 1`,
            [MZIGO_EGO_SLUG]
        );

        if (!rows[0]) {
            throw new Error('Active Mzigo Ego logistics partner is not configured');
        }

        return rows[0];
    }

    static async createDoorDeliveryPaymentPending(client, {
        order,
        payment,
        quote,
        buyer = {},
        product = {},
        seller = {},
        idempotencyKey = null
    }) {
        if (!order?.id) throw new Error('Order is required before creating logistics request');
        if (!payment?.id) throw new Error('Payment is required before creating logistics delivery leg');
        ensureQuote(quote);

        const partner = await this.getMzigoEgoPartner(client);
        const deadlineAt = logisticsDeadline();
        const packageCode = buildPackageCode(order);
        const requestMetadata = {
            source: 'product_payment_initiation',
            buyer_id: buyer.id || null,
            buyer_name: buyer.name || null,
            buyer_phone: buyer.phone || null,
            seller_id: seller.id || product.seller_id || null,
            seller_name: seller.full_name || seller.seller_name || null,
            shop_name: seller.shop_name || product.shop_name || null,
            product_id: product.id || null,
            product_name: product.name || null,
            payment_id: payment.id,
            idempotency_key: idempotencyKey || null,
            delivery_note: 'Deliveries are made within 24 hours'
        };

        const { rows: requestRows } = await client.query(
            `INSERT INTO logistics_requests
                (order_id, partner_id, package_code, status, service_level, deadline_at, metadata)
             VALUES ($1, $2, $3, 'payment_pending', 'standard', $4, $5::jsonb)
             ON CONFLICT (order_id) DO UPDATE
             SET package_code = COALESCE(logistics_requests.package_code, EXCLUDED.package_code),
                 metadata = logistics_requests.metadata || EXCLUDED.metadata,
                 updated_at = NOW()
             RETURNING *`,
            [
                order.id,
                partner.id,
                packageCode,
                deadlineAt,
                JSON.stringify(requestMetadata)
            ]
        );
        const request = requestRows[0];
        await LogisticsTrackingLinkService.ensureLinksForRequest(client, request.id);

        const legMetadata = {
            source: 'buyer_door_delivery_payment',
            quote: {
                rate_kes_per_km: quote.rateKesPerKm,
                distance_km: quote.distanceKm,
                chargeable_distance_km: quote.chargeableDistanceKm,
                fee_amount: quote.feeAmount
            },
            origin: locationPayload(quote.origin),
            destination: locationPayload(quote.destination)
        };

        const { rows: legRows } = await client.query(
            `INSERT INTO logistics_legs
                (
                    logistics_request_id,
                    leg_type,
                    payer,
                    status,
                    payment_id,
                    fee_amount,
                    fee_currency,
                    distance_km,
                    origin_label,
                    origin_address,
                    origin_lat,
                    origin_lng,
                    destination_label,
                    destination_address,
                    destination_lat,
                    destination_lng,
                    deadline_at,
                    metadata
                )
             VALUES
                ($1, 'delivery', 'buyer', 'payment_pending', $2, $3, $4, $5,
                 $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
             ON CONFLICT (logistics_request_id, leg_type) DO UPDATE
             SET payment_id = COALESCE(logistics_legs.payment_id, EXCLUDED.payment_id),
                 fee_amount = EXCLUDED.fee_amount,
                 fee_currency = EXCLUDED.fee_currency,
                 distance_km = EXCLUDED.distance_km,
                 origin_label = EXCLUDED.origin_label,
                 origin_address = EXCLUDED.origin_address,
                 origin_lat = EXCLUDED.origin_lat,
                 origin_lng = EXCLUDED.origin_lng,
                 destination_label = EXCLUDED.destination_label,
                 destination_address = EXCLUDED.destination_address,
                 destination_lat = EXCLUDED.destination_lat,
                 destination_lng = EXCLUDED.destination_lng,
                 deadline_at = EXCLUDED.deadline_at,
                 metadata = logistics_legs.metadata || EXCLUDED.metadata,
                 updated_at = NOW()
             WHERE logistics_legs.status = 'payment_pending'
             RETURNING *`,
            [
                request.id,
                payment.id,
                quote.feeAmount,
                quote.currency || 'KES',
                quote.distanceKm,
                quote.origin?.label || null,
                quote.origin?.address || null,
                quote.origin?.latitude ?? null,
                quote.origin?.longitude ?? null,
                quote.destination?.label || null,
                quote.destination?.address || null,
                quote.destination?.latitude ?? null,
                quote.destination?.longitude ?? null,
                deadlineAt,
                JSON.stringify(legMetadata)
            ]
        );

        const deliveryLeg = legRows[0];
        if (!deliveryLeg) {
            throw new Error(`Delivery leg for order ${order.id} already moved past payment_pending`);
        }

        await client.query(
            `INSERT INTO logistics_tracking_events
                (
                    logistics_request_id,
                    logistics_leg_id,
                    event_key,
                    event_type,
                    status,
                    message,
                    source,
                    metadata
                )
             VALUES ($1, $2, $3, 'delivery.payment_pending', 'payment_pending', $4, 'system', $5::jsonb)
             ON CONFLICT (event_key) DO NOTHING`,
            [
                request.id,
                deliveryLeg.id,
                `logistics.delivery.payment_pending:${order.id}:${payment.id}`,
                'Buyer selected door delivery. Delivery leg is waiting for payment confirmation.',
                JSON.stringify({
                    order_id: order.id,
                    payment_id: payment.id,
                    fee_amount: quote.feeAmount,
                    currency: quote.currency || 'KES'
                })
            ]
        );

        return {
            request,
            deliveryLeg,
            partner
        };
    }

    static async createSellerPickupPaymentPending(client, {
        order,
        payment,
        quote,
        seller = {},
        pickupLocation = {},
        idempotencyKey = null
    }) {
        if (!order?.id) throw new Error('Order is required before creating logistics request');
        if (!payment?.id) throw new Error('Payment is required before creating logistics pickup leg');
        ensurePickupQuote(quote);

        const partner = await this.getMzigoEgoPartner(client);
        const deadlineAt = logisticsDeadline();
        const packageCode = buildPackageCode(order);
        const requestMetadata = {
            source: 'seller_pickup_payment_initiation',
            seller_id: seller.id || order.seller_id || null,
            seller_name: seller.full_name || seller.name || null,
            shop_name: seller.shop_name || null,
            pickup_payment_id: payment.id,
            idempotency_key: idempotencyKey || null,
            dropoff_note: 'If pickup is not requested, online sellers must drop the package at the hub within 24 hours.'
        };

        const { rows: requestRows } = await client.query(
            `INSERT INTO logistics_requests
                (order_id, partner_id, package_code, status, service_level, deadline_at, metadata)
             VALUES ($1, $2, $3, 'payment_pending', 'standard', $4, $5::jsonb)
             ON CONFLICT (order_id) DO UPDATE
             SET package_code = COALESCE(logistics_requests.package_code, EXCLUDED.package_code),
                 status = CASE
                   WHEN logistics_requests.status IN ('pending', 'payment_pending') THEN EXCLUDED.status
                   ELSE logistics_requests.status
                 END,
                 metadata = logistics_requests.metadata || EXCLUDED.metadata,
                 updated_at = NOW()
             RETURNING *`,
            [
                order.id,
                partner.id,
                packageCode,
                deadlineAt,
                JSON.stringify(requestMetadata)
            ]
        );
        const request = requestRows[0];
        await LogisticsTrackingLinkService.ensureLinksForRequest(client, request.id);

        const legMetadata = {
            source: 'seller_pickup_payment',
            quote: {
                rate_kes_per_km: quote.rateKesPerKm,
                distance_km: quote.distanceKm,
                chargeable_distance_km: quote.chargeableDistanceKm,
                fee_amount: quote.feeAmount
            },
            origin: locationPayload(quote.origin || pickupLocation),
            destination: locationPayload(quote.destination)
        };

        const { rows: legRows } = await client.query(
            `INSERT INTO logistics_legs
                (
                    logistics_request_id,
                    leg_type,
                    payer,
                    status,
                    payment_id,
                    fee_amount,
                    fee_currency,
                    distance_km,
                    origin_label,
                    origin_address,
                    origin_lat,
                    origin_lng,
                    destination_label,
                    destination_address,
                    destination_lat,
                    destination_lng,
                    deadline_at,
                    metadata
                )
             VALUES
                ($1, 'pickup', 'seller', 'payment_pending', $2, $3, $4, $5,
                 $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
             ON CONFLICT (logistics_request_id, leg_type) DO UPDATE
             SET payment_id = EXCLUDED.payment_id,
                 status = 'payment_pending',
                 fee_amount = EXCLUDED.fee_amount,
                 fee_currency = EXCLUDED.fee_currency,
                 distance_km = EXCLUDED.distance_km,
                 origin_label = EXCLUDED.origin_label,
                 origin_address = EXCLUDED.origin_address,
                 origin_lat = EXCLUDED.origin_lat,
                 origin_lng = EXCLUDED.origin_lng,
                 destination_label = EXCLUDED.destination_label,
                 destination_address = EXCLUDED.destination_address,
                 destination_lat = EXCLUDED.destination_lat,
                 destination_lng = EXCLUDED.destination_lng,
                 deadline_at = EXCLUDED.deadline_at,
                 failed_at = NULL,
                 metadata = logistics_legs.metadata || EXCLUDED.metadata,
                 updated_at = NOW()
             WHERE logistics_legs.status IN ('payment_pending', 'failed', 'cancelled')
             RETURNING *`,
            [
                request.id,
                payment.id,
                quote.feeAmount,
                quote.currency || 'KES',
                quote.distanceKm,
                quote.origin?.label || null,
                quote.origin?.address || null,
                quote.origin?.latitude ?? null,
                quote.origin?.longitude ?? null,
                quote.destination?.label || null,
                quote.destination?.address || null,
                quote.destination?.latitude ?? null,
                quote.destination?.longitude ?? null,
                deadlineAt,
                JSON.stringify(legMetadata)
            ]
        );

        const pickupLeg = legRows[0];
        if (!pickupLeg) {
            throw new Error(`Pickup for order ${order.id} is already active or completed`);
        }

        await client.query(
            `INSERT INTO logistics_tracking_events
                (
                    logistics_request_id,
                    logistics_leg_id,
                    event_key,
                    event_type,
                    status,
                    message,
                    source,
                    metadata
                )
             VALUES ($1, $2, $3, 'pickup.payment_pending', 'payment_pending', $4, 'seller', $5::jsonb)
             ON CONFLICT (event_key) DO NOTHING`,
            [
                request.id,
                pickupLeg.id,
                `logistics.pickup.payment_pending:${order.id}:${payment.id}`,
                'Seller requested pickup. Pickup leg is waiting for payment confirmation.',
                JSON.stringify({
                    order_id: order.id,
                    payment_id: payment.id,
                    fee_amount: quote.feeAmount,
                    currency: quote.currency || 'KES'
                })
            ]
        );

        return {
            request,
            pickupLeg,
            partner
        };
    }

    static async cancelPaymentPendingLegsForPaymentFailure(client, {
        orderId,
        paymentId,
        reason
    }) {
        const { rows: legs } = await client.query(
            `UPDATE logistics_legs ll
             SET status = 'cancelled',
                 failed_at = NOW(),
                 metadata = ll.metadata || $3::jsonb,
                 updated_at = NOW()
             FROM logistics_requests lr
             WHERE ll.logistics_request_id = lr.id
               AND lr.order_id = $1
               AND ll.payment_id = $2
               AND ll.status = 'payment_pending'
             RETURNING ll.id, ll.logistics_request_id, ll.leg_type`,
            [
                orderId,
                paymentId,
                JSON.stringify({
                    payment_initiation_failed: true,
                    reason: reason || 'payment_initiation_failed'
                })
            ]
        );

        if (legs.length === 0) return 0;

        await client.query(
            `UPDATE logistics_requests lr
             SET status = 'cancelled',
                 updated_at = NOW(),
                 metadata = lr.metadata || $2::jsonb
             WHERE lr.order_id = $1
               AND NOT EXISTS (
                   SELECT 1
                   FROM logistics_legs ll
                   WHERE ll.logistics_request_id = lr.id
                     AND ll.status <> 'cancelled'
               )`,
            [
                orderId,
                JSON.stringify({
                    payment_initiation_failed: true,
                    reason: reason || 'payment_initiation_failed'
                })
            ]
        );

        for (const leg of legs) {
            await client.query(
                `INSERT INTO logistics_tracking_events
                    (
                        logistics_request_id,
                        logistics_leg_id,
                        event_key,
                        event_type,
                        status,
                        message,
                        source,
                        metadata
                    )
                 VALUES ($1, $2, $3, $4, 'cancelled', $5, 'system', $6::jsonb)
                 ON CONFLICT (event_key) DO NOTHING`,
                [
                    leg.logistics_request_id,
                    leg.id,
                    `logistics.${leg.leg_type}.cancelled:${orderId}:${paymentId}`,
                    `${leg.leg_type}.cancelled`,
                    'Payment initiation failed before STK push. Logistics leg was cancelled.',
                    JSON.stringify({ order_id: orderId, payment_id: paymentId, reason })
                ]
            );
        }

        return legs.length;
    }

    static async cancelPaymentPendingLegsAfterPaymentFailure({
        payment,
        order,
        reason = 'payment_failed'
    }) {
        if (!payment?.id || !order?.id) {
            return { cancelled: 0, reason: 'missing_payment_or_order' };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const cancelled = await this.cancelPaymentPendingLegsForPaymentFailure(client, {
                orderId: order.id,
                paymentId: payment.id,
                reason
            });
            await client.query('COMMIT');
            return { cancelled };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    static async activateDoorDeliveryAfterPayment({
        payment,
        order,
        eventId = null
    }) {
        if (!payment?.id || !order?.id) {
            return { activated: false, reason: 'missing_payment_or_order' };
        }

        if (!hasDoorDelivery(payment, order)) {
            return { activated: false, reason: 'not_door_delivery' };
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            let notificationEvent = null;

            const { rows: paymentRows } = await client.query(
                `SELECT *
                 FROM payments
                 WHERE id = $1
                 FOR UPDATE`,
                [payment.id]
            );
            const lockedPayment = paymentRows[0];

            const { rows: orderRows } = await client.query(
                `SELECT *
                 FROM product_orders
                 WHERE id = $1
                 FOR UPDATE`,
                [order.id]
            );
            const lockedOrder = orderRows[0];

            if (!lockedPayment || !lockedOrder) {
                throw new Error(`Cannot activate logistics: missing payment/order ${payment.id}/${order.id}`);
            }

            if (!COMPLETED_PAYMENT_STATUSES.has(String(lockedPayment.status || '').toLowerCase())
                || String(lockedOrder.payment_status || '').toLowerCase() !== 'completed') {
                await client.query('COMMIT');
                return { activated: false, reason: 'payment_not_completed' };
            }

            const { rows: logisticsRows } = await client.query(
                `SELECT lr.id AS request_id,
                        lr.status AS request_status,
                        ll.id AS delivery_leg_id,
                        ll.status AS delivery_leg_status
                 FROM logistics_requests lr
                 JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
                                      AND ll.leg_type = 'delivery'
                 WHERE lr.order_id = $1
                 FOR UPDATE OF lr, ll`,
                [lockedOrder.id]
            );
            const logistics = logisticsRows[0];

            if (!logistics) {
                throw new Error(`Door delivery payment ${lockedPayment.id} has no logistics request or delivery leg`);
            }

            if (logistics.delivery_leg_status === 'payment_pending') {
                await client.query(
                    `UPDATE logistics_legs
                     SET status = 'delivery_pending',
                         metadata = metadata || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        logistics.delivery_leg_id,
                        JSON.stringify({
                            buyer_paid_for_delivery: true,
                            payment_id: lockedPayment.id,
                            activated_at: new Date().toISOString()
                        })
                    ]
                );
            }

            if (['payment_pending', 'pending'].includes(logistics.request_status)) {
                await client.query(
                    `UPDATE logistics_requests
                     SET status = 'active',
                         metadata = metadata || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        logistics.request_id,
                        JSON.stringify({
                            visible_to_partner: true,
                            visible_to_mzigo: true,
                            activated_by_payment_id: lockedPayment.id,
                            activated_at: new Date().toISOString()
                        })
                    ]
                );
            }

            await client.query(
                `INSERT INTO logistics_tracking_events
                    (
                        logistics_request_id,
                        logistics_leg_id,
                        event_key,
                        event_type,
                        status,
                        message,
                        source,
                        metadata
                    )
                 VALUES ($1, $2, $3, 'delivery.buyer_paid', 'delivery_pending', $4, 'system', $5::jsonb)
                 ON CONFLICT (event_key) DO NOTHING`,
                [
                    logistics.request_id,
                    logistics.delivery_leg_id,
                    `logistics.delivery.buyer_paid:${lockedOrder.id}:${lockedPayment.id}`,
                    'Buyer paid for door delivery.',
                    JSON.stringify({
                        order_id: lockedOrder.id,
                        payment_id: lockedPayment.id,
                        payment_completed_event_id: eventId
                    })
                ]
            );

            await LogisticsTrackingLinkService.ensureLinksForRequest(client, logistics.request_id);
            notificationEvent = await eventBus.enqueueInTransaction(client, AppEvents.LOGISTICS.NOTIFICATION, {
                eventId: `logistics.notification.delivery_paid:${logistics.request_id}:${logistics.delivery_leg_id}:${lockedPayment.id}`,
                notificationType: 'delivery_paid',
                requestId: logistics.request_id,
                legId: logistics.delivery_leg_id,
                legType: 'delivery',
                orderId: lockedOrder.id,
                paymentId: lockedPayment.id,
                source: 'system'
            });

            await client.query(
                `UPDATE product_orders
                 SET metadata = jsonb_set(
                        jsonb_set(
                            COALESCE(metadata, '{}'::jsonb),
                            '{delivery,logistics,status}',
                            to_jsonb('active'::text),
                            true
                        ),
                        '{delivery,logistics,delivery_leg_status}',
                        to_jsonb('delivery_pending'::text),
                        true
                     ),
                     updated_at = NOW()
                 WHERE id = $1`,
                [lockedOrder.id]
            );

            await client.query('COMMIT');
            eventBus.dispatchAfterCommit(notificationEvent?.eventId, 'LogisticsDeliveryPaidNotification');

            return {
                activated: true,
                requestId: logistics.request_id,
                deliveryLegId: logistics.delivery_leg_id
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    static async activateSellerPickupAfterPayment({
        payment,
        order,
        eventId = null
    }) {
        if (!payment?.id || !order?.id) {
            return { activated: false, reason: 'missing_payment_or_order' };
        }

        const paymentMetadata = parseJson(payment.metadata);
        if (paymentMetadata.payment_purpose !== 'seller_pickup_fee'
            && paymentMetadata.logistics_payment_type !== 'seller_pickup_fee') {
            return { activated: false, reason: 'not_seller_pickup_fee' };
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            let notificationEvent = null;

            const { rows: paymentRows } = await client.query(
                `SELECT *
                 FROM payments
                 WHERE id = $1
                 FOR UPDATE`,
                [payment.id]
            );
            const lockedPayment = paymentRows[0];

            const { rows: orderRows } = await client.query(
                `SELECT *
                 FROM product_orders
                 WHERE id = $1
                 FOR UPDATE`,
                [order.id]
            );
            const lockedOrder = orderRows[0];

            if (!lockedPayment || !lockedOrder) {
                throw new Error(`Cannot activate pickup: missing payment/order ${payment.id}/${order.id}`);
            }

            if (!COMPLETED_PAYMENT_STATUSES.has(String(lockedPayment.status || '').toLowerCase())) {
                await client.query('COMMIT');
                return { activated: false, reason: 'payment_not_completed' };
            }

            const { rows: logisticsRows } = await client.query(
                `SELECT lr.id AS request_id,
                        lr.status AS request_status,
                        pl.id AS pickup_leg_id,
                        pl.status AS pickup_leg_status
                 FROM logistics_requests lr
                 JOIN logistics_legs pl ON pl.logistics_request_id = lr.id
                                      AND pl.leg_type = 'pickup'
                 WHERE lr.order_id = $1
                   AND pl.payment_id = $2
                 FOR UPDATE OF lr, pl`,
                [lockedOrder.id, lockedPayment.id]
            );
            const logistics = logisticsRows[0];

            if (!logistics) {
                throw new Error(`Seller pickup payment ${lockedPayment.id} has no pickup logistics leg`);
            }

            if (logistics.pickup_leg_status === 'payment_pending') {
                await client.query(
                    `UPDATE logistics_legs
                     SET status = 'pending',
                         metadata = metadata || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        logistics.pickup_leg_id,
                        JSON.stringify({
                            seller_paid_for_pickup: true,
                            payment_id: lockedPayment.id,
                            activated_at: new Date().toISOString()
                        })
                    ]
                );
            }

            if (['payment_pending', 'pending'].includes(logistics.request_status)) {
                await client.query(
                    `UPDATE logistics_requests
                     SET status = 'active',
                         metadata = metadata || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        logistics.request_id,
                        JSON.stringify({
                            visible_to_partner: true,
                            visible_to_mzigo: true,
                            pickup_activated_by_payment_id: lockedPayment.id,
                            pickup_activated_at: new Date().toISOString()
                        })
                    ]
                );
            }

            await client.query(
                `INSERT INTO logistics_tracking_events
                    (
                        logistics_request_id,
                        logistics_leg_id,
                        event_key,
                        event_type,
                        status,
                        message,
                        source,
                        metadata
                    )
                 VALUES ($1, $2, $3, 'pickup.seller_paid', 'pending', $4, 'seller', $5::jsonb)
                 ON CONFLICT (event_key) DO NOTHING`,
                [
                    logistics.request_id,
                    logistics.pickup_leg_id,
                    `logistics.pickup.seller_paid:${lockedOrder.id}:${lockedPayment.id}`,
                    'Seller paid for pickup. Mzigo Ego can now process pickup for this package.',
                    JSON.stringify({
                        order_id: lockedOrder.id,
                        payment_id: lockedPayment.id,
                        payment_completed_event_id: eventId
                    })
                ]
            );

            await LogisticsTrackingLinkService.ensureLinksForRequest(client, logistics.request_id);
            notificationEvent = await eventBus.enqueueInTransaction(client, AppEvents.LOGISTICS.NOTIFICATION, {
                eventId: `logistics.notification.pickup_paid:${logistics.request_id}:${logistics.pickup_leg_id}:${lockedPayment.id}`,
                notificationType: 'pickup_paid',
                requestId: logistics.request_id,
                legId: logistics.pickup_leg_id,
                legType: 'pickup',
                orderId: lockedOrder.id,
                paymentId: lockedPayment.id,
                source: 'system'
            });

            await client.query(
                `UPDATE product_orders
                 SET metadata = jsonb_set(
                        jsonb_set(
                            COALESCE(metadata, '{}'::jsonb),
                            '{delivery,logistics,status}',
                            to_jsonb('active'::text),
                            true
                        ),
                        '{delivery,logistics,pickup_leg_status}',
                        to_jsonb('pending'::text),
                        true
                     ),
                     updated_at = NOW()
                 WHERE id = $1`,
                [lockedOrder.id]
            );

            await client.query('COMMIT');
            eventBus.dispatchAfterCommit(notificationEvent?.eventId, 'LogisticsPickupPaidNotification');

            return {
                activated: true,
                requestId: logistics.request_id,
                pickupLegId: logistics.pickup_leg_id
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }
}

export default LogisticsRequestService;
