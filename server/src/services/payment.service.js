import axios from 'axios';
import https from 'https';
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
            ca: process.env.PAYD_CA_CERT_PATH ? require("fs").readFileSync(process.env.PAYD_CA_CERT_PATH) : undefined
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

        // Validate base URL is reachable
        this._validateBaseUrl().catch(err => {
            logger.warn('[PAYD-INIT] Base URL validation failed:', err.message);
        });
    }

    async _validateBaseUrl() {
        try {
            // Using a simple HEAD request via Axios for consistency
            await this.client.head('/', { timeout: 10000 });
            logger.info('[PAYD-INIT] Base URL validated successfully');
        } catch (error) {
            // Log but don't throw to avoid crashing the whole service
            logger.warn('[PAYD-INIT] Base URL validation probe failed (non-critical)', {
                error: error.message,
                baseUrl: this.baseUrl
            });
        }
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
                narration: narrative || `Payment for ${invoice_id}`,
                currency: "KES",
                callback_url: callbackUrl,
                billing_address: {
                    email: email,
                    first_name: first_name || 'Customer',
                    last_name: last_name || '',
                    city: 'Nairobi',
                    country: 'Kenya'
                }
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
            const response = await this._retryRequest(async () => {
                return await this.client.post('/payments', payload, {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
            }, 3, 1000);

            const duration = Date.now() - startTime;

            // ============================================================
            // STEP 5: PARSE RESPONSE
            // ============================================================
            const resData = response.data.data || response.data;

            // Extract transaction reference (Standardizing on transaction_reference)
            const reference = resData.transaction_reference ||
                resData.transaction_id ||
                resData.reference ||
                resData.tracking_id ||
                `PAYD-${Date.now()}`;

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
        let digits = phone.toString().replace(/\D/g, '');

        if (digits.startsWith('254') && digits.length === 12) {
            digits = '0' + digits.substring(3);
        } else if (digits.length === 9) {
            digits = '0' + digits;
        } else if (digits.startsWith('0') && digits.length === 10) {
            // Already correct
        } else {
            throw new PaydError(
                `Invalid phone number: "${phone}". Expected 10-digit number starting with 0 (e.g. 07XXXXXXXX)`,
                PaydErrorCodes.INVALID_PHONE
            );
        }

        return digits;
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
            ca: process.env.PAYD_CA_CERT_PATH ? require("fs").readFileSync(process.env.PAYD_CA_CERT_PATH) : undefined
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

            const reference = data.transaction_reference ||
                data.transaction_id ||
                data.reference ||
                data.tracking_id;

            const status = data.status?.toLowerCase();
            const amount = parseFloat(data.amount || 0);
            const phone = data.phone_number || data.phone;
            const resultCode = data.result_code || callbackData.result_code;

            if (!reference) {
                logger.error('[PAYD-WEBHOOK] Missing reference in callback payload', callbackData);
                throw new Error('Webhook missing transaction reference');
            }

            // Determine Success: result_code 0 is success in v2, OR status SUCCESS/COMPLETED
            const isSuccess = (resultCode == 0 || resultCode === '0' ||
                status === 'success' || status === 'completed' || status === 'paid');

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
                'SELECT * FROM payments WHERE provider_reference = $1 OR invoice_id = $2 OR api_ref = $1',
                [reference, reference]
            );

            if (!payments || payments.length === 0) {
                // If not found, try handlesuccessfulpayment for fuzzy matching
                if (isSuccess) {
                    return await this.handleSuccessfulPayment({
                        reference,
                        amount,
                        metadata: callbackData
                    });
                }

                logger.warn('[PAYD-WEBHOOK] Payment record not found', { reference });
                return { success: false, message: 'Payment record not found' };
            }

            const payment = payments[0];

            // ============================================================
            // STEP 3: CHECK IDEMPOTENCY (Prevent duplicate processing)
            // ============================================================
            if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.SUCCESS) {
                logger.warn('[PAYD-WEBHOOK] Duplicate success webhook ignored', {
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
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Update payment record
                await client.query(
                    `UPDATE payments 
                     SET status = $1,
                         metadata = jsonb_set(
                             COALESCE(metadata, '{}'::jsonb),
                             '{webhook_received_at}',
                             $2::jsonb
                         ),
                         updated_at = NOW()
                     WHERE id = $3`,
                    [isSuccess ? PaymentStatus.COMPLETED : 'failed', JSON.stringify(new Date().toISOString()), payment.id]
                );

                // ============================================================
                // STEP 5: PROCESS BASED ON STATUS
                // ============================================================
                if (isSuccess) {
                    logger.info('[PAYD-WEBHOOK] Payment successful, updating order', {
                        payment_id: payment.id,
                        amount
                    });

                    // Update order to COMPLETED
                    const paymentMeta = payment.metadata || {};
                    if (paymentMeta.order_id || paymentMeta.product_id) {
                        await OrderService.completeOrder({
                            ...payment,
                            status: PaymentStatus.COMPLETED,
                            metadata: { ...paymentMeta, payd_confirmation: callbackData }
                        });
                    } else if (paymentMeta.type === 'debt' && paymentMeta.debt_id) {
                        await client.query(
                            'UPDATE client_debts SET is_paid = true, updated_at = NOW() WHERE id = $1',
                            [paymentMeta.debt_id]
                        );
                    }

                } else if (status === 'failed' || status === 'cancelled' || resultCode == 1) {
                    logger.warn('[PAYD-WEBHOOK] Payment failed', {
                        payment_id: payment.id,
                        status
                    });

                    // Update order to FAILED if linked
                    const paymentMeta = payment.metadata || {};
                    if (paymentMeta.order_id) {
                        await client.query(
                            "UPDATE product_orders SET status = 'FAILED', payment_status = 'failed' WHERE id = $1",
                            [paymentMeta.order_id]
                        );
                    }
                }

                await client.query('COMMIT');

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
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

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
        const { rows: refRows } = await pool.query(
            'SELECT * FROM payments WHERE provider_reference = $1 OR api_ref = $1 OR invoice_id = $1 LIMIT 1',
            [reference]
        );

        if (refRows.length > 0) {
            payment = refRows[0];
            logger.info(`[PURCHASE-FLOW] 6a. Found Payment via Reference: ${payment.id}`);
        } else {
            // 1b. Try to find by invoice_id/order_id inside metadata
            const meta = metadata.data || metadata;
            const possibleInvoiceId = meta.invoice_id || meta.external_id || meta.order_id || meta.account_number;

            if (possibleInvoiceId) {
                logger.info(`Reference ${reference} not found directly, checking for invoice_id: ${possibleInvoiceId}`);
                const { rows: invRows } = await pool.query(
                    'SELECT * FROM payments WHERE invoice_id = $1 OR api_ref = $1 LIMIT 1',
                    [String(possibleInvoiceId)]
                );
                if (invRows.length > 0) {
                    payment = invRows[0];
                    logger.info(`Match found via Invoice ID from metadata: ${payment.id}`);

                    // Update provider_reference so subsequent hooks match directly
                    await pool.query('UPDATE payments SET provider_reference = $1 WHERE id = $2', [reference, payment.id]);
                }
            }
        }

        if (!payment) {
            // 1c. Fuzzy match: Find by Status + Amount + Phone (if available)
            // This handles cases where Payd generates a new reference we don't know
            logger.info(`Reference ${reference} still not found, attempting fuzzy match...`);

            // Extract phone and amount from metadata (could be flat or nested in .data)
            const meta = metadata.data || metadata;
            const webhookPhone = meta.phone_number || meta.phone || meta.customer_phone || meta.msisdn;
            const webhookAmount = parseFloat(amount || meta.amount);

            if (webhookPhone && !isNaN(webhookAmount) && webhookAmount > 0) {
                // Extract last 9 digits to be safe (safely ignores 0 vs 254 prefix)
                const phoneTail = webhookPhone.slice(-9);

                logger.info(`Fuzzy matching for Amount: ${webhookAmount}, Phone Tail: ${phoneTail}`);

                const { rows: fuzzyRows } = await pool.query(
                    `SELECT * FROM payments 
                     WHERE status = $1 
                     AND amount = $2 
                     AND mobile_payment LIKE '%' || $3 
                     AND created_at > NOW() - INTERVAL '30 minute'
                     ORDER BY created_at DESC LIMIT 1`,
                    [PaymentStatus.PENDING, webhookAmount, phoneTail]
                );

                if (fuzzyRows.length > 0) {
                    payment = fuzzyRows[0];
                    logger.info(`Fuzzy match found: Payment ID ${payment.id}`);

                    // Update the payment with the CORRECT reference from Payd so subsequent hooks match
                    // We only update provider_reference, leaving api_ref as the original REF-... 
                    // so the frontend (which polls api_ref) can still find it.
                    await pool.query(
                        'UPDATE payments SET provider_reference = $1 WHERE id = $2',
                        [reference, payment.id]
                    );
                }
            } else {
                logger.warn('Insufficient data for fuzzy match (missing phone or amount)');
            }
        }

        // If still no payment, use the rows[0] (which will be undefined) or handle normally
        // const payment = rows[0]; // Logic below handles if (!payment)

        if (!payment) {
            // Check if it's a Withdrawal Request (Payout)
            const { rows: withdrawalRows } = await pool.query(
                'SELECT * FROM withdrawal_requests WHERE provider_reference = $1 OR id::text = $1',
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

        if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.SUCCESS) {
            logger.warn(`[IDEMPOTENCY] Payment ${payment.id} already processed (status: ${payment.status}). Skipping duplicate webhook.`, {
                paymentId: payment.id,
                currentStatus: payment.status,
                webhookReference: reference
            });
            return { status: 'success', message: 'Payment already completed' };
        }

        // ========================================
        // TRANSACTION-LEVEL LOCKING (P1-001)
        // ========================================
        // Use FOR UPDATE to prevent race conditions when multiple webhooks arrive simultaneously
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Lock the payment row for update to prevent concurrent processing
            const { rows: lockedRows } = await client.query(
                `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
                [payment.id]
            );

            if (lockedRows.length === 0) {
                await client.query('ROLLBACK');
                logger.error(`[LOCKING] Payment ${payment.id} not found during lock attempt`);
                throw new Error('Payment not found');
            }

            const lockedPayment = lockedRows[0];

            // ========================================
            // DOUBLE-CHECK IDEMPOTENCY AFTER LOCK (P1-002)
            // ========================================
            // Another webhook might have processed it while we were waiting for the lock
            if (lockedPayment.status === PaymentStatus.COMPLETED || lockedPayment.status === PaymentStatus.SUCCESS) {
                await client.query('ROLLBACK');
                logger.warn(`[IDEMPOTENCY] Payment ${payment.id} was processed by concurrent webhook. Skipping.`, {
                    paymentId: payment.id,
                    statusAfterLock: lockedPayment.status
                });
                return {
                    status: 'success',
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

            // 3. Mark as Success in DB (normalized to lowercase 'completed' per PaymentStatus enum)
            logger.info(`[PURCHASE-FLOW] 6b. Updating payment ${payment.id} status to 'completed'`);
            await client.query(
                `UPDATE payments 
                 SET status = $1, 
                     metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $3`,
                [PaymentStatus.COMPLETED, JSON.stringify({ payd_confirmation: metadata }), payment.id]
            );

            // Commit the transaction to release the lock
            await client.query('COMMIT');
            logger.info(`[LOCKING] Transaction committed and lock released for payment ${payment.id}`);

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`[LOCKING] Error in locked transaction for payment ${payment.id}:`, error);
            throw error;
        } finally {
            client.release();
        }

        // 4. Trigger Post-Payment Logic
        // Determine if it's Ticket or Product
        const { rows: updatedRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
        const updatedPayment = updatedRows[0];
        const paymentMeta = updatedPayment.metadata || {};

        logger.info(`[PURCHASE-FLOW] 6c. Payment updated, determining downstream action`, {
            hasOrderId: !!paymentMeta.order_id,
            hasProductId: !!paymentMeta.product_id,
            hasTicketTypeId: !!(updatedPayment.ticket_type_id || paymentMeta.ticket_type_id)
        });

        if (paymentMeta.order_id || paymentMeta.product_id) {
            // It's a Product Order
            // Call OrderService to complete
            import('./order.service.js').then(async ({ default: OrderService }) => {
                try {
                    logger.info(`[PURCHASE-FLOW] 7. Completing Order ${paymentMeta.order_id} via OrderService.completeOrder()`);
                    const completionResult = await OrderService.completeOrder(updatedPayment);
                    logger.info(`[PURCHASE-FLOW] 8. Order Completion Result:`, completionResult);
                } catch (e) {
                    logger.error('[PURCHASE-FLOW] ERROR Step 7/8 - Error completing order after payment:', e);
                }
            });
            return { status: 'success', message: 'Payment processed and Order completion queued' };

        } else if (paymentMeta.type === 'debt' && paymentMeta.debt_id) {
            // It's a Debt Payment
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                logger.info(`[PURCHASE-FLOW] 7. Marking debt ${paymentMeta.debt_id} as paid`);

                await client.query(
                    'UPDATE client_debts SET is_paid = true, updated_at = NOW() WHERE id = $1',
                    [paymentMeta.debt_id]
                );

                // Update payment status (already done, but good to ensure transaction consistency if needed)
                await client.query("UPDATE payments SET status = $1 WHERE id = $2", [PaymentStatus.COMPLETED, updatedPayment.id]);

                await client.query('COMMIT');
                logger.info(`[PURCHASE-FLOW] 8. Debt ${paymentMeta.debt_id} settled successfully`);
            } catch (e) {
                await client.query('ROLLBACK');
                logger.error('[PURCHASE-FLOW] ERROR - Error settling debt after payment:', e);
            } finally {
                client.release();
            }
            return { status: 'success', message: 'Payment processed and Debt settled' };
        }
        logger.warn(`[PURCHASE-FLOW] Payment ${payment.id} completed but no downstream action defined (no order_id or ticket_type_id)`);
        return { status: 'success', message: 'Payment received but no downstream action defined' };
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
                if (paydStatus.status === 'success' || paydStatus.status === 'failed') {
                    // This will be caught by the next webhook or we could manually sync here
                    // For now, we'll just return the updated status if it was success/failed
                    payment.status = paydStatus.status;
                }
            } catch (err) {
                logger.warn('[PaymentService] Status sync during check failed', err.message);
            }
        }

        // If payment is successful and has buyer info, generate auto-login token
        let autoLoginToken = null;
        if ((payment.status === 'completed' || payment.status === 'success') && payment.buyer_id) {
            try {
                const { signAutoLoginToken } = await import('../utils/jwt.js');
                autoLoginToken = signAutoLoginToken(payment.buyer_id, 'buyer', 'payment_success');
                logger.info(`[PaymentService] Generated auto-login token for buyer ${payment.buyer_id}`);
            } catch (error) {
                logger.error('[PaymentService] Failed to generate auto-login token:', error);
                // Don't fail the request if token generation fails
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

            return {
                success: true,
                transaction_id: transactionId,
                status: (details.status || data.status || 'pending').toLowerCase(),
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
                 AND created_at > NOW() - INTERVAL '${hoursAgo} hours'
                 AND created_at < NOW() - INTERVAL '1 minute'
                 ORDER BY created_at ASC
                 LIMIT $1`,
                [limit]
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
                        // it's likely orphaned (initiation failed but wasn't marked as failed)
                        if (ageMinutes > 30) {
                            logger.warn(`Marking orphaned payment ${payment.id} as failed (age: ${ageMinutes}m, no provider_reference)`);
                            await pool.query(
                                "UPDATE payments SET status = 'failed', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2",
                                [JSON.stringify({
                                    failure_reason: 'Orphaned payment - no provider reference after 30 minutes',
                                    failed_by: 'cron_job',
                                    failed_at: new Date().toISOString()
                                }), payment.id]
                            );
                            results.orphanedCount++;
                            results.failedCount++;
                        }
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

                        // Map provider status
                        // Payd v3 usually returns { status: 'SUCCESS' | 'FAILED' | ... }
                        if (providerData.status === 'SUCCESS' || providerData.result_code == 200) {
                            providerStatus = 'success';
                        } else if (providerData.status === 'FAILED') {
                            providerStatus = 'failed';
                        }
                    } catch (netErr) {
                        // Check if it's a 404 error
                        if (netErr.response?.status === 404) {
                            is404Error = true;

                            // If payment is older than 30 minutes and returns 404,
                            // it's likely the payment doesn't exist in Payd's system
                            if (ageMinutes > 30) {
                                logger.warn(`Payment ${payment.id} not found in Payd (404) after ${ageMinutes} minutes - marking as failed`);
                                providerStatus = 'failed';
                            } else {
                                // For newer payments, just log and skip (might still be processing)
                                logger.info(`Payment ${payment.id} returned 404 but is only ${ageMinutes}m old - will retry later`);
                            }
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
        const { phone, email, amount, productId, sellerId, productName, customerName, narrative, city, location, quantity = 1 } = payload;

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
                ...(payload.metadata || {}),
                product_type: product.product_type,
                is_digital: product.is_digital,
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
            event_id: null,
            organizer_id: null,
            ticket_type_id: null,
            metadata: {
                order_id: order.id,
                order_number: order.order_number,
                product_id: productId,
                seller_id: sellerId,
                product_type: product.product_type,
                narrative: narrative || `Payment for ${productName}`
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
                narrative: paymentData.metadata.narrative
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
