import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';
import { PaymentStatus } from '../shared/constants/enums.js';
import OrderService from './order.service.js';
import { assertValidTransition } from '../shared/utils/OrderStatusGuard.js';
import { normalizeProviderPaymentStatus } from '../shared/utils/paymentStatusNormalizer.js';
import { releaseOrderReservations } from '../shared/utils/reservationRelease.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import PaydProviderClient from '../providers/PaydProviderClient.js';
import PaystackProviderClient from '../providers/PaystackProviderClient.js';
import LogisticsQuoteService from './logisticsQuote.service.js';
import LogisticsRequestService from './logisticsRequest.service.js';
import CreatorService from './creator.service.js';
import Fees from '../config/fees.js';

const roundMoney = (amount) => Math.round(Number(amount) * 100) / 100;
const roundPayableTotal = (amount) => Math.ceil(roundMoney(amount));
const PRODUCT_SERVICE_CHARGE_RATE = Fees.PRODUCT_SERVICE_CHARGE_RATE;
const calculateProductServiceCharge = (amount) => Fees.calculateProductServiceCharge(amount);

const parseObject = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};

const isDoorDeliveryRequested = (delivery = {}, metadata = {}) => {
    return delivery.doorDelivery === true
        || delivery.door_delivery === true
        || metadata.doorDelivery === true
        || metadata.door_delivery === true
        || metadata.delivery_mode === 'DOOR_DELIVERY'
        || delivery.deliveryMode === 'DOOR_DELIVERY'
        || delivery.delivery_mode === 'DOOR_DELIVERY';
};

const extractDeliveryLocation = (delivery = {}, fallbackLocation = {}) => {
    const nested = delivery.buyerDeliveryLocation
        || delivery.buyer_delivery_location
        || delivery.buyerLocation
        || delivery.buyer_location
        || delivery.location
        || {};

    return {
        address: nested.address
            || nested.fullAddress
            || nested.full_address
            || delivery.address
            || delivery.fullAddress
            || delivery.full_address
            || fallbackLocation.address
            || null,
        latitude: nested.latitude
            ?? nested.lat
            ?? delivery.latitude
            ?? delivery.lat
            ?? fallbackLocation.lat
            ?? fallbackLocation.latitude
            ?? null,
        longitude: nested.longitude
            ?? nested.lng
            ?? delivery.longitude
            ?? delivery.lng
            ?? fallbackLocation.lng
            ?? fallbackLocation.longitude
            ?? null
    };
};

const assertDoorDeliveryLocation = (location = {}) => {
    if (typeof location.address !== 'string' || !location.address.trim()) {
        throw new Error('Door delivery address is required.');
    }

    if (location.latitude === null || location.latitude === undefined || location.longitude === null || location.longitude === undefined) {
        throw new Error('Door delivery coordinates are required.');
    }
};

const isSellerPickupFeePayment = (metadata = {}) => {
    return metadata.payment_purpose === 'seller_pickup_fee'
        || metadata.logistics_payment_type === 'seller_pickup_fee';
};

const resolvePaymentProvider = () => {
    const provider = String(process.env.PAYMENT_PROVIDER || 'payd').trim().toLowerCase();
    if (provider === 'paystack' || provider === 'payd') {
        return provider;
    }

    logger.warn('[PAYMENT-INIT] Unsupported PAYMENT_PROVIDER configured; falling back to payd', {
        configuredProvider: provider
    });
    return 'payd';
};

const extractPickupLocation = (location = {}) => ({
    address: location.address || location.fullAddress || location.full_address || null,
    latitude: location.latitude ?? location.lat ?? null,
    longitude: location.longitude ?? location.lng ?? null
});

const assertPickupLocation = (location = {}) => {
    if (typeof location.address !== 'string' || !location.address.trim()) {
        throw new Error('Pickup address is required.');
    }

    if (location.latitude === null || location.latitude === undefined || location.longitude === null || location.longitude === undefined) {
        throw new Error('Pickup coordinates are required.');
    }
};

const COMPLETED_PAYMENT_STATUSES = new Set(['completed', 'success', 'paid']);
const ACTIVE_PICKUP_STATUSES = new Set(['pending', 'assigned', 'started', 'picked_up', 'dropped_at_hub', 'out_for_delivery', 'delivered']);

export class PaymentService {
    constructor() {
        this.provider = resolvePaymentProvider();
        this.paymentProviderClient = this.provider === 'paystack'
            ? new PaystackProviderClient()
            : new PaydProviderClient();
        this.providerClient = this.paymentProviderClient;
        this.baseUrl = this.paymentProviderClient.baseUrl;
        this.httpsAgent = this.paymentProviderClient.httpsAgent;
        this.client = this.paymentProviderClient.client;

        logger.info('[PAYMENT-INIT] Payment provider selected', {
            provider: this.provider,
            baseUrl: this.baseUrl
        });
    }

    async createPaymentProviderAttempt(client, {
        paymentId,
        orderId,
        apiRef,
        idempotencyKey,
        requestPayload
    }) {
        await client.query(
            `INSERT INTO payment_provider_attempts
                (payment_id, order_id, api_ref, idempotency_key, status, request_payload, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'provider_call_pending', $5, NOW(), NOW())
             ON CONFLICT (payment_id) DO UPDATE
             SET api_ref = EXCLUDED.api_ref,
                 idempotency_key = COALESCE(EXCLUDED.idempotency_key, payment_provider_attempts.idempotency_key),
                 request_payload = EXCLUDED.request_payload,
                 updated_at = NOW()`,
            [
                paymentId,
                orderId,
                apiRef,
                idempotencyKey || null,
                JSON.stringify(requestPayload || {})
            ]
        );
    }

    async markPaymentProviderAttemptStarted(paymentId) {
        await pool.query(
            `UPDATE payment_provider_attempts
             SET status = 'provider_call_started',
                 attempts = attempts + 1,
                 last_attempt_at = NOW(),
                 updated_at = NOW()
             WHERE payment_id = $1`,
            [paymentId]
        );
    }

    async markPaymentProviderAttemptAccepted({ paymentId, providerReference, responsePayload }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT id FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);
            await client.query(
                `UPDATE payments
                 SET provider_reference = COALESCE($1, provider_reference),
                     updated_at = NOW()
                 WHERE id = $2`,
                [providerReference || null, paymentId]
            );
            await client.query(
                `UPDATE payment_provider_attempts
                 SET provider_reference = COALESCE($2, provider_reference),
                     status = 'provider_accepted',
                     response_payload = $3,
                     updated_at = NOW()
                 WHERE payment_id = $1`,
                [paymentId, providerReference || null, JSON.stringify(responsePayload || {})]
            );
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async markPaymentProviderAttemptFailed({ paymentId, errorPayload }) {
        await pool.query(
            `UPDATE payment_provider_attempts
             SET status = 'provider_call_failed',
                 error_payload = $2,
                 updated_at = NOW()
             WHERE payment_id = $1`,
            [paymentId, JSON.stringify(errorPayload || {})]
        );
    }

    isAmbiguousPaymentProviderError(error) {
        const status = error?.statusCode || error?.response?.status;
        const ambiguousCodes = new Set([
            'CONNECTION_FAILED',
            'TIMEOUT',
            'UNKNOWN_ERROR',
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN',
            'EPIPE',
            'ECONNABORTED'
        ]);

        if (ambiguousCodes.has(error?.code)) return true;
        if (Number.isFinite(status) && status >= 500) return true;
        if (!status && (error?.request || error?.code)) return true;

        return false;
    }

