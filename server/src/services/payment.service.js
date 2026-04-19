import axios from 'axios';
import https from 'https';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dns from 'node:dns';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import { PaymentStatus } from '../constants/enums.js';
import OrderService from './order.service.js';
import { PaydError, PaydErrorCodes } from '../utils/PaydError.js';
import Payment from '../models/payment.model.js';
import Withdrawal from '../models/withdrawal.model.js';
import ClientDebt from '../models/clientDebt.model.js';
import Product from '../models/product.model.js';
import Seller from '../models/seller.model.js';
import Order from '../models/order.model.js';
import cacheService from './cache.service.js';
import { toJsonb } from '../utils/order.utils.js';

export class PaymentService {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.payd.money/api/v2';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;
        this.networkCode = process.env.PAYD_NETWORK_CODE;
        this.channelId = process.env.PAYD_CHANNEL_ID;
        this.payloadUsername = process.env.PAYD_PAYLOAD_USERNAME || 'mwxndx';

        // Validate required configs
        if (!this.username || !this.password) {
            logger.error('[PAYD-INIT] ERROR: PAYD_USERNAME and PAYD_PASSWORD must be set');
        }

        if (!this.baseUrl.startsWith('https://')) {
            logger.error('[PAYD-INIT] ERROR: PAYD_BASE_URL must use HTTPS');
        }

        // Set DNS cache for reliability in environments with flaky local DNS
        try {
            dns.setDefaultResultOrder('ipv4first');
            // Using configurable DNS servers (SonarQube compliance)
            const dnsServers = process.env.DNS_SERVERS ? process.env.DNS_SERVERS.split(',') : ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
            dns.setServers(dnsServers);
        } catch (e) {
            logger.warn('[PAYD-INIT] DNS cache setup failed:', e.message);
        }

        logger.info(`PaymentService initialized with BaseURL: ${this.baseUrl}`);

        // ✅ FIX 1: Create persistent HTTPS agent with connection pooling
        this.httpsAgent = new https.Agent({
            keepAlive: true,              // ✅ Reuse connections
            keepAliveMsecs: 30000,        // ✅ Keep alive for 30s
            maxSockets: 50,               // ✅ Max concurrent connections
            maxFreeSockets: 10,           // ✅ Keep 10 idle sockets ready
            timeout: 90000,               // ✅ Increased timeout to 90s
            scheduling: 'lifo',           // ✅ Reuse most recent socket
            family: 4,                    // ✅ FORCE IPv4 to prevent socket hang up
            rejectUnauthorized: true,      // ✅ Enforce SSL verification
            ca: process.env.PAYD_CA_CERT_PATH ? fs.readFileSync(process.env.PAYD_CA_CERT_PATH) : undefined
        });

        // Monitor agent health
        this.httpsAgent.on('error', (err) => {
            logger.error('[HTTPS-AGENT] Agent error:', err);
        });

        logger.info('[HTTPS-AGENT] Configured with connection pooling', {
            keepAlive: true,
            maxSockets: 50,
            keepAliveMsecs: 30000
        });

