import axios from 'axios';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import dns from 'dns';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import { PaymentStatus } from '../constants/enums.js';
import OrderService from './order.service.js';
import Buyer from '../models/buyer.model.js';
import { PaydError, PaydErrorCodes } from '../utils/PaydError.js';

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

        // Set DNS cache
        try {
            dns.setDefaultResultOrder('ipv4first');
            dns.setServers([
                '8.8.8.8',  // Google DNS
                '8.8.4.4',
                '1.1.1.1'   // Cloudflare DNS
            ]);
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

                if (parseFloat(balance.available_balance) < parseFloat(amount) * 1.1) {
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
                amount: parseFloat(amount),
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
        logger.info('[PAYD-WEBHOOK] Received payment callback', {
            raw_data: callbackData
        });

        try {
            // ============================================================
            // STEP 1: EXTRACT DATA
            // ============================================================
            const data = callbackData.data || callbackData;

            const reference = data.transaction_reference;

            const status = data.status?.toLowerCase();
            const amount = parseFloat(data.amount || 0);
            const phone = data.phone_number;
            const resultCode = data.result_code || callbackData.result_code;

            if (!reference) {
                logger.error('[PAYD-WEBHOOK] Missing reference in callback payload', callbackData);
                throw new Error('Webhook missing transaction reference');
            }

            // Payd docs: SUCCESS requires result_code=0 AND success=true
            // Lenient check: Also allow 200 or status=SUCCESS for broader provider compatibility
            const resultCodeNum = Number.parseInt(resultCode, 10);
            const isSuccess = (resultCodeNum === 0 || resultCodeNum === 200 || status === 'success') &&
                (data.success === true || data.success === 'true');

            logger.info('[PAYD-WEBHOOK] Parsed webhook data', {
                reference,
                status,
                isSuccess,
                amount,
                phone
            });

            // ============================================================
            // STEP 2: FIND PAYMENT RECORD
            // ============================================================
            const { rows: payments } = await pool.query(
                'SELECT * FROM payments WHERE provider_reference = $1 OR api_ref = $1',
                [reference]
            );

            if (!payments || payments.length === 0) {
                if (isSuccess) {
                    logger.warn('[PAYD-WEBHOOK] Payment not found for reference — will be resolved by cron', {
                        reference,
                        amount
                    });
                    // Do not call handleSuccessfulPayment — it uses a different flow and
                    // can cause issues when reference matching is fuzzy.
                    // The payment will be resolved by processPendingPayments cron within 5 minutes.
                } else {
                    logger.warn('[PAYD-WEBHOOK] Failed webhook for unknown reference', { reference });
                }
                return { success: false, message: 'Payment record not found' };
            }

            const payment = payments[0];

            // ============================================================
            // STEP 3: CHECK IDEMPOTENCY (Fast check - no lock yet)
            // ============================================================
            if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.SUCCESS) {
                logger.warn('[PAYD-WEBHOOK] Duplicate success webhook ignored (fast check)', {
                    payment_id: payment.id,
                    reference
                });
                return {
                    success: true,
                    message: 'Webhook already processed',
                    duplicate: true
                };
            }

            // ============================================================
            // STEP 4: UPDATE PAYMENT STATUS
            // ============================================================
            const dbClient = await pool.connect();
            let transactionCommitted = false;

            try {
                await dbClient.query('BEGIN');

                // ─── Acquire FOR UPDATE lock and re-check idempotency ───────────────
                const { rows: lockedRows } = await dbClient.query(
                    'SELECT id, status FROM payments WHERE id = $1 FOR UPDATE',
                    [payment.id]
                );
                if (!lockedRows[0]) {
                    await dbClient.query('ROLLBACK');
                    logger.error('[PAYD-WEBHOOK] Payment disappeared during lock attempt', { payment_id: payment.id });
                    return { success: false, message: 'Payment not found during lock' };
                }
                const lockedPayment = lockedRows[0];

                if (lockedPayment.status === PaymentStatus.COMPLETED || lockedPayment.status === PaymentStatus.SUCCESS) {
                    await dbClient.query('ROLLBACK');
                    logger.warn('[PAYD-WEBHOOK] Duplicate success webhook ignored (post-lock check)', {
                        payment_id: payment.id,
                        reference
                    });
                    return { success: true, message: 'Webhook already processed (concurrent)', duplicate: true };
                }
                // ─────────────────────────────────────────────────────────────────────────

                const mpesaReceipt = data.third_party_trans_id || null;

                // Update payment record
                await dbClient.query(
                    `UPDATE payments 
                     SET status = $1,
                         mpesa_receipt = $2,
                         metadata = jsonb_set(
                             COALESCE(metadata, '{}'::jsonb),
                             '{webhook_received_at}',
                             $3::jsonb
                         ),
                         updated_at = NOW()
                     WHERE id = $4`,
                    [
                        isSuccess ? PaymentStatus.COMPLETED : 'failed',
                        mpesaReceipt,
                        JSON.stringify(new Date().toISOString()),
                        payment.id
                    ]
                );

                if (isSuccess) {
                    const paymentMeta = payment.metadata || {};
                    if (paymentMeta.type === 'debt' && paymentMeta.debt_id) {
                        await dbClient.query(
                            'UPDATE client_debts SET is_paid = true, updated_at = NOW() WHERE id = $1',
                            [paymentMeta.debt_id]
                        );
                    }
                }

                await dbClient.query('COMMIT');
                transactionCommitted = true;
            } catch (error) {
                if (!transactionCommitted) {
                    await dbClient.query('ROLLBACK').catch(e => logger.error('[PAYD-WEBHOOK] Rollback failed:', e));
                }
                throw error;
            } finally {
                dbClient.release();
            }

            // Step 5: Post-commit side effects (notifications, order completion)
            // These MUST NOT run inside the transaction to avoid blocking status updates
            const paymentMeta = payment.metadata || {};
            if (isSuccess && transactionCommitted && (paymentMeta.order_id || paymentMeta.product_id)) {
                try {
                    // Use the already imported OrderService
                    await OrderService.completeOrder({
                        ...payment,
                        status: PaymentStatus.COMPLETED,
                        metadata: { ...paymentMeta, payd_confirmation: callbackData }
                    });
                    logger.info('[PAYD-WEBHOOK] Order completion successful after commit', { payment_id: payment.id });
                } catch (completionErr) {
                    logger.error('[CRITICAL] handlePaydCallback completeOrder failed:', completionErr);
                    // Mark for retry via cron if it fails post-commit
                    await pool.query(
                        `UPDATE payments 
                         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{needs_completion}', 'true'::jsonb)
                         WHERE id = $1`,
                        [payment.id]
                    );
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
                stack: error.stack
            });

            throw error;
        }
    }

    /**
     * Process successful payment logic and trigger ticket creation
     */
    async handleSuccessfulPayment(data) {
        const { reference, amount, metadata } = data;

        logger.info(`[PURCHASE-FLOW] 6. Handling Successful Payment logic for Ref: ${reference}, Amount: ${amount}`);

        let payment = null;

        // 1. Find payment by reference OR invoice_id
        // 1. Find payment by provider_reference or api_ref (Fuzzy matching removed - C-2 FIX)
        const { rows } = await pool.query(
            `SELECT * FROM payments WHERE provider_reference = $1 OR api_ref = $1 LIMIT 1`,
            [reference]
        );
        payment = rows[0];

        if (!payment) {
            logger.warn(`[PAYMENT] No payment found for reference: ${reference}`);
            return { status: 'not_found', message: 'Payment record not found' };
        }

        // If still no payment, use the rows[0] (which will be undefined) or handle normally
        // const payment = rows[0]; // Logic below handles if (!payment)

        if (!payment) {
            // Check if it's a Withdrawal Request (Payout)
            const { rows: withdrawalRows } = await pool.query(
                'SELECT * FROM withdrawal_requests WHERE provider_reference = $1',
                [reference]
            );

            if (withdrawalRows.length > 0) {
                const withdrawal = withdrawalRows[0];
                logger.info(`Payout Callback received for Withdrawal ${withdrawal.id}`);

                if (withdrawal.status === PaymentStatus.COMPLETED || withdrawal.status === PaymentStatus.FAILED) {
                    return { status: 'success', message: 'Withdrawal already processed' };
                }

                // Mark as Completed
                // Since we are in handleSuccessfulPayment, we assume success
                await pool.query(
                    "UPDATE withdrawal_requests SET status = 'completed', raw_response = COALESCE(raw_response, '{}'::jsonb) || $1::jsonb, processed_at = NOW() WHERE id = $2",
                    [JSON.stringify(data.metadata || {}), withdrawal.id]
                );
                logger.info(`Withdrawal ${withdrawal.id} marked as COMPLETED`);
                return { status: 'success', message: 'Withdrawal processed successfully' };
            }

            logger.warn(`Payment/Withdrawal not found for reference: ${reference}`);
            return { status: 'error', message: 'Record not found' };
        }

        if (payment.status === 'completed') {
            logger.info('[PAYD-PAYIN] Payment already marked completed. Skipping side effects.', { reference });
            return { status: 'already_processed', message: 'Payment already completed' };
        }

        // ========================================
        // TRANSACTION-LEVEL LOCKING (P1-001)
        // ========================================
        // Use FOR UPDATE to prevent race conditions when multiple webhooks arrive simultaneously
        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');

            // Lock the payment row for update to prevent concurrent processing
            const { rows: lockedRows } = await dbClient.query(
                `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
                [payment.id]
            );

            if (lockedRows.length === 0) {
                await dbClient.query('ROLLBACK');
                logger.error(`[LOCKING] Payment ${payment.id} not found during lock attempt`);
                throw new Error('Payment not found');
            }

            const lockedPayment = lockedRows[0];

            // ========================================
            // DOUBLE-CHECK IDEMPOTENCY AFTER LOCK (P1-002)
            // ========================================
            // Another webhook might have processed it while we were waiting for the lock
            if (lockedPayment.status !== PaymentStatus.PENDING) {
                await dbClient.query('ROLLBACK');
                logger.warn(`[IDEMPOTENCY] Payment ${payment.id} was processed by concurrent webhook. Skipping.`, {
                    paymentId: payment.id,
                    statusAfterLock: lockedPayment.status
                });
                return {
                    status: 'already_processed',
                    message: 'Payment completed by concurrent webhook',
                    paymentId: payment.id
                };
            }

            logger.info(`[LOCKING] Successfully locked payment ${payment.id} for update`);

            // 2. Validate Amount
            if (amount) {
                const paidAmount = parseFloat(amount);
                if (Math.abs(paidAmount - parseFloat(payment.amount)) > 1) {
                    logger.warn(`Amount mismatch for ${payment.id}: expected ${payment.amount}, got ${paidAmount}`);
                }
            }

            // 3. Mark as Success in DB
            // We also set provider_reference here so that any subsequent webhook matches via tier-1
            logger.info(`[PURCHASE-FLOW] 6b. Updating payment ${payment.id} status to 'completed' and setting provider_reference`);

            const mpesaReceipt = metadata?.data?.third_party_trans_id || metadata?.third_party_trans_id || null;

            await dbClient.query(
                `UPDATE payments 
                 SET status = $1, 
                     provider_reference = $4,
                     mpesa_receipt = $5,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $3`,
                [PaymentStatus.COMPLETED, JSON.stringify({ payd_confirmation: metadata }), payment.id, reference, mpesaReceipt]
            );

            // Commit the transaction to release the lock
            await dbClient.query('COMMIT');
            logger.info(`[LOCKING] Transaction committed and lock released for payment ${payment.id}`);

        } catch (error) {
            if (dbClient) await dbClient.query('ROLLBACK').catch(e => logger.error('Rollback failed:', e));
            logger.error(`[LOCKING] Error in locked transaction for payment ${payment.id}:`, error);
            throw error;
        } finally {
            dbClient.release();
        }

        // 4. Trigger Post-Payment Logic
        // Determine if it's Ticket or Product
        const { rows: updatedRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
        const updatedPayment = updatedRows[0];
        const paymentMeta = updatedPayment.metadata || {};

        logger.info(`[PURCHASE-FLOW] 6c. Payment updated, determining downstream action`, {
            hasOrderId: !!paymentMeta.order_id,
            hasProductId: !!paymentMeta.product_id
        });

        if (paymentMeta.order_id || paymentMeta.product_id) {
            return await this._handleDownstreamOrderAction(updatedPayment, paymentMeta);
        } else if (paymentMeta.type === 'debt' && paymentMeta.debt_id) {
            return await this._handleDownstreamDebtAction(updatedPayment, paymentMeta);
        }

        logger.warn(`[PURCHASE-FLOW] Payment ${payment.id} completed but no downstream action defined (no order_id)`);
        return { status: 'success', message: 'Payment received but no downstream action defined' };
    }

    /**
     * Map Payd provider status to internal status
     * @private
     */
    _mapPaydStatus(providerData) {
        if (providerData.status === 'SUCCESS' || providerData.result_code == 200 || (providerData.result_code == 0 && providerData.success === true)) {
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
            logger.error('[PAYD-PAYIN] CRITICAL: Order completion failed after payment was confirmed.', {
                paymentId: payment.id,
                orderId: metadata.order_id,
                error: completionErr.message
            });
            await pool.query(
                `UPDATE payments SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{needs_completion}', 'true'::jsonb) WHERE id = $1`,
                [payment.id]
            );
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

            await debtClient.query(
                'UPDATE client_debts SET is_paid = true, updated_at = NOW() WHERE id = $1',
                [metadata.debt_id]
            );

            await debtClient.query("UPDATE payments SET status = $1 WHERE id = $2", [PaymentStatus.COMPLETED, payment.id]);

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
        let rows;
        // Check if identifier is a valid integer (for ID lookup)
        const isId = /^\d+$/.test(identifier);

        if (isId) {
            const result = await pool.query('SELECT * FROM payments WHERE id = $1', [identifier]);
            rows = result.rows;
        } else {
            // It's a string reference (provider ref, invoice_id, etc.)
            const result = await pool.query(
                'SELECT * FROM payments WHERE provider_reference = $1 OR invoice_id = $1 OR api_ref = $1',
                [identifier]
            );
            rows = result.rows;
        }

        const payment = rows[0];
        if (!payment) throw new Error('Payment not found');

        // If payment is pending and we have a provider_reference, check Payd status
        if (payment.status === PaymentStatus.PENDING && payment.provider_reference) {
            try {
                const paydStatus = await this.checkTransactionStatus(payment.provider_reference);
                const normalizedStatus = paydStatus.status; // already lowercased in checkTransactionStatus

                if (['success', 'completed', 'processed', 'paid'].includes(normalizedStatus)) {
                    payment.status = PaymentStatus.COMPLETED;
                    // Persist status change immediately
                    await pool.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', [PaymentStatus.COMPLETED, payment.id]);
                    logger.info(`[PaymentService] In-poll sync: Payment ${payment.id} verified as ${normalizedStatus} -> COMPLETED (Persisted)`);

                    // If this is a pending order, trigger completion now instead of waiting for webhook
                    const paymentMeta = payment.metadata || {};
                    if (paymentMeta.order_id || paymentMeta.product_id) {
                        try {
                            await OrderService.completeOrder({
                                ...payment,
                                status: PaymentStatus.COMPLETED
                            });
                            logger.info('[PaymentService] In-poll fulfillment triggered successfully', { payment_id: payment.id });
                        } catch (fulfillErr) {
                            logger.warn('[PaymentService] In-poll fulfillment deferred (already processed or failed)', fulfillErr.message);
                        }
                    }
                } else if (normalizedStatus === 'failed' || normalizedStatus === 'fail' || normalizedStatus === 'declined') {
                    payment.status = 'failed';
                    await pool.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', payment.id]);
                    logger.info(`[PaymentService] In-poll sync: Payment ${payment.id} verified as ${normalizedStatus} -> FAILED (Persisted)`);
                }
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
                const { rows: buyerRows } = await pool.query(
                    'SELECT user_id FROM buyers WHERE id = $1',
                    [buyerProfileId]
                );
                const userId = buyerRows[0]?.user_id;

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

            // Note: status endpoint is v1
            const response = await this.client.get(`/status/${transactionId}`, {
                baseURL: 'https://api.payd.money/api/v1',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            const data = response.data;
            const details = data.transaction_details || {};

            logger.info('[PAYD-STATUS] Status retrieved', {
                transaction_id: transactionId,
                status: details.status || data.status,
                amount: data.amount
            });

            let status = (details.status || data.status || 'pending').toLowerCase();

            // Normalize status strings from Payd
            if (status === 'processed' || status === 'paid') status = 'completed';
            if (status === 'fail') status = 'failed';

            return {
                success: true,
                transaction_id: transactionId,
                status,
                amount: parseFloat(data.amount || 0),
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
        const available = parseFloat(balance.available_balance);
        const requiredWithBuffer = parseFloat(requiredAmount) * (1 + bufferPercent / 100);

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
            const { rows: pendingPayments } = await pool.query(
                `SELECT * FROM payments
 WHERE status = 'pending'
   AND created_at > NOW() - ($1 * INTERVAL '1 hour')
   AND created_at < NOW() - INTERVAL '1 minute'
 ORDER BY created_at ASC
 LIMIT $2`,
                [hoursAgo, limit]
            );

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
                        await pool.query(
                            "UPDATE payments SET status = 'failed', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2",
                            [JSON.stringify({
                                failure_reason: failureReason,
                                failed_by: 'cron_job',
                                failed_at: new Date().toISOString(),
                                provider_data: providerData || { error_code: 404 }
                            }), payment.id]
                        );

                        // If linked to an order, mark the order as failed too
                        if (payment.metadata?.order_id) {
                            try {
                                await pool.query(
                                    "UPDATE product_orders SET status = 'FAILED', payment_status = 'failed' WHERE id = $1",
                                    [payment.metadata.order_id]
                                );
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


    async initiateProductPayment(payload, user) {
        const { phone, email, amount, productId, sellerId, productName, customerName, narration, narrative, city, location, quantity = 1 } = payload;

        // 1. Resolve Buyer Info
        let buyerId = user?.id || null;
        // Fallback to user email/phone if not in payload
        let buyerEmail = email || user?.email;
        let buyerMobilePayment = phone || user?.mobile_payment || user?.mobilePayment || user?.phone;
        let buyerWhatsApp = payload.whatsappNumber || user?.whatsapp_number || user?.whatsappNumber || buyerMobilePayment;

        // Define fallback location info from User if authenticated and not provided
        let shippingAddress = null;
        if (city || location) {
            shippingAddress = { city, location };
        } else if (user?.city || user?.location) {
            shippingAddress = { city: user.city, location: user.location };
        }

        // Fallback for Billing Address (Payd Requirement)
        // Use provided location, user location, or default to Nairobi
        const billingAddress = shippingAddress?.location || shippingAddress?.city || 'Nairobi, Kenya';

        // Basic buyer cleanup if user is not authenticated
        if (!buyerId) {
            // Logic from controller: try to find buyer by phone if not auth
            if (buyerMobilePayment) {
                const buyer = await Buyer.findByPhone(buyerMobilePayment);
                if (buyer) {
                    buyerId = buyer.id;
                    // If we found them in DB, we could prefer DB email if payload email is missing
                    if (!buyerEmail) buyerEmail = buyer.email;
                    if (!buyerWhatsApp) buyerWhatsApp = buyer.whatsapp_number || buyer.whatsappNumber;
                }
            }
        }

        if (!buyerMobilePayment) {
            throw new Error('Mobile payment number is required for payment');
        }

        // 2. Validate Product (Replicating Controller Logic)
        const productResult = await pool.query(
            `SELECT p.*, s.status as seller_status 
             FROM products p
             JOIN sellers s ON p.seller_id = s.id
             WHERE p.id = $1`,
            [productId]
        );

        if (productResult.rows.length === 0) throw new Error('Product not found');
        const product = productResult.rows[0];

        if (product.seller_status !== 'active') throw new Error('Seller is not accepting orders');
        if (product.status !== 'available') throw new Error('Product not available');

        // Verify Price
        const dbPrice = parseFloat(product.price);
        const clientAmount = parseFloat(amount);
        if (Math.abs(dbPrice - clientAmount) > 0.01) {
            logger.warn('Price mismatch', { dbPrice, clientAmount });
            throw new Error('Price verification failed');
        }

        // 3. Create Order
        // Need OrderService.createOrder logic.
        // I will use direct DB insertion for Order if importing OrderService is tricky/circular 
        // OR import OrderService dynamically.
        // Dynamic import is safer for cyclic deps if OrderService also imports Payment (which verify).
        // BUT Order.createOrder calls were refactored to OrderService.createOrder?
        // Let's check OrderService.
        // OrderService.createOrder was NOT implemented in my Phase 2 refactor?
        // Wait, I refactored `OrderController.createOrder` to use `OrderService.createOrder`.
        // So `OrderService.createOrder` EXISTS.
        // Let's import it.

        // const OrderService = (await import('./order.service.js')).default; // Refactored to static import

        const orderData = {
            buyerId,
            sellerId: parseInt(product.seller_id),
            paymentMethod: 'payd',
            buyerName: customerName,
            buyerEmail,
            buyerMobilePayment,
            buyerWhatsApp,
            shippingAddress, // Pass the resolved address
            buyerLocation: payload.metadata?.buyer_location, // Extract from metadata if provided by frontend
            metadata: {
                product_type: product.product_type,
                is_digital: product.is_digital,
                product_id: productId,
                product_name: product.name,
                customer_name: customerName,
                buyer_location: payload.metadata?.buyer_location,
                items: [{
                    productId: productId,
                    name: product.name,
                    price: dbPrice,
                    quantity: parseInt(quantity, 10),
                    subtotal: dbPrice * parseInt(quantity, 10),
                    productType: product.product_type,
                    isDigital: product.is_digital,
                    serviceLocations: product.service_locations // Pass location info
                }],
                paymentInitiation: true
            }
        };

        const order = await OrderService.createOrder(orderData);

        // 4. Create Payment Record (DAO style)
        const paymentData = {
            invoice_id: String(order.id),
            amount,
            currency: 'KES',
            status: PaymentStatus.PENDING,
            payment_method: 'payd',
            phone_number: phone,
            email,
            metadata: {
                order_id: order.id,
                order_number: order.order_number,
                product_id: productId,
                seller_id: sellerId,
                product_type: product.product_type,
                buyer_id: buyerId, // buyers.id, may be null for anonymous
                narration: narration || narrative || `Payment for ${productName}`
            }
        };

        // Reuse initiateTicketPayment style insertion (DAO)
        // Or create a generic insert DAO method?
        // Just raw SQL here for now to be explicit.
        const insertRes = await pool.query(
            `INSERT INTO payments (invoice_id, email, mobile_payment, whatsapp_number, amount, status, payment_method, metadata)
              VALUES ($1, $2, $3, $4, $5, 'pending', 'payd', $6) RETURNING *`,
            [paymentData.invoice_id, buyerEmail, buyerMobilePayment, buyerWhatsApp, amount, JSON.stringify(paymentData.metadata)]
        );
        const payment = insertRes.rows[0];

        // 5. Initiate Gateway
        try {
            const gwPayload = {
                ...paymentData,
                // initiatePayment expects 'phone' key for the number to charge
                phone: buyerMobilePayment,
                firstName: customerName?.split(' ')[0],
                narration: narration || narrative || `Payment for ${product.name} from ${product.shopName || 'Byblos'}`
            };

            const result = await this.initiatePayment(gwPayload);

            // 6. Update Payment with Reference
            await pool.query("UPDATE payments SET provider_reference = $1, api_ref = $1 WHERE id = $2", [result.reference, payment.id]);

            return {
                ...result,
                order_id: order.id,
                order_number: order.order_number
            };
        } catch (gwError) {
            // Attach order and payment IDs to error for controller to mark as failed
            gwError.orderId = order.id;
            gwError.paymentId = payment.id;
            throw gwError;
        }
    }
}

export default new PaymentService();
