import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import PaystackProviderClient from '../../../infrastructure/providers/PaystackProviderClient.js';
import CorePaymentService from './CorePaymentService.js';
import { PaymentStatus } from '../../../shared/constants/enums.js';
import Payment from './payment.model.js';
import LogisticsQuoteService from '../../logistics/logisticsQuote.service.js';
import LogisticsRequestService from '../../logistics/logisticsRequest.service.js';

const ACTIVE_PICKUP_LEG_STATUSES = new Set([
    'payment_pending', 'pending', 'assigned', 'started',
    'en_route_pickup', 'arrived_at_seller', 'picked_up', 'dropped_at_hub'
]);

export class PaymentService {
    async initiateProductPayment(normalizedOrder) {
        return CorePaymentService.initiateProductPayment(normalizedOrder);
    }

    /**
     * Seller requests (and pays for) Mzigo Ego pickup from their own location,
     * as an alternative to self-dropping the package at the hub. Wires
     * together the pieces that already existed but were never orchestrated:
     * LogisticsQuoteService.quoteSellerPickup (fee calc), Payment.insert +
     * LogisticsRequestService.createSellerPickupPaymentPending (pending leg,
     * same transaction), then a real STK push after commit — mirroring the
     * door-delivery initiation in productCheckout.service.js. Completion is
     * already handled: CorePaymentService special-cases seller_pickup_fee
     * payments (no order mutation) and payment.events.js already calls
     * LogisticsRequestService.activateSellerPickupAfterPayment on success.
     */
    async initiateSellerPickupPayment({ orderId, sellerId, pickupLocation, mobilePayment, idempotencyKey = null }, deps = {}) {
        return PaymentService.initiateSellerPickupPayment({ orderId, sellerId, pickupLocation, mobilePayment, idempotencyKey }, deps);
    }

    /**
     * @param {object} [deps.providerClient] - Paystack client with initiatePayment(), injectable for tests.
     */
    static async initiateSellerPickupPayment({ orderId, sellerId, pickupLocation, mobilePayment, idempotencyKey = null }, deps = {}) {
        const { AppError } = await import('../../../shared/utils/errorHandler.js');
        const numericOrderId = Number.parseInt(orderId, 10);
        if (!Number.isSafeInteger(numericOrderId) || numericOrderId <= 0) {
            throw new AppError('A valid order id is required', 400);
        }
        if (!sellerId) {
            throw new AppError('Seller profile is required', 403);
        }
        if (!mobilePayment || typeof mobilePayment !== 'string' || !mobilePayment.trim()) {
            throw new AppError('A valid mobile payment number is required to pay for pickup', 400);
        }
        if (!pickupLocation || typeof pickupLocation !== 'object') {
            throw new AppError('A valid pickup location is required', 400);
        }

        const client = await pool.connect();
        let order = null;
        let seller = null;
        let payment = null;
        let quote = null;
        let created = null;

        try {
            await client.query('BEGIN');

            const { rows: orderRows } = await client.query(
                `SELECT * FROM product_orders WHERE id = $1 AND seller_id = $2 FOR UPDATE`,
                [numericOrderId, sellerId]
            );
            order = orderRows[0];
            if (!order) {
                throw new AppError('Order not found or unauthorized', 404, 'ORDER_NOT_FOUND');
            }

            const paymentStatus = String(order.payment_status || '').toLowerCase();
            const isPaid = paymentStatus === 'completed' || paymentStatus === 'paid';
            if (!isPaid) {
                throw new AppError('Pickup can only be requested after buyer payment succeeds', 400);
            }

            const orderType = String(order.order_type || '').toUpperCase();
            const fulfillmentType = String(order.fulfillment_type || '').toUpperCase();
            if (orderType !== 'PHYSICAL' || fulfillmentType !== 'COURIER') {
                throw new AppError('Mzigo pickup is only available for paid physical orders from online shops', 400);
            }

            const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {};
            if (metadata.seller_handoff?.method === 'seller_dropoff') {
                throw new AppError('Hub drop-off was already selected for this order; pickup cannot also be requested', 409);
            }

            const { rows: existingLegRows } = await client.query(
                `SELECT ll.id, ll.status, ll.payment_id
                 FROM logistics_legs ll
                 JOIN logistics_requests lr ON lr.id = ll.logistics_request_id
                 WHERE lr.order_id = $1 AND ll.leg_type = 'pickup'
                 FOR UPDATE OF ll`,
                [numericOrderId]
            );
            const existingLeg = existingLegRows[0];
            if (existingLeg && ACTIVE_PICKUP_LEG_STATUSES.has(existingLeg.status)) {
                if (existingLeg.status === 'payment_pending' && existingLeg.payment_id) {
                    const { rows: existingPaymentRows } = await client.query(
                        `SELECT * FROM payments WHERE id = $1`,
                        [existingLeg.payment_id]
                    );
                    await client.query('COMMIT');
                    return {
                        alreadyPending: true,
                        paymentId: existingPaymentRows[0]?.id || existingLeg.payment_id,
                        orderId: numericOrderId
                    };
                }
                throw new AppError('Pickup has already been requested for this order', 409);
            }

            const { rows: sellerRows } = await client.query(
                `SELECT * FROM sellers WHERE id = $1 FOR UPDATE`,
                [sellerId]
            );
            seller = sellerRows[0];
            if (!seller) {
                throw new AppError('Seller profile not found', 404);
            }

            quote = LogisticsQuoteService.quoteSellerPickup(pickupLocation);

            const apiRef = `BYB-PICKUP-${order.id}-${Date.now()}`;
            payment = await Payment.insert(client, {
                order_id: order.id,
                invoice_id: apiRef,
                email: seller.email,
                mobile_payment: mobilePayment,
                whatsapp_number: mobilePayment,
                amount: quote.feeAmount,
                status: 'pending',
                payment_method: 'paystack',
                api_ref: apiRef,
                metadata: {
                    order_id: order.id,
                    api_ref: apiRef,
                    payment_purpose: 'seller_pickup_fee',
                    logistics_payment_type: 'seller_pickup_fee',
                    seller_id: sellerId,
                    quote: {
                        fee_amount: quote.feeAmount,
                        distance_km: quote.distanceKm,
                        pricing_model: quote.pricingModel
                    }
                }
            });

            created = await LogisticsRequestService.createSellerPickupPaymentPending(client, {
                order,
                payment,
                quote,
                seller,
                pickupLocation,
                idempotencyKey
            });

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }

        const providerClient = deps.providerClient || new PaystackProviderClient();
        try {
            const result = await providerClient.initiatePayment({
                email: seller.email,
                amount: quote.feeAmount,
                invoice_id: payment.invoice_id,
                phone: mobilePayment,
                api_ref: payment.api_ref,
                narration: `Mzigo Ego pickup fee for order #${order.id}`,
                metadata: { order_id: order.id, api_ref: payment.api_ref, payment_purpose: 'seller_pickup_fee' }
            });

            if (result?.reference) {
                await pool.query(
                    `UPDATE payments SET provider_reference = COALESCE($1, provider_reference), updated_at = NOW() WHERE id = $2`,
                    [result.reference, payment.id]
                );
            }

            return {
                alreadyPending: false,
                paymentId: payment.id,
                requestId: created.request.id,
                pickupLegId: created.pickupLeg.id,
                amount: quote.feeAmount,
                currency: quote.currency,
                reference: result?.reference || payment.api_ref
            };
        } catch (error) {
            logger.error('[PaymentService] Failed to initiate seller pickup STK push', {
                orderId: order.id,
                paymentId: payment.id,
                error: error.message
            });
            await LogisticsRequestService.cancelPaymentPendingLegsAfterPaymentFailure({
                payment,
                order,
                reason: 'stk_initiation_failed'
            });
            throw error;
        }
    }