    async markPaymentProviderAttemptAmbiguous({ paymentId, errorPayload }) {
        await pool.query(
            `UPDATE payment_provider_attempts
             SET status = 'provider_result_ambiguous',
                 error_payload = $2,
                 updated_at = NOW()
             WHERE payment_id = $1`,
            [paymentId, JSON.stringify(errorPayload || {})]
        );
    }

    async markPaymentInitiationAmbiguous({ orderId, paymentId, reason, providerPayload = {} }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: paymentRows } = await client.query(
                `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
                [paymentId]
            );
            const { rows: orderRows } = await client.query(
                `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                [orderId]
            );

            const payment = paymentRows[0];
            const order = orderRows[0];

            if (!payment || !order) {
                throw new Error(`Cannot mark payment initiation ambiguous: missing payment/order (${paymentId}/${orderId})`);
            }

            const paymentStatus = String(payment.status || '').toLowerCase();
            const orderStatus = String(order.status || '').toUpperCase();
            const terminalPayment = ['completed', 'success', 'failed'].includes(paymentStatus);
            const terminalOrder = ['PAID', 'PROCESSING', 'FULFILLMENT_PENDING', 'FULFILLED', 'DELIVERED', 'BOOKED', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(orderStatus);

            if (!terminalPayment) {
                await client.query(
                    `UPDATE payments
                     SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        paymentId,
                        JSON.stringify({
                            needs_manual_review: true,
                            provider_result_ambiguous_manual_review_required: true,
                            ambiguous_provider_result: {
                                reason,
                                providerPayload,
                                recorded_at: new Date().toISOString()
                            }
                        })
                    ]
                );
            }

            if (!terminalOrder) {
                await client.query(
                    `UPDATE product_orders
                     SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        orderId,
                        JSON.stringify({
                            needs_manual_review: true,
                            provider_result_ambiguous_manual_review_required: true,
                            ambiguous_provider_result: {
                                reason,
                                providerPayload,
                                recorded_at: new Date().toISOString()
                            }
                        })
                    ]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async markPaymentInitiationFailed({ orderId, paymentId, reason, providerPayload = {} }) {
        const client = await pool.connect();
        let failedPayment = null;
        let failedOrder = null;
        try {
            await client.query('BEGIN');

            const { rows: paymentRows } = await client.query(
                `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
                [paymentId]
            );
            failedPayment = paymentRows[0];

            const { rows: orderRows } = await client.query(
                `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                [orderId]
            );
            failedOrder = orderRows[0];

            if (!failedPayment || !failedOrder) {
                throw new Error(`Cannot mark payment initiation failed: missing payment/order (${paymentId}/${orderId})`);
            }

            const paymentStatus = String(failedPayment.status || '').toLowerCase();
            const orderStatus = String(failedOrder.status || '').toUpperCase();
            const terminalPayment = ['completed', 'success', 'failed'].includes(paymentStatus);
            const terminalOrder = ['PAID', 'PROCESSING', 'FULFILLMENT_PENDING', 'FULFILLED', 'DELIVERED', 'BOOKED', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(orderStatus);

            if (terminalPayment || terminalOrder) {
                await client.query('COMMIT');
                return { payment: failedPayment, order: failedOrder, skipped: true };
            }

            const releaseResult = await releaseOrderReservations(client, orderId);
            const cancelledLogisticsLegs = await LogisticsRequestService.cancelPaymentPendingLegsForPaymentFailure(client, {
                orderId,
                paymentId,
                reason
            });
            const failureMetadata = {
                payment_initiation_failure: {
                    reason,
                    providerPayload,
                    released_inventory: releaseResult.releasedInventory,
                    released_slots: releaseResult.releasedSlots,
                    cancelled_logistics_legs: cancelledLogisticsLegs,
                    failed_at: new Date().toISOString()
                }
            };

            const { rows: updatedPayments } = await client.query(
                `UPDATE payments
                 SET status = 'failed',
                     metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [paymentId, JSON.stringify(failureMetadata)]
            );

            const { rows: updatedOrders } = await client.query(
                `UPDATE product_orders
                 SET status = 'FAILED',
                     payment_status = 'failed',
                     metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [orderId, JSON.stringify(failureMetadata)]
            );

            failedPayment = updatedPayments[0];
            failedOrder = updatedOrders[0];
            const durableEvent = await eventBus.enqueueInTransaction(client, AppEvents.PAYMENT.FAILED, {
                eventId: `payment.failed:${paymentId}:initiation`,
                payment: failedPayment,
                order: failedOrder,
                reason
            });

            await client.query('COMMIT');

            eventBus.dispatchAfterCommit(durableEvent.eventId, 'PaymentService.markInitiationFailed');

            return { payment: failedPayment, order: failedOrder, skipped: false };
        } catch (error) {
            await client.query('ROLLBACK').catch(rollbackError =>
                logger.error('[PAYMENT-INITIATE] Failed rollback while marking initiation failure:', rollbackError)
            );
            throw error;
        } finally {
            client.release();
        }
    }


    /**
     * Helper to retry requests with exponential backoff
     */
    async _retryRequest(fn, retries = 3, delay = 1000) {
        return this.providerClient._retryRequest(fn, retries, delay);
    }

    _shouldRetry(error, attempt, maxRetries) {
        return this.providerClient._shouldRetry(error, attempt, maxRetries);
    }

    _getRetryReason(error) {
        return this.providerClient._getRetryReason(error);
    }

    /**
     * Get Authorization Header for Basic Auth
     */
    getAuthHeader() {
        return this.providerClient.getAuthHeader();
    }

    /**
     * Initiate M-Pesa STK Push Payment
     * 
     * Endpoint: POST https://api.paystack.co/charge
     * Auth: Bearer token
     * 
     * @param {Object} paymentData
     * @param {string} paymentData.phone - Phone number (254XXXXXXXXX or 0XXXXXXXXX)
     * @param {number} paymentData.amount - Amount in KES
     * @param {string} paymentData.invoice_id - Unique reference
     * @param {string} paymentData.email - Buyer email
     * @param {string} [paymentData.first_name] - Buyer first name
     * @param {string} [paymentData.last_name] - Buyer last name
     * @param {string} [paymentData.callback_url] - Webhook URL
     * @returns {Promise<Object>}
     */
    async initiatePayment(paymentData) {
        const orderId = paymentData.metadata?.order_id || paymentData.order_id;
        if (orderId && !isSellerPickupFeePayment(paymentData.metadata || {})) {
            const { rows: orders } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [orderId]);
            if (orders.length > 0) {
                assertValidTransition(orders[0].status, 'PAYMENT_PENDING', orderId);
                await pool.query('UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['PAYMENT_PENDING', orderId]);
                logger.info('[PAYMENT-INIT] Order ' + orderId + ' transitioned to PAYMENT_PENDING');
            }
        }

        return this.providerClient.initiatePayment(paymentData);
    }

    /**
     * Normalize phone number for PAYMENT (STK Push)
     * Paystack M-Pesa charges use normalized Kenyan phone numbers.
     * 
     * @param {string|number} phone
     * @returns {string} e.g., "254712345678" or "0712345678"
     */
    normalizePhoneForPayment(phone) {
        return this.providerClient.normalizePhoneForPayment(phone);
    }

    /**
     * Monitor HTTPS agent health
     */
    getAgentStatus() {
        return this.providerClient.getAgentStatus();
    }

    /**
     * Reset HTTPS agent (use if connections are stale)
     */
    resetAgent() {
        return this.providerClient.resetAgent();
    }

    /**
     * Legacy callback entrypoint.
     */
    async handleProviderCallback(callbackData) {
        throw new Error('Legacy payment callback entrypoint is disabled. Use the verified payment webhook controller.');
    }

    /**
     * Parse and validate legacy callback data
     * @private
     */
    _parseCallbackData(callbackData) {
        const data = callbackData.data || callbackData;
        const reference = data.transaction_reference;
        const status = data.status?.toLowerCase();
        const amount = Number.parseFloat(data.amount || 0);
        const phone = data.phone_number;
        const resultCode = data.result_code || callbackData.result_code;
        const mpesaReceipt = data.third_party_trans_id || null;

        if (!reference) {
            logger.error('[PAYMENT-WEBHOOK] Missing reference in payload', callbackData);
            throw new Error('Webhook missing transaction reference');
        }

        const resultCodeNum = Number.parseInt(resultCode, 10);
        // FIXED BUG-PAY-SEC-03: don't require 'success' boolean — result_code=0 is authoritative
        const isSuccess = (resultCodeNum === 0 || resultCodeNum === 200 || status === 'success') &&
            (data.success === undefined || data.success === true || data.success === 'true');

        return { reference, isSuccess, amount, phone, mpesaReceipt, status };
    }

    async _updatePaymentOnCallback() {
        throw new Error('Legacy payment callback mutation is disabled. Use CorePaymentService.completeVerifiedPayment().');
    }

    async handleSuccessfulPayment() {
        throw new Error('Legacy payment success mutation is disabled. Use CorePaymentService.completeVerifiedPayment().');
    }

    async _updatePaymentOnSuccess() {
        throw new Error('Legacy payment success mutation is disabled. Use CorePaymentService.completeVerifiedPayment().');
    }


    /**
     * Map provider status to internal status
     * @private
     */
    _mapProviderStatus(providerData) {
        return normalizeProviderPaymentStatus(providerData);
    }

    async _handleDownstreamOrderAction() {
        throw new Error('Legacy downstream fulfillment is disabled. Use fulfillment queue from CorePaymentService.');
    }

    async checkPaymentStatus(identifier) {
        // Public/status polling identifiers are provider/order-facing references.
        // They must never resolve through payments.id because numeric provider refs
        // can collide with unrelated internal payment ids.
        const query = `
            SELECT * FROM payments 
            WHERE provider_reference = $1
               OR invoice_id = $1 
               OR api_ref = $1 
            ORDER BY id ASC
            LIMIT 1
        `;
        const { rows } = await pool.query(query, [String(identifier)]);
        const payment = rows[0];

        if (!payment) throw new Error('Payment not found');

        // If payment is pending and we have a provider_reference, check provider status
        if (payment.status === PaymentStatus.PENDING && payment.provider_reference) {
            try {
                const providerStatus = await this.checkTransactionStatus(payment.provider_reference);
                const normalizedStatus = providerStatus.status; // already lowercased in checkTransactionStatus

                if (['success', 'completed', 'processed', 'paid'].includes(normalizedStatus)) {
                    const { default: CorePaymentService } = await import('../core/CorePaymentService.js');
                    const completion = await CorePaymentService.completeVerifiedPayment({
                        paymentId: payment.id,
                        reference: payment.provider_reference,
                        providerPayload: {
                            ...providerStatus,
                            status: normalizedStatus
                        },
                        source: 'status_polling'
                    });
                    logger.info('[PaymentService] Polling delegated payment completion to Core path', {
                        paymentId: payment.id,
                        completionStatus: completion.status
                    });
                    payment.status = completion.payment?.status || PaymentStatus.COMPLETED;
                }
                // REMOVED: Auto-fail update. We should not mark as failed in the poller to avoid race conditions with webhooks.
                // Webhooks and Cron are the authoritative sources for failure.
                // else if (normalizedStatus === 'failed' || normalizedStatus === 'fail' || normalizedStatus === 'declined') { ... }
            } catch (err) {
                logger.warn('[PaymentService] Status sync during check failed', err.message);
            }
        }

        // If payment is successful and has buyer info, generate auto-login token
        let autoLoginToken = null;
        const buyerProfileId = null; // public status checks must not mint login tokens

        if ((payment.status === 'completed' || payment.status === 'success') && buyerProfileId) {
            try {
                // Look up the users.id from buyers.id (signAutoLoginToken needs users.id)
                const { rows: buyerRows } = await pool.query(
                    'SELECT user_id FROM buyers WHERE id = $1',
                    [buyerProfileId]
                );
                const userId = buyerRows[0]?.user_id;

                if (userId) {
                    const { signAutoLoginToken } = await import('../shared/utils/jwt.js');
                    autoLoginToken = signAutoLoginToken(userId, 'buyer', 'payment_success');
                    logger.info(`[PaymentService] Generated auto-login token for buyer ${buyerProfileId} (user ${userId})`);
                } else {
                    logger.warn(`[PaymentService] Buyer ${buyerProfileId} has no user_id — cannot generate auto-login token`);
                }
            } catch (error) {
                logger.error('[PaymentService] Failed to generate auto-login token:', error);
            }
        }

        return {
            ...payment,
            autoLoginToken
        };
    }

    /**
     * Check transaction status
     * 
     * Endpoint: GET https://api.paystack.co/transaction/verify/{reference}
     * Auth: Bearer token
     * 
     * @param {string} transactionId - provider transaction reference
     * @returns {Promise<Object>}
     */
    async checkTransactionStatus(transactionId) {
        return this.providerClient.checkTransactionStatus(transactionId);
    }

    /**
     * Poll transaction status until completion (with timeout)
     * 
     * @param {string} transactionId
     * @param {Object} options
     * @param {number} options.maxAttempts - Max polling attempts (default: 60)
     * @param {number} options.intervalMs - Polling interval in ms (default: 5000)
     * @param {Array<string>} options.finalStatuses - Status values that end polling
     * @returns {Promise<Object>}
     */
    async pollTransactionStatus(transactionId, options = {}) {
        return this.providerClient.pollTransactionStatus(transactionId, options);
    }

    /**
     * Check payment provider platform account balance
     * 
     * @returns {Promise<Object>}
     */
    async checkBalance() {
        return this.providerClient.checkBalance();
    }

    /**
     * Check if platform has sufficient balance for a transaction
     * 
     * @param {number} requiredAmount - Amount needed in KES
     * @param {number} bufferPercent - Safety buffer % (default: 10)
     * @returns {Promise<{sufficient: boolean, available: number, required: number}>}
     */
    async hasSufficientBalance(requiredAmount, bufferPercent = 10) {
        return this.providerClient.hasSufficientBalance(requiredAmount, bufferPercent);
    }

    /**
     * Extract error details from Axios error
     * 
     * @private
     * @param {Error} error - Axios error object
     * @returns {Object}
     */
    _extractErrorDetails(error) {
        return this.providerClient._extractErrorDetails(error);
    }

    /**
     * Check container networking (DNS + HTTPS) to payment provider
     * @returns {Promise<Object>}
     */
    async getNetworkStatus() {
        return this.providerClient.getNetworkStatus();
    }

    /**
     * Handle provider API errors.
     * 
     * @private
     * @param {Error} error - Original error
     * @returns {Error}
     */
    _handleProviderError(error) {
        if (typeof this.providerClient._handlePaystackError === 'function') {
            return this.providerClient._handlePaystackError(error);
        }
        if (typeof this.providerClient._handlePaydError === 'function') {
            return this.providerClient._handlePaydError(error);
        }
        return error;
    }

    /**
     * Process pending payments (Called by Cron)
     */
    async processPendingPayments(hoursAgo = 24, limit = 50) {
        const results = {
            processedCount: 0,
            successCount: 0,
            errorCount: 0,
            failedCount: 0,
            orphanedCount: 0
        };

        try {
            // 1. Claim pending payments with row locks so concurrent cron instances
            // cannot verify and complete the same payment at the same time.
            const claimClient = await pool.connect();
            let pendingPayments = [];
            try {
                await claimClient.query('BEGIN');
                const { rows } = await claimClient.query(
                    `WITH claimed AS (
                       SELECT id
                       FROM payments
                       WHERE status = 'pending'
                         AND created_at > NOW() - ($1 * INTERVAL '1 hour')
                         AND created_at < NOW() - INTERVAL '1 minute'
                         AND (
                           metadata->>'cron_claimed_until' IS NULL
                           OR (metadata->>'cron_claimed_until')::timestamptz < NOW()
                         )
                       ORDER BY created_at ASC
                       LIMIT $2
                       FOR UPDATE SKIP LOCKED
                     )
                     UPDATE payments p
                     SET metadata = COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object(
                           'cron_claimed_at', NOW(),
                           'cron_claimed_until', NOW() + INTERVAL '5 minutes'
                         ),
                         updated_at = NOW()
                     FROM claimed
                     WHERE p.id = claimed.id
                     RETURNING p.*`,
                    [hoursAgo, limit]
                );
                pendingPayments = rows;
                await claimClient.query('COMMIT');
            } catch (claimErr) {
                await claimClient.query('ROLLBACK').catch(() => {});
                throw claimErr;
            } finally {
                claimClient.release();
            }

            results.processedCount = pendingPayments.length;

            if (pendingPayments.length === 0) return results;

            logger.info(`Found ${pendingPayments.length} pending payments to check`);

            // 2. Process each
            for (const payment of pendingPayments) {
                try {
                    // Calculate payment age in minutes
                    const ageMinutes = Math.floor((new Date() - new Date(payment.created_at)) / 60000);

                    const statusReference = payment.provider_reference || payment.api_ref;

                    // Skip payments without any durable provider lookup reference
                    if (!statusReference) {
                        // If payment is older than 30 minutes and has no provider reference,
                        continue;
                    }

                    // Attempt retrieval from Provider
                    let providerStatus = null;
                    let providerData = null;
                    let is404Error = false;

                    try {
                        providerData = await this.checkTransactionStatus(statusReference);
                        providerStatus = providerData.status;
                    } catch (netErr) {
                        // Check if it's a 404 error
                        if (netErr.response?.status === 404) {
                            // 404 from undocumented endpoint — this is NOT a payment failure.
                            // Flag for manual review after 2 hours, but do NOT auto-fail.
                            if (ageMinutes > 120) {
                                logger.warn(`[CRON] Payment ${payment.id} pending >2hr with no webhook received. Flag for manual review.`);
                                await pool.query(
                                    `UPDATE payments SET metadata = jsonb_set(COALESCE(metadata,'{}'), '{needs_manual_review}', 'true') WHERE id = $1`,
                                    [payment.id]
                                );
                            }
                            continue;
                        } else {
                            // For other errors (network issues, timeouts, etc.), just log
                            logger.warn(`Failed to check status for ${payment.id}: ${netErr.message}`);
                        }
                    }

                    // Process based on determined status
                    if ([PaymentStatus.COMPLETED, PaymentStatus.SUCCESS, PaymentStatus.PAID].includes(providerStatus)) {
                        logger.info(`Payment ${payment.id} verified as SUCCESS via Cron`);
                        const { default: CorePaymentService } = await import('../core/CorePaymentService.js');
                        await CorePaymentService.completeVerifiedPayment({
                            paymentId: payment.id,
                            reference: statusReference,
                            providerPayload: {
                                ...(providerData || {}),
                                api_ref: payment.api_ref,
                                status: providerStatus
                            },
                            source: 'payment_cron'
                        });
                        results.successCount++;
                    } else if (providerStatus === 'failed') {
                        const failureReason = is404Error
                            ? 'Payment not found in provider system (404)'
                            : (providerData?.remarks || providerData?.status_description || 'Payment failed');

                        logger.info(`Payment ${payment.id} verified as FAILED via Cron - Reason: ${failureReason}`);
                        const { default: CorePaymentService } = await import('../core/CorePaymentService.js');
                        await CorePaymentService.completeVerifiedPayment({
                            paymentId: payment.id,
                            reference: statusReference,
                            providerPayload: {
                                ...(providerData || {}),
                                api_ref: payment.api_ref,
                                status: 'failed',
                                failure_reason: failureReason
                            },
                            source: 'payment_cron'
                        });

                        results.failedCount++;
                    }

                } catch (innerErr) {
                    logger.error(`Error processing pending payment ${payment.id}:`, innerErr);
                    results.errorCount++;
                }
            }

            // Log summary if any payments were processed
            if (results.processedCount > 0) {
                logger.info(`Payment processing summary:`, {
                    processed: results.processedCount,
                    successful: results.successCount,
                    failed: results.failedCount,
                    orphaned: results.orphanedCount,
                    errors: results.errorCount
                });
            }

        } catch (error) {
            logger.error('Error in processPendingPayments:', error);
            throw error;
        }

        return results;
    }

    async markLogisticsPaymentInitiationAmbiguous({ orderId, paymentId, reason, providerPayload = {} }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `UPDATE payments
                 SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [
                    paymentId,
                    JSON.stringify({
                        needs_manual_review: true,
                        logistics_payment_ambiguous: true,
                        ambiguous_provider_result: {
                            reason,
                            providerPayload,
                            recorded_at: new Date().toISOString()
                        }
                    })
                ]
            );
            await client.query(
                `UPDATE logistics_legs ll
                 SET metadata = ll.metadata || $3::jsonb,
                     updated_at = NOW()
                 FROM logistics_requests lr
                 WHERE ll.logistics_request_id = lr.id
                   AND lr.order_id = $1
                   AND ll.payment_id = $2
                   AND ll.status = 'payment_pending'`,
                [
                    orderId,
                    paymentId,
                    JSON.stringify({
                        logistics_payment_ambiguous: true,
                        reason,
                        recorded_at: new Date().toISOString()
                    })
                ]
            );
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async markLogisticsPaymentInitiationFailed({ orderId, paymentId, reason, providerPayload = {} }) {
        const client = await pool.connect();
        let failedPayment = null;
        let order = null;
        try {
            await client.query('BEGIN');

            const { rows: paymentRows } = await client.query(
                `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
                [paymentId]
            );
            failedPayment = paymentRows[0];

            const { rows: orderRows } = await client.query(
                `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
                [orderId]
            );
            order = orderRows[0] || null;

            if (!failedPayment) {
                throw new Error(`Cannot mark logistics payment initiation failed: missing payment ${paymentId}`);
            }

            const paymentStatus = String(failedPayment.status || '').toLowerCase();
            if (['completed', 'success', 'failed'].includes(paymentStatus)) {
                await client.query('COMMIT');
                return { payment: failedPayment, order, skipped: true };
            }

            const cancelledLogisticsLegs = await LogisticsRequestService.cancelPaymentPendingLegsForPaymentFailure(client, {
                orderId,
                paymentId,
                reason
            });
            const failureMetadata = {
                logistics_payment_initiation_failure: {
                    reason,
                    providerPayload,
                    cancelled_logistics_legs: cancelledLogisticsLegs,
                    failed_at: new Date().toISOString()
                }
            };

            const { rows: updatedPayments } = await client.query(
                `UPDATE payments
                 SET status = 'failed',
                     metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [paymentId, JSON.stringify(failureMetadata)]
            );
            failedPayment = updatedPayments[0];

            const durableEvent = await eventBus.enqueueInTransaction(client, AppEvents.PAYMENT.FAILED, {
                eventId: `payment.failed:${paymentId}:logistics-initiation`,
                payment: failedPayment,
                order,
                reason
            });

            await client.query('COMMIT');

            eventBus.dispatchAfterCommit(durableEvent.eventId, 'PaymentService.markLogisticsInitiationFailed');

            return { payment: failedPayment, order, skipped: false };
        } catch (error) {
            await client.query('ROLLBACK').catch(rollbackError =>
                logger.error('[PAYMENT-INITIATE] Failed rollback while marking logistics initiation failure:', rollbackError)
            );
            throw error;
        } finally {
            client.release();
        }
    }

    async initiateSellerPickupPayment({
        orderId,
        sellerId,
        pickupLocation,
        mobilePayment,
        idempotencyKey = null
    }) {
        const normalizedOrderId = Number.parseInt(orderId, 10);
        const normalizedSellerId = Number.parseInt(sellerId, 10);

        if (!Number.isSafeInteger(normalizedOrderId) || normalizedOrderId <= 0) {
            throw new Error('Valid order id is required');
        }
        if (!Number.isSafeInteger(normalizedSellerId) || normalizedSellerId <= 0) {
            throw new Error('Valid seller id is required');
        }
        if (!mobilePayment || typeof mobilePayment !== 'string') {
            throw new Error('Seller mobile payment number is required');
        }

        const pickup = extractPickupLocation(pickupLocation || {});
        assertPickupLocation(pickup);

        const quote = LogisticsQuoteService.quoteSellerPickup(pickup);
        if (quote.feeAmount <= 0) {
            throw new Error('Pickup fee must be greater than zero. Sellers at the hub should drop the package directly.');
        }

        const client = await pool.connect();
        let gwPayload = null;
        let payment = null;
        let order = null;
        let logisticsSummary = null;
        let transactionCommitted = false;

        try {
            await client.query('BEGIN');

            const { rows: orderRows } = await client.query(
                `SELECT o.*,
                        s.full_name AS seller_name,
                        s.shop_name,
                        s.email AS seller_email,
                        s.whatsapp_number AS seller_whatsapp_number
                 FROM product_orders o
                 JOIN sellers s ON s.id = o.seller_id
                 WHERE o.id = $1
                   AND o.seller_id = $2
                 FOR UPDATE OF o`,
                [normalizedOrderId, normalizedSellerId]
            );
            order = orderRows[0];

            if (!order) {
                throw new Error('Order not found for this seller');
            }

            if (!COMPLETED_PAYMENT_STATUSES.has(String(order.payment_status || '').toLowerCase())) {
                throw new Error('Pickup can only be requested after the buyer payment is completed');
            }

            const { rows: itemRows } = await client.query(
                `SELECT oi.id,
                        oi.product_name,
                        oi.quantity,
                        COALESCE(oi.metadata->>'productType', p.product_type::text, 'physical') AS product_type,
                        COALESCE(p.is_digital, false) AS is_digital
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = $1
                 ORDER BY oi.id ASC`,
                [normalizedOrderId]
            );

            const orderMetadata = parseObject(order.metadata);
            const fulfillmentType = String(order.fulfillment_type || order.fulfillmentType || '').toUpperCase();
            const hasPhysicalItem = itemRows.length
                ? itemRows.some(item => {
                    const type = String(item.product_type || '').toLowerCase();
                    return type !== 'digital' && type !== 'service' && item.is_digital !== true;
                })
                : String(orderMetadata.product_type || 'physical').toLowerCase() === 'physical';

            if (!hasPhysicalItem) {
                throw new Error('Pickup is only available for physical product orders');
            }

            if (fulfillmentType !== 'COURIER') {
                throw new Error('Mzigo pickup is only available for courier orders from online shops. Shop pickup orders must be collected from the seller address.');
            }

            const { rows: existingPickupRows } = await client.query(
                `SELECT ll.*, p.status AS payment_status, p.provider_reference
                 FROM logistics_requests lr
                 JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
                                      AND ll.leg_type = 'pickup'
                 LEFT JOIN payments p ON p.id = ll.payment_id
                 WHERE lr.order_id = $1
                 FOR UPDATE OF ll`,
                [normalizedOrderId]
            );
            const existingPickup = existingPickupRows[0];

            if (existingPickup) {
                const pickupStatus = String(existingPickup.status || '').toLowerCase();
                const paymentStatus = String(existingPickup.payment_status || '').toLowerCase();

                if (ACTIVE_PICKUP_STATUSES.has(pickupStatus)) {
                    throw new Error('Pickup is already active for this order');
                }

                if (pickupStatus === 'payment_pending' && paymentStatus === 'pending') {
                    await client.query('COMMIT');
                    transactionCommitted = true;
                    return {
                        success: true,
                        pending: true,
                        alreadyPending: true,
                        orderId: order.id,
                        paymentId: existingPickup.payment_id,
                        logistics: {
                            request_id: existingPickup.logistics_request_id,
                            pickup_leg_id: existingPickup.id,
                            package_code: `BYB-LOG-${order.id}`,
                            status: 'payment_pending',
                            pickup_leg_status: 'payment_pending'
                        },
                        paymentResult: {
                            reference: existingPickup.provider_reference,
                            status: paymentStatus,
                            message: 'Pickup payment is already pending confirmation.'
                        }
                    };
                }
            }

            const apiRef = `BYB-PU-${order.id}-${Date.now()}`;
            const invoiceId = `PICKUP-${order.id}-${Date.now()}`;
            const provider = this.provider;
            const paymentMetadata = {
                payment_purpose: 'seller_pickup_fee',
                logistics_payment_type: 'seller_pickup_fee',
                order_id: order.id,
                seller_id: normalizedSellerId,
                api_ref: apiRef,
                pickup: {
                    address: pickup.address,
                    latitude: pickup.latitude,
                    longitude: pickup.longitude,
                    quote: {
                        leg_type: quote.legType,
                        payer: quote.payer,
                        currency: quote.currency,
                        rate_kes_per_km: quote.rateKesPerKm,
                        distance_km: quote.distanceKm,
                        chargeable_distance_km: quote.chargeableDistanceKm,
                        fee_amount: quote.feeAmount,
                        origin: quote.origin,
                        destination: quote.destination
                    }
                },
                narration: `Pickup fee for order ${order.order_number || order.id}`
            };

            const insertRes = await client.query(
                `INSERT INTO payments (invoice_id, email, mobile_payment, whatsapp_number, amount, status, payment_method, api_ref, metadata)
                  VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8::jsonb)
                  RETURNING *`,
                [
                    invoiceId,
                    order.seller_email || null,
                    mobilePayment,
                    order.seller_whatsapp_number || mobilePayment,
                    quote.feeAmount,
                    provider,
                    apiRef,
                    JSON.stringify(paymentMetadata)
                ]
            );
            payment = insertRes.rows[0];

            const logisticsRecords = await LogisticsRequestService.createSellerPickupPaymentPending(client, {
                order,
                payment,
                quote,
                seller: {
                    id: normalizedSellerId,
                    full_name: order.seller_name,
                    shop_name: order.shop_name,
                    email: order.seller_email,
                    whatsapp_number: order.seller_whatsapp_number
                },
                pickupLocation: pickup,
                idempotencyKey
            });

            logisticsSummary = {
                request_id: logisticsRecords.request.id,
                pickup_leg_id: logisticsRecords.pickupLeg.id,
                partner_id: logisticsRecords.partner.id,
                package_code: logisticsRecords.request.package_code,
                status: logisticsRecords.request.status,
                pickup_leg_status: logisticsRecords.pickupLeg.status
            };

            paymentMetadata.pickup.logistics = logisticsSummary;
            await client.query(
                `UPDATE payments
                 SET metadata = $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [payment.id, JSON.stringify(paymentMetadata)]
            );

            await client.query(
                `UPDATE product_orders
                 SET metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{delivery,logistics}',
                        COALESCE(metadata->'delivery'->'logistics', '{}'::jsonb) || $2::jsonb,
                        true
                     ),
                     updated_at = NOW()
                 WHERE id = $1`,
                [order.id, JSON.stringify(logisticsSummary)]
            );

            gwPayload = {
                invoice_id: invoiceId,
                api_ref: apiRef,
                amount: quote.feeAmount,
                currency: 'KES',
                status: PaymentStatus.PENDING,
                payment_method: provider,
                phone_number: mobilePayment,
                phone: mobilePayment,
                email: order.seller_email || undefined,
                firstName: order.seller_name?.split(' ')[0],
                narration: `Pickup fee for order ${order.order_number || order.id}`,
                metadata: paymentMetadata
            };

            await this.createPaymentProviderAttempt(client, {
                paymentId: payment.id,
                orderId: order.id,
                apiRef,
                idempotencyKey,
                requestPayload: gwPayload
            });

            await client.query('COMMIT');
            transactionCommitted = true;

            try {
                await this.markPaymentProviderAttemptStarted(payment.id);
                const result = await this.initiatePayment(gwPayload);

                try {
                    await this.markPaymentProviderAttemptAccepted({
                        paymentId: payment.id,
                        providerReference: result.reference,
                        responsePayload: result
                    });
                } catch (persistError) {
                    logger.error('[PICKUP-PAYMENT] Provider accepted pickup payment but local reference persistence failed', {
                        paymentId: payment.id,
                        orderId: order.id,
                        apiRef,
                        providerReference: result.reference,
                        error: persistError.message
                    });

                    await this.markLogisticsPaymentInitiationAmbiguous({
                        orderId: order.id,
                        paymentId: payment.id,
                        reason: 'provider_reference_persistence_failed',
                        providerPayload: {
                            provider_reference: result.reference,
                            api_ref: apiRef,
                            persistence_error: persistError.message,
                            response: result
                        }
                    }).catch(error => logger.error('[PICKUP-PAYMENT] Failed to persist ambiguous pickup payment state:', error.message));

                    return {
                        success: true,
                        pending: true,
                        ambiguous: true,
                        orderId: order.id,
                        paymentId: payment.id,
                        logistics: logisticsSummary,
                        paymentResult: {
                            reference: result.reference || apiRef,
                            status: 'pending',
                            message: 'Pickup payment request was accepted and is pending confirmation.'
                        }
                    };
                }

                return {
                    success: true,
                    orderId: order.id,
                    paymentId: payment.id,
                    logistics: logisticsSummary,
                    quote,
                    paymentResult: result
                };
            } catch (gwError) {
                logger.error('[PICKUP-PAYMENT] Gateway initiation failed:', gwError);
                const errorPayload = {
                    message: gwError.message,
                    code: gwError.code,
                    status: gwError.statusCode || gwError.response?.status,
                    data: gwError.details || gwError.response?.data
                };

                if (this.isAmbiguousPaymentProviderError(gwError)) {
                    await this.markPaymentProviderAttemptAmbiguous({
                        paymentId: payment.id,
                        errorPayload
                    }).catch(error => logger.error('[PICKUP-PAYMENT] Failed to persist ambiguous provider attempt:', error.message));

                    await this.markLogisticsPaymentInitiationAmbiguous({
                        orderId: order.id,
                        paymentId: payment.id,
                        reason: gwError.message || 'gateway_result_ambiguous',
                        providerPayload: errorPayload
                    });

                    return {
                        success: true,
                        pending: true,
                        ambiguous: true,
                        orderId: order.id,
                        paymentId: payment.id,
                        logistics: logisticsSummary,
                        paymentResult: {
                            reference: apiRef,
                            status: 'pending',
                            message: 'Pickup payment request is pending provider confirmation.'
                        }
                    };
                }

                await this.markPaymentProviderAttemptFailed({
                    paymentId: payment.id,
                    errorPayload
                }).catch(error => logger.error('[PICKUP-PAYMENT] Failed to persist provider attempt failure:', error.message));

                await this.markLogisticsPaymentInitiationFailed({
                    orderId: order.id,
                    paymentId: payment.id,
                    reason: gwError.message || 'gateway_initiation_failed',
                    providerPayload: errorPayload
                });

                const failure = new Error('Pickup payment initiation failed before STK push. No payment was triggered; please try again.');
                failure.orderId = order.id;
                failure.paymentId = payment.id;
                throw failure;
            }
        } catch (error) {
            if (!transactionCommitted) {
                await client.query('ROLLBACK').catch(() => {});
            }
            logger.error('[PICKUP-PAYMENT] Transaction failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }


    async initiateProductPayment(normalizedOrder) {
        const { buyer, service, location, metadata, idempotencyKey } = normalizedOrder;

        const buyerId = buyer.id;
        const buyerEmail = buyer.email;
        const buyerMobilePayment = buyer.phone;
        const buyerWhatsApp = buyer.phone;

        // 1. Resolve & Validate Product/Seller
        const productResult = await pool.query(
            `SELECT p.*,
                    s.id as seller_id_from_seller,
                    s.status as seller_status,
                    s.full_name as seller_name,
                    s.shop_name,
                    s.email as seller_email,
                    s.whatsapp_number as seller_whatsapp_number,
                    s.city as seller_city,
                    s.location as seller_location,
                    s.physical_address as seller_physical_address,
                    s.latitude as seller_latitude,
                    s.longitude as seller_longitude
             FROM products p
             JOIN sellers s ON p.seller_id = s.id
             WHERE p.id = $1`,
            [service.id]
        );

        if (productResult.rows.length === 0) throw new Error('Product not found');
        const product = productResult.rows[0];

        if (product.seller_status !== 'active') throw new Error('Seller is not accepting orders');

        // 2. Security: Calculate secure product total and backend-owned logistics fee.
        const dbPrice = Number.parseFloat(product.price || 0);
        const quantity = Number.parseInt(service.quantity || 1);
        const productSubtotal = roundMoney(dbPrice * quantity);
        const productType = String(product.product_type || '').toLowerCase();
        const isDigitalProduct = product.is_digital === true || productType === 'digital';
        const isServiceProduct = productType === 'service';
        const isPhysicalProduct = !isDigitalProduct && !isServiceProduct;
        const deliveryRequest = metadata.delivery || {};
        const wantsDoorDelivery = isDoorDeliveryRequested(deliveryRequest, metadata);
        let deliveryQuote = null;
        let buyerDeliveryFee = 0;

        if (wantsDoorDelivery) {
            if (!isPhysicalProduct) {
                throw new Error('Door delivery is only available for physical products.');
            }

            const buyerDeliveryLocation = extractDeliveryLocation(deliveryRequest, location);
            assertDoorDeliveryLocation(buyerDeliveryLocation);
            deliveryQuote = LogisticsQuoteService.quoteBuyerDoorDelivery(buyerDeliveryLocation);
            buyerDeliveryFee = deliveryQuote.feeAmount;
        }

        const paymentBaseTotal = roundMoney(productSubtotal + buyerDeliveryFee);
        const productServiceCharge = calculateProductServiceCharge(productSubtotal);
        const payableTotal = roundPayableTotal(paymentBaseTotal + productServiceCharge);

        if (payableTotal <= 0) throw new Error('Invalid order amount after secure calculation');

        if (idempotencyKey) {
            const { rows: existing } = await pool.query(
                `SELECT po.id AS order_id,
                        po.order_number,
                        p.id AS payment_id,
                        p.provider_reference,
                        p.status AS payment_status
                 FROM product_orders po
                 LEFT JOIN payments p ON p.metadata->>'order_id' = po.id::text
                 WHERE po.client_checkout_token = $1
                 ORDER BY p.created_at DESC NULLS LAST
                 LIMIT 1`,
                [idempotencyKey]
            );
            if (existing.length) {
                logger.info('[PAYMENT-INITIATE] Returning existing checkout attempt', {
                    idempotencyKey,
                    orderId: existing[0].order_id,
                    paymentId: existing[0].payment_id
                });
                return {
                    success: true,
                    idempotent: true,
                    orderId: existing[0].order_id,
                    orderNumber: existing[0].order_number,
                    paymentId: existing[0].payment_id,
                    paymentResult: {
                        reference: existing[0].provider_reference,
                        status: existing[0].payment_status
                    }
                };
            }
        }

        if (product.status !== 'available') throw new Error('Product not available');

        const creatorCode = metadata.creator_code || metadata.creatorCode || metadata.creator;
        const creatorAttribution = await CreatorService.resolveAttribution({
            code: creatorCode,
            sellerId: Number.parseInt(product.seller_id, 10),
            productSubtotal
        });

        // 4. Create Order (PIN-02: UNIFIED ORDER CONTEXT)
        const provider = this.provider;
        const orderData = {
            ...normalizedOrder,
            payment: {
                ...(normalizedOrder.payment || {}),
                method: provider
            },
            sellerId: Number.parseInt(product.seller_id),
            service: {
                ...service,
                price: dbPrice,
                quantity: quantity,
                total: payableTotal,
                title: product.name
            },
            metadata: {
                ...metadata,
                client_checkout_token: idempotencyKey || metadata.client_checkout_token || null,
                product_type: product.product_type,
                is_digital: product.is_digital,
                product_id: service.id,
                product_name: product.name,
                creator_attribution: creatorAttribution,
                pricing: {
                    ...(metadata.pricing || {}),
                    product_subtotal: productSubtotal,
                    buyer_delivery_fee: buyerDeliveryFee,
                    buyer_service_charge_rate: PRODUCT_SERVICE_CHARGE_RATE,
                    buyer_service_charge: productServiceCharge,
                    product_service_charge_rate: PRODUCT_SERVICE_CHARGE_RATE,
                    product_service_charge: productServiceCharge,
                    creator_attribution: creatorAttribution,
                    payment_base_total: paymentBaseTotal,
                    payable_total: payableTotal,
                    seller_payout_base: productSubtotal,
                    creator_commission_amount: creatorAttribution?.commission_amount || 0,
                    seller_payout_excludes_delivery_fee: true
                },
                delivery: {
                    ...deliveryRequest,
                    doorDelivery: wantsDoorDelivery,
                    door_delivery: wantsDoorDelivery,
                    delivery_mode: wantsDoorDelivery
                        ? 'DOOR_DELIVERY'
                        : (deliveryRequest.delivery_mode || deliveryRequest.deliveryMode || null),
                    buyer_pays_delivery_fee: wantsDoorDelivery,
                    seller_payout_excludes_delivery_fee: true,
                    quote: deliveryQuote ? {
                        leg_type: deliveryQuote.legType,
                        payer: deliveryQuote.payer,
                        currency: deliveryQuote.currency,
                        rate_kes_per_km: deliveryQuote.rateKesPerKm,
                        distance_km: deliveryQuote.distanceKm,
                        chargeable_distance_km: deliveryQuote.chargeableDistanceKm,
                        fee_amount: deliveryQuote.feeAmount,
                        origin: deliveryQuote.origin,
                        destination: deliveryQuote.destination
                    } : null
                },
                items: [{
                    productId: service.id,
                    name: product.name,
                    price: dbPrice,
                    quantity: quantity,
                    subtotal: productSubtotal,
                    productType: product.product_type,
                    isDigital: product.is_digital,
                    serviceLocations: product.service_locations
                }]
            }
        };

        const client = await pool.connect();
        let gwPayload = null;
        let transactionCommitted = false;
        let logisticsRecords = null;
        let logisticsSummary = null;
        try {
            await client.query('BEGIN');

            const order = await OrderService.createOrder(orderData, client);
            const apiRef = `BYB-${order.id}-${Date.now()}`;

            const paymentData = {
                invoice_id: String(order.id),
                api_ref: apiRef,
                amount: payableTotal,
                currency: 'KES',
                status: PaymentStatus.PENDING,
                payment_method: provider,
                phone_number: buyerMobilePayment,
                email: buyerEmail,
                metadata: {
                    order_id: order.id,
                    api_ref: apiRef,
                    order_number: order.order_number,
                    product_id: service.id,
                    seller_id: product.seller_id,
                    product_type: product.product_type,
                    product_subtotal: productSubtotal,
                    buyer_delivery_fee: buyerDeliveryFee,
                    buyer_service_charge_rate: PRODUCT_SERVICE_CHARGE_RATE,
                    buyer_service_charge: productServiceCharge,
                    product_service_charge_rate: PRODUCT_SERVICE_CHARGE_RATE,
                    product_service_charge: productServiceCharge,
                    payment_base_total: paymentBaseTotal,
                    payable_total: payableTotal,
                    delivery: orderData.metadata.delivery,
                    buyer_id: buyerId,
                    narration: metadata.narration || `Payment for ${product.name}`
                }
            };

            const insertRes = await client.query(
                `INSERT INTO payments (invoice_id, email, mobile_payment, whatsapp_number, amount, status, payment_method, api_ref, metadata)
                  VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8::jsonb) RETURNING *`,
                [paymentData.invoice_id, buyerEmail, buyerMobilePayment, buyerWhatsApp, payableTotal, provider, apiRef, JSON.stringify(paymentData.metadata)]
            );
            const payment = insertRes.rows[0];

            if (wantsDoorDelivery && deliveryQuote) {
                logisticsRecords = await LogisticsRequestService.createDoorDeliveryPaymentPending(client, {
                    order,
                    payment,
                    quote: deliveryQuote,
                    buyer,
                    product,
                    seller: {
                        id: product.seller_id,
                        full_name: product.seller_name,
                        shop_name: product.shop_name,
                        email: product.seller_email,
                        whatsapp_number: product.seller_whatsapp_number,
                        city: product.seller_city,
                        location: product.seller_location,
                        physical_address: product.seller_physical_address,
                        latitude: product.seller_latitude,
                        longitude: product.seller_longitude
                    },
                    idempotencyKey
                });

                logisticsSummary = {
                    request_id: logisticsRecords.request.id,
                    delivery_leg_id: logisticsRecords.deliveryLeg.id,
                    partner_id: logisticsRecords.partner.id,
                    package_code: logisticsRecords.request.package_code,
                    status: 'payment_pending'
                };

                paymentData.metadata.delivery = {
                    ...paymentData.metadata.delivery,
                    logistics: logisticsSummary
                };

                await client.query(
                    `UPDATE payments
                     SET metadata = $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [payment.id, JSON.stringify(paymentData.metadata)]
                );

                await client.query(
                    `UPDATE product_orders
                     SET metadata = jsonb_set(
                            COALESCE(metadata, '{}'::jsonb),
                            '{delivery,logistics}',
                            $2::jsonb,
                            true
                         ),
                         updated_at = NOW()
                     WHERE id = $1`,
                    [order.id, JSON.stringify(logisticsSummary)]
                );
            }