        // Create axios instance with optimized config (for legacy methods or GET calls)
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Byblos/1.1 (Axios)',
            },
            timeout: 60000,
            httpsAgent: this.httpsAgent
        });
    }


    /**
     * Helper to retry requests with exponential backoff
     */
    async _retryRequest(fn, retries = 3, delay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                if (attempt > 1) {
                    logger.info(`[RETRY] Attempt ${attempt}/${retries + 1}`);
                }
                const result = await fn();

                if (attempt > 1) {
                    logger.info(`[RETRY] Succeeded on attempt ${attempt}`);
                }

                return result;
            } catch (error) {
                lastError = error;

                // Determine if we should retry
                const shouldRetry = this._shouldRetry(error, attempt, retries);

                if (!shouldRetry) {
                    logger.error(`[RETRY] Not retrying (attempt ${attempt}/${retries + 1})`, {
                        reason: this._getRetryReason(error)
                    });
                    throw error;
                }

                if (attempt <= retries) {
                    const backoffDelay = delay * Math.pow(2, attempt - 1);
                    logger.warn(`[RETRY] Attempt ${attempt} failed. Retrying in ${backoffDelay}ms...`, {
                        error: error.code || error.message,
                        remainingAttempts: retries - attempt + 1
                    });

                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }
        }

        throw lastError;
    }

    _shouldRetry(error, attempt, maxRetries) {
        if (attempt > maxRetries) {
            return false;
        }

        // Retry on network errors
        const networkErrors = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN',
            'EPIPE',
            'ECONNABORTED',
            'socket hang up',
            'Connection timeout',
            'Response timeout',
            'Socket timeout',
            'Socket closed with error'
        ];

        if (networkErrors.some(err =>
            error.code === err ||
            (error.message && error.message.includes(err))
        )) {
            return true;
        }

        // Retry on 5xx server errors
        if (error.response && error.response.status >= 500) {
            return true;
        }

        // Don't retry on client errors (4xx)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return false;
        }

        return false;
    }

    _getRetryReason(error) {
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return 'Client error (4xx) - not retryable';
        }
        return 'Unknown or terminal error type';
    }

    /**
     * Get Authorization Header for Basic Auth
     */
    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd credentials not configured');
        }
        const authString = `${this.username}:${this.password}`;
        return `Basic ${Buffer.from(authString).toString('base64')}`;
    }

    /**
     * Initiate M-Pesa STK Push Payment
     * 
     * Endpoint: POST https://api.payd.money/api/v2/payments
     * Auth: Basic Auth
     * Docs: https://magic.payd.one/kenya-payins
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
        const startTime = Date.now();

        try {
            const {
                email,
                amount,
                invoice_id,
                phone,
                narration,
                narrative,
                first_name,
                last_name,
                callback_url
            } = paymentData;

            // Validate credentials
            if (!this.username || !this.password) {
                throw new PaydError('Payd credentials not configured', PaydErrorCodes.CONFIG_ERROR);
            }

            // ============================================================
            // STEP 1: CHECK PLATFORM BALANCE (Optional but recommended)
            // ============================================================
            try {
                const balance = await this.checkBalance();
                logger.info('[PAYD-PAYIN] Platform balance check', {
                    available: balance.available_balance,
                    required: amount
                });

                if (Number.parseFloat(balance.available_balance) < Number.parseFloat(amount) * 1.1) {
                    // Alert if balance is low (less than 110% of transaction amount)
                    logger.warn('[PAYD-PAYIN] Low platform balance', {
                        available: balance.available_balance,
                        required: amount
                    });
                }
            } catch (balanceError) {
                // Don't block payment if balance check fails
                logger.error('[PAYD-PAYIN] Balance check failed (non-critical)', balanceError);
            }

            // ============================================================
            // STEP 2: NORMALIZE PHONE NUMBER
            // ============================================================
            const normalizedPhone = this.normalizePhoneForPayment(phone);

            // ============================================================
            // STEP 3: BUILD PAYMENT REQUEST
            // ============================================================
            const callbackUrl = callback_url || process.env.PAYD_CALLBACK_URL ||
                (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/payments/webhook/payd` :
                    "https://bybloshq.space/api/payments/webhook/payd");

            const payload = {
                username: this.payloadUsername,
                channel: "MPESA",
                amount: Number.parseFloat(amount),
                phone_number: normalizedPhone,
                narration: narration || narrative || `Payment for ${invoice_id}`,
                currency: "KES",
                callback_url: callbackUrl,
            };

            logger.info('[PAYD-PAYIN] Initiating payment', {
                invoice_id,
                amount: payload.amount,
                phone: normalizedPhone,
                endpoint: `${this.baseUrl}/payments`
            });

            // ============================================================
            // STEP 4: MAKE API REQUEST
            // ============================================================
            // C-1b: Wrap external API call in try/catch to prevent pool leaks
            let response;
            try {
                response = await this._retryRequest(async () => {
                    return await this.client.post('/payments', payload, {
                        headers: {
                            'Authorization': this.getAuthHeader(),
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    });
                }, 3, 1000);
            } catch (error) {
                logger.error('[PAYD-PAYIN] API Request Failed', {
                    error: error.message,
                    code: error.response?.status,
                    data: error.response?.data
                });
                throw error;
            }

            const duration = Date.now() - startTime;

            // ============================================================
            // STEP 5: PARSE RESPONSE
            // ============================================================
            // Payd v2 returns reference at root level, not nested
            const resData = response.data
            const reference = resData.transaction_reference

            if (!reference) {
                logger.error('[PAYD-PAYIN] No transaction_reference in response', { invoice_id, raw: resData })
                throw new PaydError(
                    'Payd did not return a transaction_reference. Payment request may still be processing — check webhook.',
                    PaydErrorCodes.TRANSACTION_FAILED,
                    500
                )
            }

            logger.info('[PAYD-PAYIN] Payment initiated successfully', {
                duration: `${duration}ms`,
                reference,
                status: response.status,
                invoice_id
            });

            return {
                success: true,
                reference,
                transaction_id: reference,
                status: 'pending',
                message: 'STK push sent to customer phone',
                original_response: response.data
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error('[PAYD-PAYIN] Payment initiation failed', {
                duration: `${duration}ms`,
                invoice_id: paymentData.invoice_id,
                error: this._extractErrorDetails(error)
            });

            throw this._handlePaydError(error);
        }
    }

    /**
     * Normalize phone number for PAYMENT (STK Push)
     * Payd payment API accepts: 254XXXXXXXXX or 0XXXXXXXXX
     * 
     * @param {string|number} phone
     * @returns {string} e.g., "254712345678" or "0712345678"
     */
    normalizePhoneForPayment(phone) {
        if (!phone) throw new PaydError('Phone number is required', PaydErrorCodes.INVALID_PHONE, 400)
        let digits = phone.toString().replace(/\D/g, '')

        // Handle +254XXXXXXXXX or 254XXXXXXXXX → 0XXXXXXXXX
        if (digits.startsWith('254') && digits.length === 12) {
            digits = '0' + digits.substring(3)
        }
        // Handle 9-digit bare number → 0XXXXXXXXX
        else if (digits.length === 9) {
            digits = '0' + digits
        }
        // Handle 0XXXXXXXXX — already correct
        else if (digits.startsWith('0') && digits.length === 10) {
            // good
        }
        else {
            throw new PaydError(
                `Invalid phone number: "${phone}". Must be a valid Kenyan number (e.g. 0712345678)`,
                PaydErrorCodes.INVALID_PHONE,
                400
            )
        }

        // Final validation: must be 0[17]\d{8}
        if (!/^0[17]\d{8}$/.test(digits)) {
            throw new PaydError(
                `Phone number "${digits}" is not a valid Kenyan mobile number`,
                PaydErrorCodes.INVALID_PHONE,
                400
            )
        }

        return digits
    }

    /**
     * Monitor HTTPS agent health
     */
    getAgentStatus() {
        return {
            maxSockets: this.httpsAgent.maxSockets,
            maxFreeSockets: this.httpsAgent.maxFreeSockets,
            sockets: Object.keys(this.httpsAgent.sockets || {}).length,
            freeSockets: Object.keys(this.httpsAgent.freeSockets || {}).length,
            requests: Object.keys(this.httpsAgent.requests || {}).length
        };
    }

    /**
     * Reset HTTPS agent (use if connections are stale)
     */
    resetAgent() {
        logger.warn('[HTTPS-AGENT] Resetting agent due to connection issues');

        // Destroy all sockets
        this.httpsAgent.destroy();

        // Create new agent with same stable settings
        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 90000,
            scheduling: 'lifo',
            family: 4,        // ✅ FORCE IPv4
            rejectUnauthorized: true,
            ca: process.env.PAYD_CA_CERT_PATH ? fs.readFileSync(process.env.PAYD_CA_CERT_PATH) : undefined
        });

        // Re-mount to axios client too
        this.client.defaults.httpsAgent = this.httpsAgent;

        logger.info('[HTTPS-AGENT] Agent reset complete');
    }

    /**
     * Handle Payd Webhook/Callback
     */
    async handlePaydCallback(callbackData) {
        logger.info('[PAYD-WEBHOOK] Received payment callback', { raw_data: callbackData });

        try {
            // STEP 1: PARSE AND VALIDATE
            const { reference, isSuccess, amount, phone, mpesaReceipt, status } = this._parseCallbackData(callbackData);

            // STEP 2: FIND PAYMENT RECORD (initial non-locking check)
            const payment = await Payment.findByReference(reference);

            if (!payment) {
                if (isSuccess) logger.warn('[PAYD-WEBHOOK] Payment not found - will be resolved by cron', { reference, amount });
                else logger.warn('[PAYD-WEBHOOK] Failed webhook for unknown reference', { reference });
                return { success: false, message: 'Payment record not found' };
            }

            const paymentMeta = payment.metadata || {};

            // STEP 3: IDEMPOTENCY CHECK (Fast path)
            if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.SUCCESS) {
                logger.warn('[PAYD-WEBHOOK] Duplicate webhook ignored', { payment_id: payment.id, reference });
                return { success: true, message: 'Webhook already processed', duplicate: true };
            }

            // STEP 4: UPDATE PAYMENT (Atomic Transaction)
            const updateResult = await this._updatePaymentOnCallback(payment, isSuccess, mpesaReceipt);
            if (!updateResult.success) return updateResult;

            // STEP 5: POST-COMMIT SIDE EFFECTS (Order Completion)
            if (isSuccess && (paymentMeta.order_id || paymentMeta.product_id)) {
                try {
                    await OrderService.completeOrder({
                        ...payment,
                        status: PaymentStatus.COMPLETED,
                        metadata: { ...paymentMeta, payd_confirmation: callbackData }
                    });
                    logger.info('[PAYD-WEBHOOK] Order completion successful', { payment_id: payment.id });
                } catch (completionErr) {
                    logger.error(`[CRITICAL] handlePaydCallback completeOrder failed for payment ${payment.id}:`, completionErr);
                    try {
                        await Payment.updateStatus(payment.invoice_id, payment.status, { needs_completion: true });
                        logger.info(`[RECOVERY] Marked payment ${payment.id} as needs_completion=true`);
                    } catch (flagErr) {
                        logger.error(`[CRITICAL] FAILED TO SET needs_completion FLAG for payment ${payment.id}:`, flagErr);
                    }
                }
            }

            logger.info('[PAYD-WEBHOOK] Webhook processed successfully', {
                payment_id: payment.id,
                status: isSuccess ? 'success' : 'failed'
            });

            return {
                success: true,
                message: 'Webhook processed',
                payment_id: payment.id,
                status: isSuccess ? 'success' : 'failed'
            };

        } catch (error) {
            logger.error('[PAYD-WEBHOOK] Webhook processing failed', {
                error: error.message,
                stack: error.stack,
                reference: callbackData?.data?.transaction_reference || callbackData?.transaction_reference
            });
            throw error;
        }
    }

    /**
     * Parse and validate Payd callback data
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
            logger.error('[PAYD-WEBHOOK] Missing reference in payload', callbackData);
            throw new Error('Webhook missing transaction reference');
        }

        const resultCodeNum = Number.parseInt(resultCode, 10);
        // FIXED BUG-PAY-SEC-03: don't require 'success' boolean — result_code=0 is authoritative
        const isSuccess = (resultCodeNum === 0 || resultCodeNum === 200 || status === 'success') &&
            (data.success === undefined || data.success === true || data.success === 'true');

        return { reference, isSuccess, amount, phone, mpesaReceipt, status };
    }

    /**
     * Update payment record within a transaction
     * @private
     */
    async _updatePaymentOnCallback(payment, isSuccess, mpesaReceipt) {
        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');

            const lockedPayment = await Payment.update(dbClient, payment.id, {
                status: isSuccess ? PaymentStatus.COMPLETED : 'failed',
                mpesa_receipt: mpesaReceipt,
                metadata: { ...payment.metadata, webhook_received_at: new Date().toISOString() }
            });

            if (!lockedPayment) {
                await dbClient.query('ROLLBACK');
                return { success: false, message: 'Payment not found during lock/update' };
            }

            const paymentMeta = lockedPayment.metadata || {};
            if (isSuccess && paymentMeta.type === 'debt' && paymentMeta.debt_id) {
                await ClientDebt.markAsPaid(dbClient, Number.parseInt(paymentMeta.debt_id, 10));
            }

            await dbClient.query('COMMIT');
            return { success: true };
        } catch (error) {
            await dbClient.query('ROLLBACK').catch(e => logger.error('[PAYD-WEBHOOK] Rollback failed:', e));
            throw error;
        } finally {
            dbClient.release();
        }
    }


    /**
     * Process successful payment logic and trigger downstream actions
     */
    async handleSuccessfulPayment(data) {
        const { reference, amount, metadata } = data;
        logger.info(`[PAYMENT-SUCCESS] Processing Ref: ${reference}, Amount: ${amount}`);

        // 1. Find payment by provider_reference or api_ref
        let payment = await Payment.findByReference(reference);

        // 2. Fallback: Check if it's a Withdrawal Request (Payout)
        if (!payment) {
            const withdrawal = await Withdrawal.findByReference(reference);

            if (withdrawal) {
                if (withdrawal.status === PaymentStatus.COMPLETED || withdrawal.status === PaymentStatus.FAILED) {
                    return { status: 'success', message: 'Withdrawal already processed' };
                }

                await Withdrawal.updateStatus(pool, withdrawal.id, 'completed', metadata || {});
                logger.info(`[PAYMENT-SUCCESS] Withdrawal ${withdrawal.id} marked COMPLETED`);
                return { status: 'success', message: 'Withdrawal processed successfully' };
            }

            logger.warn(`[PAYMENT-SUCCESS] No record found for reference: ${reference}`);
            return { status: 'error', message: 'Record not found' };
        }

        // 3. Process Payment Idempotency
        if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.SUCCESS) {
            logger.info(`[PAYMENT-SUCCESS] Payment ${payment.id} already COMPLETED. Skipping.`, { reference });
            return { status: 'already_processed', message: 'Payment already completed' };
        }

        // 4. STEP 1: ATOMIC UPDATE
        const updateResult = await this._updatePaymentOnSuccess(payment, reference, amount, metadata);
        if (updateResult.status === 'already_processed') return updateResult;

        payment = updateResult.payment;
        const paymentMeta = payment.metadata || {};

        // 5. STEP 2: DOWNSTREAM ACTIONS
        if (paymentMeta.order_id || paymentMeta.product_id) {
            return await this._handleDownstreamOrderAction(payment, paymentMeta);
        } else if (paymentMeta.type === 'debt' && paymentMeta.debt_id) {
            return await this._handleDownstreamDebtAction(payment, paymentMeta);
        }

        logger.warn(`[PAYMENT-SUCCESS] Payment ${payment.id} completed but no downstream action defined`);
        return { status: 'success', message: 'Payment received but no downstream action defined' };
    }

    /**
     * Atomically update payment to COMPLETED status
     * @private
     */
    async _updatePaymentOnSuccess(payment, reference, amount, metadata) {
        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');

            const mpesaReceipt = metadata?.data?.third_party_trans_id || metadata?.third_party_trans_id || null;

            const updatedPayment = await Payment.update(dbClient, payment.id, {
                status: PaymentStatus.COMPLETED,
                provider_reference: reference,
                mpesa_receipt: mpesaReceipt,
                metadata: { ...payment.metadata, payd_confirmation: metadata }
            });

            if (!updatedPayment) {
                await dbClient.query('ROLLBACK');
                throw new Error('Payment not found during lock/update');
            }

            await dbClient.query('COMMIT');
            return { status: 'success', payment: updatedPayment };
        } catch (error) {
            await dbClient.query('ROLLBACK').catch(e => logger.error('[LOCKING] Rollback failed:', e));
            throw error;
        } finally {
            dbClient.release();
        }
    }


    /**
     * Map Payd provider status to internal status
     * @private
     */
    _mapPaydStatus(providerData) {
        const resultCode = Number(providerData.result_code);
        if (providerData.status === 'SUCCESS' || resultCode === 200 || resultCode === 0) {
            return 'success';
        }
        if (providerData.status === 'FAILED' || providerData.status === 'ERROR') {
            return 'failed';
        }
        return 'pending';
    }

    /**
     * Handle downstream order completion logic
     * @private
     */
    async _handleDownstreamOrderAction(payment, metadata) {
        try {
            logger.info(`[PURCHASE-FLOW] 7. Completing Order ${metadata.order_id} via OrderService.completeOrder()`);
            const completionResult = await OrderService.completeOrder(payment);
            logger.info(`[PURCHASE-FLOW] 8. Order Completion Result:`, completionResult);
            return { status: 'success', message: 'Payment processed and Order completion triggered' };
        } catch (completionErr) {
            logger.error(`[PAYD-PAYIN] CRITICAL: Order completion failed after payment was confirmed. Payment ID: ${payment.id}`, {
                paymentId: payment.id,
                orderId: metadata.order_id,
                error: completionErr.message
            });
            try {
                await Payment.updateMetadata(payment.id, { needs_completion: true });
                logger.info(`[RECOVERY] Marked payment ${payment.id} as needs_completion=true`);
            } catch (flagErr) {
                logger.error(`[CRITICAL] FAILED TO SET needs_completion FLAG for payment ${payment.id}:`, flagErr);
            }
            return {
                status: 'payment_confirmed_completion_pending',
                message: 'Payment received. Order completion will be retried.',
                paymentId: payment.id,
                completionError: completionErr.message
            };
        }
    }

    /**
     * Handle downstream debt settlement logic
     * @private
     */
    async _handleDownstreamDebtAction(payment, metadata) {
        const debtClient = await pool.connect();
        try {
            await debtClient.query('BEGIN');
            logger.info(`[PURCHASE-FLOW] 7. Marking debt ${metadata.debt_id} as paid`);

            await ClientDebt.markAsPaid(debtClient, Number.parseInt(metadata.debt_id, 10));

            await Payment.update(debtClient, payment.id, { status: PaymentStatus.COMPLETED });

            await debtClient.query('COMMIT');
            logger.info(`[PURCHASE-FLOW] 8. Debt ${metadata.debt_id} settled successfully`);
            return { status: 'success', message: 'Payment processed and Debt settled' };
        } catch (debtErr) {
            await debtClient.query('ROLLBACK').catch(e => logger.error('Debt rollback failed:', e));
            logger.error('[PURCHASE-FLOW] ERROR - Error settling debt after payment:', debtErr);
            throw debtErr;
        } finally {
            debtClient.release();
        }
    }

    async checkPaymentStatus(identifier) {
        const payment = await Payment.findByIdentifier(identifier);
        if (!payment) throw new Error('Payment not found');

        // If payment is pending and we have a provider_reference, check Payd status
        if (payment.status === PaymentStatus.PENDING && payment.provider_reference) {
            try {
                const paydStatus = await this.checkTransactionStatus(payment.provider_reference);
                const normalizedStatus = paydStatus.status; // already lowercased in checkTransactionStatus

                if (['success', 'completed', 'processed', 'paid'].includes(normalizedStatus)) {
                    // Persist status change immediately
                    await Payment.updateStatus(payment.invoice_id, PaymentStatus.COMPLETED);
                    payment.status = PaymentStatus.COMPLETED;
                    logger.info(`[PaymentService] In-poll sync: Payment ${payment.id} verified as ${normalizedStatus} -> COMPLETED (Persisted)`);

                    // If this is a pending order, trigger completion now instead of waiting for webhook
                    const paymentMeta = payment.metadata || {};
                    const orderId = paymentMeta.order_id || paymentMeta.product_id;

                    if (orderId) {
                        const lockKey = `lock:order_completion:${orderId}`;
                        try {
                            // DISTRIBUTED LOCK: Prevent race conditions between webhooks and polling
                            // ioredis set command with 'NX' ensures only one caller acquires the lock
                            const acquired = await cacheService.redis.set(lockKey, 'locked', 'EX', 30, 'NX');

                            if (!acquired) {
                                logger.info(`[ORDER-LOCK] Order ${orderId} completion already in progress. Skipping polling path.`);
                                return;
                            }

                            await OrderService.completeOrder({
                                ...payment,
                                metadata: paymentMeta
                            });
                            logger.info('[PAYMENT-POLL] Order completion triggered successfully via polling', { orderId });
                        } catch (completionErr) {
                            logger.error('[PAYMENT-POLL] Failed to complete order via polling path:', completionErr);
                        }
                    }
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
        const paymentMeta = payment.metadata || {};
        const buyerProfileId = paymentMeta.buyer_id; // buyers.id stored in metadata

        if ((payment.status === 'completed' || payment.status === 'success') && buyerProfileId) {
            try {
                // Look up the users.id from buyers.id (signAutoLoginToken needs users.id)
                const buyer = await Buyer.findById(buyerProfileId);
                const userId = buyer?.user_id;

                if (userId) {
                    const { signAutoLoginToken } = await import('../utils/jwt.js');
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
     * Endpoint: GET https://api.payd.money/api/v1/status/{transaction_reference}
     * Auth: Basic Auth
     * Docs: https://magic.payd.one/transaction-status
     * 
     * @param {string} transactionId - Payd transaction reference
     * @returns {Promise<Object>}
     */
    async checkTransactionStatus(transactionId) {
        try {
            logger.info('[PAYD-STATUS] Checking transaction status', { transaction_id: transactionId });

            // Using v2 payments endpoint (consistent with cron)
            const response = await this.client.get(`/payments/${transactionId}`, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            const data = response.data;
            // Payd v2 sometimes nests details, sometimes returns at root
            const details = data.data || data;

            logger.info('[PAYD-STATUS] Status retrieved', {
                transaction_id: transactionId,
                status: details.status || data.status,
                amount: details.amount || data.amount
            });

            let status = (details.status || data.status || 'pending').toLowerCase();

            // Normalize status strings from Payd
            if (status === 'processed' || status === 'paid') status = 'completed';
            if (status === 'fail') status = 'failed';

            return {
                success: true,
                transaction_id: transactionId,
                status,
                amount: Number.parseFloat(data.amount || 0),
                phone_number: details.payer || details.recipient,
                narration: details.reason,
                created_at: data.created_at,
                raw_response: data
            };

        } catch (error) {
            logger.error('[PAYD-STATUS] Status check failed', {
                transaction_id: transactionId,
                error: this._extractErrorDetails(error)
            });

            throw this._handlePaydError(error);
        }
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
        const {
            maxAttempts = 60, // 5 minutes max (60 * 5s)
            intervalMs = 5000,
            finalStatuses = ['success', 'failed', 'cancelled', 'expired']
        } = options;

        logger.info('[PAYD-POLL] Starting transaction status polling', {
            transaction_id: transactionId,
            maxAttempts,
            intervalMs
        });

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const status = await this.checkTransactionStatus(transactionId);

                logger.info('[PAYD-POLL] Poll attempt', {
                    attempt,
                    status: status.status,
                    transaction_id: transactionId
                });

                // Check if status is final
                if (finalStatuses.includes(status.status.toLowerCase())) {
                    logger.info('[PAYD-POLL] Final status reached', {
                        status: status.status,
                        attempts: attempt
                    });
                    return status;
                }

                // Wait before next poll
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }

            } catch (error) {
                logger.error('[PAYD-POLL] Poll attempt failed', {
                    attempt,
                    transaction_id: transactionId,
                    error: error.message
                });

                // Don't retry if it's a 404 (transaction not found)
                if (error.statusCode === 404) {
                    throw error;
                }

                // Continue polling for other errors
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }
            }
        }

        // Timeout reached
        logger.warn('[PAYD-POLL] Polling timeout', {
            transaction_id: transactionId,
            attempts: maxAttempts
        });

        return {
            success: false,
            status: 'timeout',
            message: `Transaction status polling timed out after ${maxAttempts} attempts`
        };
    }

    /**
     * Check Payd platform account balance
     * 
     * Endpoint: GET https://api.payd.money/api/v1/accounts/{username}/all_balances
     * Auth: Basic Auth
     * Docs: https://magic.payd.one/balances
     * 
     * @returns {Promise<Object>}
     */
    async checkBalance() {
        try {
            logger.info('[PAYD-BALANCE] Checking platform balance');

            const response = await this.client.get(`/accounts/${this.username}/all_balances`, {
                baseURL: 'https://api.payd.money/api/v1',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            const data = response.data;
            const fiat = data.fiat_balance || {};

            logger.info('[PAYD-BALANCE] Balance retrieved', {
                available: fiat.balance,
                currency: fiat.currency
            });

            return {
                success: true,
                available_balance: fiat.balance,
                ledger_balance: fiat.balance, // Unified in v1
                currency: fiat.currency || 'KES',
                last_updated: new Date().toISOString(),
                raw_response: data
            };

        } catch (error) {
            logger.error('[PAYD-BALANCE] Balance check failed', {
                error: this._extractErrorDetails(error)
            });

            throw this._handlePaydError(error);
        }
    }

    /**
     * Check if platform has sufficient balance for a transaction
     * 
     * @param {number} requiredAmount - Amount needed in KES
     * @param {number} bufferPercent - Safety buffer % (default: 10)
     * @returns {Promise<{sufficient: boolean, available: number, required: number}>}
     */
    async hasSufficientBalance(requiredAmount, bufferPercent = 10) {
        const balance = await this.checkBalance();
        const available = Number.parseFloat(balance.available_balance);
        const requiredWithBuffer = Number.parseFloat(requiredAmount) * (1 + bufferPercent / 100);

        return {
            sufficient: available >= requiredWithBuffer,
            available,
            required: requiredWithBuffer,
            buffer: bufferPercent
        };
    }

    /**
     * Extract error details from Axios error
     * 
     * @private
     * @param {Error} error - Axios error object
     * @returns {Object}
     */
    _extractErrorDetails(error) {
        if (error.response) {
            // HTTP error response from Payd
            return {
                type: 'http_error',
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            };
        } else if (error.request) {
            // Request made but no response received
            return {
                type: 'no_response',
                message: error.message,
                code: error.code,
                timeout: error.code === 'ECONNABORTED'
            };
        } else {
            // Error in request setup
            return {
                type: 'request_setup',
                message: error.message
            };
        }
    }

    /**
     * Handle Payd API errors and convert to PaydError
     * 
     * @private
     * @param {Error} error - Original error
     * @returns {PaydError}
     */
    _handlePaydError(error) {
        // Already a PaydError
        if (error instanceof PaydError) {
            return error;
        }

        // HTTP response errors
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 401 || status === 403) {
                return new PaydError(
                    'Authentication failed. Please check Payd credentials.',
                    PaydErrorCodes.AUTHENTICATION_FAILED,
                    401,
                    { original: data }
                );
            }

            if (status === 404) {
                return new PaydError(
                    'Transaction not found',
                    PaydErrorCodes.TRANSACTION_NOT_FOUND,
                    404,
                    { original: data }
                );
            }

            if (status === 409) {
                return new PaydError(
                    'Duplicate transaction detected',
                    PaydErrorCodes.DUPLICATE_TRANSACTION,
                    409,
                    { original: data }
                );
            }

            if (status >= 400 && status < 500) {
                return new PaydError(
                    data.message || 'Bad request to Payd API',
                    PaydErrorCodes.TRANSACTION_FAILED,
                    status,
                    { original: data }
                );
            }

            if (status >= 500) {
                return new PaydError(
                    'Payd service temporarily unavailable',
                    PaydErrorCodes.CONNECTION_FAILED,
                    503,
                    { original: data }
                );
            }
        }

        // Network/timeout errors
        if (error.code === 'ECONNRESET' || error.message === 'socket hang up') {
            return new PaydError(
                'Connection to Payd failed. Please try again.',
                PaydErrorCodes.CONNECTION_FAILED,
                503,
                { code: error.code }
            );
        }

        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return new PaydError(
                'Request to Payd timed out. Please try again.',
                PaydErrorCodes.TIMEOUT,
                504,
                { code: error.code }
            );
        }

        // Unknown error
        return new PaydError(
            error.message || 'Unknown Payd error occurred',
            PaydErrorCodes.UNKNOWN_ERROR,
            500,
            { original: error }
        );
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
            // 1. Fetch pending payments within time window
            const pendingPayments = await Payment.findPending(hoursAgo, limit);

            results.processedCount = pendingPayments.length;

            if (pendingPayments.length === 0) return results;

            logger.info(`Found ${pendingPayments.length} pending payments to check`);

            // 2. Process each
            for (const payment of pendingPayments) {
                try {
                    // Calculate payment age in minutes
                    const ageMinutes = Math.floor((new Date() - new Date(payment.created_at)) / 60000);

                    // Skip payments without provider reference
                    if (!payment.provider_reference) {
                        // If payment is older than 30 minutes and has no provider reference,
                        continue;
                    }

                    // Attempt retrieval from Provider
                    let providerStatus = null;
                    let providerData = null;
                    let is404Error = false;

                    try {
                        const response = await this.client.get(`/payments/${payment.provider_reference}`, {
                            headers: { Authorization: this.getAuthHeader() }
                        });
                        providerData = response.data;
                        providerStatus = this._mapPaydStatus(providerData);
                    } catch (netErr) {
                        // Check if it's a 404 error
                        if (netErr.response?.status === 404) {
                            // 404 from undocumented endpoint — this is NOT a payment failure.
                            // Flag for manual review after 2 hours, but do NOT auto-fail.
                            if (ageMinutes > 120) {
                                logger.warn(`[CRON] Payment ${payment.id} pending >2hr with no webhook received. Flag for manual review.`);
                                await Payment.updateMetadata(payment.id, { needs_manual_review: true });
                            }
                            continue;
                        } else {
                            // For other errors (network issues, timeouts, etc.), just log
                            logger.warn(`Failed to check status for ${payment.id}: ${netErr.message}`);
                        }
                    }

                    // Process based on determined status
                    if (providerStatus === 'success') {
                        logger.info(`Payment ${payment.id} verified as SUCCESS via Cron`);
                        await this.handleSuccessfulPayment({
                            reference: payment.provider_reference,
                            amount: payment.amount,
                            metadata: providerData || {}
                        });
                        results.successCount++;
                    } else if (providerStatus === 'failed') {
                        const failureReason = is404Error
                            ? 'Payment not found in provider system (404)'
                            : (providerData?.remarks || providerData?.status_description || 'Payment failed');

                        logger.info(`Payment ${payment.id} verified as FAILED via Cron - Reason: ${failureReason}`);
                        await Payment.updateStatus(payment.invoice_id, 'failed', {
                            failure_reason: failureReason,
                            failed_by: 'cron_job',
                            failed_at: new Date().toISOString(),
                            provider_data: providerData || { error_code: 404 }
                        });

                        // If linked to an order, mark the order as failed too
                        if (payment.metadata?.order_id) {
                            try {
                                await Order.updateStatus(payment.metadata.order_id, 'FAILED');
                                logger.info(`[Cron] Marked Order ${payment.metadata.order_id} as FAILED due to payment failure`);
                            } catch (orderErr) {
                                logger.error(`[Cron] Failed to mark order ${payment.metadata.order_id} as failed:`, orderErr);
                            }
                        }

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


    async initiateProductPayment(normalizedOrder) {
        const { buyer, service, location, metadata } = normalizedOrder;

        const buyerId = buyer.id;
        const buyerEmail = buyer.email;
        const buyerMobilePayment = buyer.phone;
        const buyerWhatsApp = buyer.phone;

        // 1. Resolve & Validate Product/Seller
        const product = await Product.findById(service.id);
        if (!product) throw new Error('Product not found');

        const seller = await Seller.findSellerById(product.seller_id);
        if (!seller) throw new Error('Seller not found');

        if (seller.status !== 'active') throw new Error('Seller is not accepting orders');
        if (product.status !== 'available') throw new Error('Product not available');

        // 2. Security: Calculate Secure Total
        const dbPrice = Number.parseFloat(product.price || 0);
        const quantity = Number.parseInt(service.quantity || 1);
        const finalTotal = dbPrice * quantity;

        if (finalTotal <= 0) throw new Error('Invalid order amount after secure calculation');

        // 4. Create Order (PIN-02: UNIFIED ORDER CONTEXT)
        const orderData = {
            ...normalizedOrder,
            sellerId: Number.parseInt(product.seller_id),
            service: {
                ...service,
                price: dbPrice,
                quantity: quantity,
                total: finalTotal,
                title: product.name
            },
            metadata: {
                ...metadata,
                product_type: product.product_type,
                is_digital: product.is_digital,
                product_id: service.id,
                product_name: product.name,
                items: [{
                    productId: service.id,
                    name: product.name,
                    price: dbPrice,
                    quantity: quantity,
                    subtotal: finalTotal,
                    productType: product.product_type,
                    isDigital: product.is_digital,
                    serviceLocations: product.service_locations
                }]
            }
        };

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const order = await OrderService.createOrder(orderData, client);

            const paymentData = {
                invoice_id: String(order.id),
                amount: finalTotal,
                currency: 'KES',
                status: PaymentStatus.PENDING,
                payment_method: 'payd',
                phone_number: buyerMobilePayment,
                email: buyerEmail,
                metadata: {
                    order_id: order.id,
                    order_number: order.order_number,
                    product_id: service.id,
                    seller_id: product.seller_id,
                    product_type: product.product_type,
                    buyer_id: buyerId,
                    narration: metadata.narration || `Payment for ${product.name}`
                }
            };

            const payment = await Payment.insert(client, {
                invoice_id: paymentData.invoice_id,
                email: buyerEmail,
                mobile_payment: buyerMobilePayment,
                whatsapp_number: buyerWhatsApp,
                amount: finalTotal,
                status: 'pending',
                payment_method: 'payd',
                metadata: paymentData.metadata
            });

            await client.query('COMMIT');

            // 5. Initiate Gateway
            try {
                const gwPayload = {
                    ...paymentData,
                    phone: buyerMobilePayment,
                    firstName: buyer.name?.split(' ')[0],
                    narration: metadata.narration || `Payment for ${product.name}`
                };

                const result = await this.initiatePayment(gwPayload);

                if (result.reference) {
                    await Payment.updateReference(payment.id, result.reference);
                }

                return {
                    success: true,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    paymentId: payment.id,
                    paymentResult: result
                };
            } catch (gwError) {
                logger.error('[PAYMENT-GATEWAY] Gateway initiation failed:', gwError);
                return {
                    success: false,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    error: 'Payment initiation failed. Your order has been placed but payment was not triggered. Please try again from Order History.'
                };
            }
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[PAYMENT-INITIATE] Transaction failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

export default new PaymentService();