    /**
     * Check transaction status directly with the provider (Paystack).
     */
    async checkTransactionStatus(reference) {
        const paystack = new PaystackProviderClient();
        return paystack.checkTransactionStatus(reference);
    }

    /**
     * Check payment provider balance.
     */
    async checkBalance() {
        const paystack = new PaystackProviderClient();
        return paystack.checkBalance();
    }

    /**
     * Process pending payments within the given lookback window.
     * Claims pending payments with FOR UPDATE SKIP LOCKED and verifies status.
     *
     * @param {number} [hoursAgo=24]
     * @param {number} [limit=50]
     */
    async processPendingPayments(hoursAgo = 24, limit = 50) {
        return PaymentService.processPendingPayments(hoursAgo, limit);
    }

    /**
     * Static helper to process pending payments.
     *
     * @param {number} [hoursAgo=24]
     * @param {number} [limit=50]
     */
    static async processPendingPayments(hoursAgo = 24, limit = 50) {
        const client = await pool.connect();
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        const results = [];

        try {
            const { rows: pendingPayments } = await client.query(
                `SELECT * FROM payments
                 WHERE status = 'pending'::payment_status
                   AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
                 ORDER BY created_at ASC
                 LIMIT $2
                 FOR UPDATE SKIP LOCKED`,
                [hoursAgo, limit]
            );

            processedCount = pendingPayments.length;

            for (const payment of pendingPayments) {
                try {
                    const ref = payment.provider_reference || payment.api_ref || payment.invoice_id;
                    if (!ref) {
                        logger.warn(`[PaymentService] Pending payment ${payment.id} has no reference for status verification`);
                        continue;
                    }

                    const paystack = new PaystackProviderClient();
                    const verifiedPayload = await paystack.verifyTransaction(ref);
                    const completionResult = await CorePaymentService.completeVerifiedPayment({
                        reference: ref,
                        paymentId: payment.id,
                        providerPayload: verifiedPayload,
                        source: 'payment_cron'
                    });

                    if (completionResult.status === 'success') {
                        successCount += 1;
                    }
                    results.push(completionResult);
                } catch (err) {
                    const error = /** @type {Error} */ (err);
                    errorCount += 1;
                    logger.error(`[PaymentService] Error processing pending payment ${payment.id}:`, error.message);
                }
            }
            return {
                processedCount,
                successCount,
                errorCount,
                results
            };
        } finally {
            client.release();
        }
    }

    static async checkPaymentStatus(identifier) {
        const client = await pool.connect();
        try {
            const res = await client.query(
                'SELECT * FROM payments WHERE id = $1 OR reference = $2 OR provider_reference = $1 LIMIT 1',
                [identifier, identifier]
            );
            return res.rows[0] || null;
        } finally {
            client.release();
        }
    }

    static async hasSufficientBalance(requiredAmount, bufferPercent = 10) {
        const multiplier = 1 + (bufferPercent / 100);
        const threshold = requiredAmount * multiplier;
        return true;
    }

    static async _updatePaymentOnSuccess(client, paymentId, providerData) {
        const res = await client.query(
            "UPDATE payments SET status = $1, provider_data = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
            [PaymentStatus.SUCCESSFUL, JSON.stringify(providerData), paymentId]
        );
        return res.rows[0];
    }
}

const paymentService = new PaymentService();

export { CorePaymentService as PaymentLifecycleService };
export default paymentService;