            gwPayload = {
                ...paymentData,
                phone: buyerMobilePayment,
                firstName: buyer.name?.split(' ')[0],
                narration: metadata.narration || `Payment for ${product.name}`
            };

            await this.createPaymentProviderAttempt(client, {
                paymentId: payment.id,
                orderId: order.id,
                apiRef,
                idempotencyKey,
                requestPayload: gwPayload
            });

            await client.query('COMMIT');
            transactionCommitted = true;

            // 5. Initiate Gateway
            try {
                await this.markPaymentProviderAttemptStarted(payment.id);
                const result = await this.initiatePayment(gwPayload);

                try {
                    await this.markPaymentProviderAttemptAccepted({
                        paymentId: payment.id,
                        providerReference: result.reference,
                        responsePayload: result
                    });
                } catch (persistError) {
                    logger.error('[PAYMENT-GATEWAY] Provider accepted payment but local reference persistence failed; keeping payment pending for api_ref webhook/cron recovery', {
                        paymentId: payment.id,
                        orderId: order.id,
                        apiRef,
                        providerReference: result.reference,
                        error: persistError.message
                    });

                    await this.markPaymentInitiationAmbiguous({
                        orderId: order.id,
                        paymentId: payment.id,
                        reason: 'provider_reference_persistence_failed',
                        providerPayload: {
                            provider_reference: result.reference,
                            api_ref: apiRef,
                            persistence_error: persistError.message,
                            response: result
                        }
                    }).catch(error => logger.error('[PAYMENT-GATEWAY] Failed to persist provider-reference persistence failure:', error.message));

                    return {
                        success: true,
                        pending: true,
                        ambiguous: true,
                        orderId: order.id,
                        orderNumber: order.order_number,
                        paymentId: payment.id,
                        logistics: logisticsSummary,
                        paymentResult: {
                            reference: result.reference || apiRef,
                            status: 'pending',
                            message: 'Payment request was accepted and is pending confirmation.'
                        }
                    };
                }

                return {
                    success: true,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    paymentId: payment.id,
                    logistics: logisticsSummary,
                    paymentResult: result
                };
            } catch (gwError) {
                logger.error('[PAYMENT-GATEWAY] Gateway initiation failed:', gwError);
                const errorPayload = {
                    message: gwError.message,
                    code: gwError.code,
                    status: gwError.statusCode || gwError.response?.status,
                    data: gwError.details || gwError.response?.data
                };

                if (this.isAmbiguousPaymentProviderError(gwError)) {
                    await this.markPaymentProviderAttemptAmbiguous({
                        paymentId: payment.id,
                        errorPayload
                    }).catch(error => logger.error('[PAYMENT-GATEWAY] Failed to persist ambiguous provider attempt:', error.message));

                    await this.markPaymentInitiationAmbiguous({
                        orderId: order.id,
                        paymentId: payment.id,
                        reason: gwError.message || 'gateway_result_ambiguous',
                        providerPayload: errorPayload
                    });

                    logger.warn('[PAYMENT-GATEWAY] Gateway initiation result ambiguous; keeping payment pending for webhook/cron settlement', {
                        orderId: order.id,
                        paymentId: payment.id,
                        apiRef,
                        code: gwError.code,
                        status: errorPayload.status
                    });

                    return {
                        success: true,
                        pending: true,
                        ambiguous: true,
                        orderId: order.id,
                        orderNumber: order.order_number,
                        paymentId: payment.id,
                        logistics: logisticsSummary,
                        paymentResult: {
                            reference: apiRef,
                            status: 'pending',
                            message: 'Payment request is pending provider confirmation. Check your phone or retry status shortly.'
                        }
                    };
                }

                await this.markPaymentProviderAttemptFailed({
                    paymentId: payment.id,
                    errorPayload
                }).catch(error => logger.error('[PAYMENT-GATEWAY] Failed to persist provider attempt failure:', error.message));

                await this.markPaymentInitiationFailed({
                    orderId: order.id,
                    paymentId: payment.id,
                    reason: gwError.message || 'gateway_initiation_failed',
                    providerPayload: errorPayload
                });
                const failure = new Error('Payment initiation failed before STK push. No payment was triggered; please try again.');
                failure.orderId = order.id;
                failure.paymentId = payment.id;
                throw failure;
            }
        } catch (error) {
            if (!transactionCommitted) {
                await client.query('ROLLBACK');
            }
            if (idempotencyKey && error.code === '23505') {
                const { rows: existing } = await pool.query(
                    `SELECT po.id AS order_id,
                            po.order_number,
                            p.id AS payment_id,
                            p.provider_reference,
                            p.status AS payment_status
                     FROM product_orders po
                     LEFT JOIN payments p ON p.metadata->>'order_id' = po.id::text
                     WHERE po.client_checkout_token = $1
                     ORDER BY p.created_at DESC NULLS LAST
                     LIMIT 1`,
                    [idempotencyKey]
                );
                if (existing.length) {
                    logger.info('[PAYMENT-INITIATE] Recovered existing checkout after unique race', {
                        idempotencyKey,
                        orderId: existing[0].order_id,
                        paymentId: existing[0].payment_id
                    });
                    return {
                        success: true,
                        idempotent: true,
                        orderId: existing[0].order_id,
                        orderNumber: existing[0].order_number,
                        paymentId: existing[0].payment_id,
                        paymentResult: {
                            reference: existing[0].provider_reference,
                            status: existing[0].payment_status
                        }
                    };
                }
            }
            logger.error('[PAYMENT-INITIATE] Transaction failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

export default new PaymentService();




