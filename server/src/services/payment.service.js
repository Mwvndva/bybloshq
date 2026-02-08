import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import dns from 'dns';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import { PaymentStatus } from '../constants/enums.js';
import OrderService from './order.service.js';

export class PaymentService {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v3';
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
            timeout: 60000,               // ✅ Socket timeout
            scheduling: 'lifo',           // ✅ Reuse most recent socket
            rejectUnauthorized: false     // ⚠️  Only until you get Payd's SSL cert
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
            const url = new URL(this.baseUrl);
            const options = {
                method: 'HEAD',
                hostname: url.hostname,
                port: url.port || 443,
                path: '/',
                agent: this.httpsAgent,
                timeout: 5000
            };

            await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    resolve();
                });
                req.on('error', reject);
                req.on('timeout', () => reject(new Error('Timeout')));
                req.end();
            });

            logger.info('[PAYD-INIT] Base URL validated successfully');
        } catch (error) {
            // Log but don't throw to avoid crashing the whole service
            logger.warn('[PAYD-INIT] Base URL validation probe failed', {
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
     * Initiate a payment with Payd (STK Push)
     * Matches structure of: 
     * curl --location 'https://api.mypayd.app/api/v3/payments' \
     * --header 'Content-Type: application/json' \
     * --header 'Authorization: Basic ...' \
     * --data-raw '{ ... }'
     */
    async initiatePayment(paymentData) {
        const startTime = Date.now();

        try {
            const { email, amount, invoice_id, phone, narrative, firstName, lastName, billing_address } = paymentData;

            if (!this.networkCode || !this.channelId) {
                throw new Error('Payd network code or channel ID not configured');
            }

            // Validate credentials
            if (!this.username || !this.password) {
                throw new Error('Payd credentials not configured');
            }

            const paydAmount = parseFloat(amount);
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('254')) {
                cleanPhone = '0' + cleanPhone.substring(3);
            } else if (cleanPhone.length === 9) {
                cleanPhone = '0' + cleanPhone;
            }

            const callbackUrl = process.env.PAYD_CALLBACK_URL ||
                (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/payments/webhook/payd` :
                    "https://bybloshq.space/api/payments/webhook/payd");

            logger.info(`[PURCHASE-FLOW] 1. Initiating Payd Payment for Invoice: ${invoice_id}`, {
                amount: paydAmount,
                phone: cleanPhone,
                targetUrl: `${this.baseUrl}/payments`,
                timestamp: new Date().toISOString()
            });

            const payloadData = JSON.stringify({
                username: this.payloadUsername,
                channel: "MPESA",
                amount: paydAmount,
                phone_number: cleanPhone,
                narration: narrative || `Payment for ${invoice_id}`,
                currency: "KES",
                callback_url: callbackUrl,
                billing_address: billing_address || 'Nairobi, Kenya'
            });

            // ✅ FIX 2: Enhanced request with proper event handling
            const makeRequest = () => new Promise((resolve, reject) => {
                const url = new URL(`${this.baseUrl}/payments`);

                const options = {
                    method: 'POST',
                    hostname: url.hostname,
                    port: url.port || 443,
                    path: url.pathname + url.search,  // ✅ Include query params
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payloadData),  // ✅ Correct length
                        'User-Agent': 'ByblosHQ/2.0 (Node.js)',
                        'Accept': 'application/json',
                        'Connection': 'keep-alive'  // ✅ Request keep-alive
                    },
                    agent: this.httpsAgent  // ✅ Use persistent agent
                };

                logger.info('[PAYD-REQUEST] Initiating request', {
                    hostname: options.hostname,
                    path: options.path,
                    contentLength: options.headers['Content-Length']
                });

                let requestTimeout;
                let responseTimeout;
                let isResolved = false;

                const cleanup = () => {
                    if (requestTimeout) clearTimeout(requestTimeout);
                    if (responseTimeout) clearTimeout(responseTimeout);
                };

                const safeReject = (error) => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();
                        reject(error);
                    }
                };

                const safeResolve = (data) => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();
                        resolve(data);
                    }
                };

                const req = https.request(options, (res) => {
                    logger.info('[PAYD-RESPONSE] Received response', {
                        statusCode: res.statusCode,
                        headers: res.headers
                    });

                    let data = '';

                    // ✅ FIX 3: Set response timeout (90 seconds)
                    responseTimeout = setTimeout(() => {
                        logger.error('[PAYD-RESPONSE] Response timeout - no data received');
                        req.destroy();
                        safeReject(new Error('Response timeout'));
                    }, 90000);

                    res.on('data', (chunk) => {
                        data += chunk;
                        // Reset response timeout on data received
                        if (responseTimeout) {
                            clearTimeout(responseTimeout);
                            responseTimeout = setTimeout(() => {
                                logger.error('[PAYD-RESPONSE] Response timeout during data transfer');
                                req.destroy();
                                safeReject(new Error('Response timeout'));
                            }, 90000);
                        }
                    });

                    res.on('end', () => {
                        cleanup();

                        logger.info('[PAYD-RESPONSE] Response complete', {
                            statusCode: res.statusCode,
                            dataLength: data.length
                        });

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const parsed = JSON.parse(data);
                                safeResolve({ data: parsed, status: res.statusCode });
                            } catch (e) {
                                logger.error('[PAYD-RESPONSE] Failed to parse success response', {
                                    error: e.message,
                                    data: data.substring(0, 200)
                                });
                                safeReject(new Error(`Invalid JSON response: ${e.message}`));
                            }
                        } else {
                            logger.error('[PAYD-RESPONSE] HTTP error response', {
                                statusCode: res.statusCode,
                                data: data.substring(0, 200)
                            });

                            try {
                                const errData = JSON.parse(data);
                                safeReject({
                                    response: {
                                        status: res.statusCode,
                                        data: errData
                                    }
                                });
                            } catch (e) {
                                safeReject({
                                    response: {
                                        status: res.statusCode,
                                        data: { message: data || 'Unknown error' }
                                    }
                                });
                            }
                        }
                    });

                    res.on('error', (err) => {
                        logger.error('[PAYD-RESPONSE] Response stream error:', err);
                        safeReject(err);
                    });
                });

                // ✅ FIX 4: Comprehensive error handlers
                req.on('error', (err) => {
                    logger.error('[PAYD-REQUEST] Request error:', {
                        code: err.code,
                        message: err.message,
                        errno: err.errno,
                        syscall: err.syscall
                    });
                    safeReject(err);
                });

                req.on('timeout', () => {
                    logger.error('[PAYD-REQUEST] Request timeout (connection)');
                    req.destroy();
                    safeReject(new Error('ETIMEDOUT'));
                });

                req.on('abort', () => {
                    logger.error('[PAYD-REQUEST] Request aborted');
                    safeReject(new Error('Request aborted'));
                });

                // ✅ FIX 5: Socket-level event handlers
                req.on('socket', (socket) => {
                    logger.info('[PAYD-SOCKET] Socket assigned', {
                        localAddress: socket.localAddress,
                        localPort: socket.localPort,
                        remoteAddress: socket.remoteAddress,
                        remotePort: socket.remotePort
                    });

                    socket.on('connect', () => {
                        logger.info('[PAYD-SOCKET] Socket connected');
                    });

                    socket.on('secureConnect', () => {
                        logger.info('[PAYD-SOCKET] SSL/TLS connection established', {
                            authorized: socket.authorized,
                            protocol: typeof socket.getProtocol === 'function' ? socket.getProtocol() : 'unknown'
                        });
                    });

                    socket.on('timeout', () => {
                        logger.error('[PAYD-SOCKET] Socket timeout');
                        req.destroy();
                        safeReject(new Error('Socket timeout'));
                    });

                    socket.on('end', () => {
                        logger.info('[PAYD-SOCKET] Socket ended by server');
                    });

                    socket.on('close', (hadError) => {
                        logger.info('[PAYD-SOCKET] Socket closed', { hadError });
                        if (hadError && !isResolved) {
                            safeReject(new Error('Socket closed with error'));
                        }
                    });

                    socket.on('error', (err) => {
                        logger.error('[PAYD-SOCKET] Socket error:', {
                            code: err.code,
                            message: err.message
                        });
                        safeReject(err);
                    });

                    // ✅ FIX 6: Set socket timeout (60 seconds for connection)
                    socket.setTimeout(60000);
                });

                // ✅ FIX 7: Set request timeout (60 seconds for connection establishment)
                requestTimeout = setTimeout(() => {
                    logger.error('[PAYD-REQUEST] Connection timeout');
                    req.destroy();
                    safeReject(new Error('Connection timeout'));
                }, 60000);

                // Send request
                req.write(payloadData, 'utf8', (err) => {
                    if (err) {
                        logger.error('[PAYD-REQUEST] Write error:', err);
                        safeReject(err);
                    } else {
                        logger.info('[PAYD-REQUEST] Payload written successfully');
                    }
                });

                req.end();
            });

            // ✅ FIX 8: Enhanced retry with exponential backoff
            const response = await this._retryRequest(() => makeRequest(), 3, 1000);

            const duration = Date.now() - startTime;
            logger.info(`[PURCHASE-FLOW] Payment initiated successfully`, {
                duration: `${duration}ms`,
                status: response.status,
                reference: response.data.transaction_id || response.data.reference
            });

            return {
                authorization_url: null,
                access_code: null,
                reference: response.data.transaction_id ||
                    response.data.reference ||
                    response.data.tracking_id ||
                    `REF-${Date.now()}`,
                status: response.status,
                original_response: response.data
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            const errorDetails = error.response ? {
                status: error.response.status,
                data: error.response.data
            } : {
                message: error.message || 'Unknown error',
                code: error.code,
                errno: error.errno,
                syscall: error.syscall
            };

            logger.error('[PURCHASE-FLOW] Payment initiation failed', {
                duration: `${duration}ms`,
                invoice_id: paymentData.invoice_id,
                error: errorDetails
            });

            // Enhanced error message
            let errorMessage = 'Payment initialization failed. Please try again.';

            if (error.code === 'ECONNRESET' || error.message === 'socket hang up') {
                errorMessage = 'Connection to payment provider failed. Please try again.';
                logger.error('[PURCHASE-FLOW] CRITICAL: Payd connection reset (socket hang up). This might be a temporary network issue or server-side termination.');
            } else if (error.code === 'ETIMEDOUT' || error.message === 'Connection timeout' || error.message === 'Response timeout') {
                errorMessage = 'Payment provider is taking too long to respond. Please try again.';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Payment provider unreachable. Please check your internet connection.';
            } else if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }

            throw new Error(errorMessage);
        }
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

        // Create new agent
        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 60000,
            scheduling: 'lifo',
            rejectUnauthorized: false
        });

        // Re-mount to axios client too
        this.client.defaults.httpsAgent = this.httpsAgent;

        logger.info('[HTTPS-AGENT] Agent reset complete');
    }

    /**
     * Handle Payd Webhook/Callback
     */
    async handlePaydCallback(callbackData) {
        logger.info('[PURCHASE-FLOW] 3. Webhook Received - Raw Data:', callbackData);

        // Map fields based on user documentation
        // { "transaction_reference": "TX...", "result_code": 200, "remarks": "...", ... }
        const reference = callbackData.transaction_reference || callbackData.transaction_id || callbackData.reference;
        const resultCode = callbackData.result_code;
        const status = callbackData.status; // Fallback if they send status

        logger.info(`[PURCHASE-FLOW] 4. Processing Callback for Ref: ${reference}`, {
            resultCode,
            status,
            successCheck: (resultCode == 200 || resultCode === '200' || resultCode == 0 || resultCode === '0')
        });

        if (!reference) {
            console.error('[PURCHASE-FLOW] ERROR: Missing reference', callbackData);
            // Don't throw immediately, check if we can find by invoice_id in other fields?
            // For now, throw but log visibly
            throw new Error('No transaction_reference provided in callback');
        }

        // Determine Success: result_code 200 OR 0 is success
        let isSuccess = false;
        if (resultCode == 200 || resultCode === '200' || resultCode == 0 || resultCode === '0') {
            isSuccess = true;
        } else if (!resultCode && (status === 'SUCCESS' || status === 'COMPLETED')) {
            // Fallback to old logic just in case
            isSuccess = true;
        }

        if (!isSuccess) {
            logger.warn(`[PURCHASE-FLOW] 4b. Transaction Failed - Marking DB as Failed`, { reference, reason: callbackData.remarks });
            const { rows } = await pool.query(
                "UPDATE payments SET status = 'failed', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE provider_reference = $2 RETURNING id, metadata",
                [JSON.stringify({ failure_reason: callbackData.remarks || callbackData.status_description || 'Failed', raw_callback: callbackData }), reference]
            );

            if (rows.length > 0) {
                const updatedPayment = rows[0];
                const paymentMeta = updatedPayment.metadata || {};

                // If linked to an order, mark the order as failed too
                if (paymentMeta.order_id) {
                    try {
                        await pool.query(
                            "UPDATE product_orders SET status = 'FAILED', payment_status = 'failed' WHERE id = $1",
                            [paymentMeta.order_id]
                        );
                        logger.info(`[PURCHASE-FLOW] Marked Order ${paymentMeta.order_id} as FAILED due to payment failure`);
                    } catch (orderErr) {
                        logger.error(`[PURCHASE-FLOW] Failed to mark order ${paymentMeta.order_id} as failed:`, orderErr);
                    }
                }

                return { status: 'failed', message: 'Payment marked as failed' };
            }

            // Check if it's a Withdrawal Request (Payout Failure)
            const { rows: withdrawalRows } = await pool.query(
                'SELECT * FROM withdrawal_requests WHERE provider_reference = $1 OR id::text = $1',
                [reference]
            );

            if (withdrawalRows.length > 0) {
                const withdrawal = withdrawalRows[0];
                if (withdrawal.status === 'failed') return { status: 'success', message: 'Already marked failed' };

                // Handle Failure - REFUND SELLER
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    // 1. Mark as failed
                    await client.query(
                        "UPDATE withdrawal_requests SET status = 'failed', raw_response = COALESCE(raw_response, '{}'::jsonb) || $1::jsonb WHERE id = $2",
                        [JSON.stringify(callbackData), withdrawal.id]
                    );

                    // 2. Refund Balance
                    await client.query(
                        "UPDATE sellers SET balance = balance + $1 WHERE id = $2",
                        [withdrawal.amount, withdrawal.seller_id]
                    );

                    await client.query('COMMIT');
                    logger.info(`[PURCHASE-FLOW] Withdrawal ${withdrawal.id} FAILED. Computed refund of ${withdrawal.amount} to seller ${withdrawal.seller_id}`);
                    return { status: 'success', message: 'Withdrawal failure processed and refunded' };

                } catch (err) {
                    await client.query('ROLLBACK');
                    logger.error(`Error processing withdrawal refund for ${withdrawal.id}`, err);
                    throw err;
                } finally {
                    client.release();
                }
            }

            logger.warn(`Failed transaction not found in payments or withdrawals: ${reference}`);
            return { status: 'failed', message: 'Transaction not found' };
        }

        // Handle Success
        logger.info(`[PURCHASE-FLOW] 5. Transaction Successful - Proceeding to Completion logic`, { reference });
        return await this.handleSuccessfulPayment({
            reference,
            amount: callbackData.amount,
            metadata: callbackData
        });
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
            // 1b. Fuzzy match: Find by Status + Amount + Phone (if available)
            // This handles cases where Payd generates a new reference we don't know
            logger.info(`Reference ${reference} not found, attempting fuzzy match...`);

            const webhookPhone = metadata.phone_number || metadata.phone; // "254111..."
            const webhookAmount = parseFloat(amount);

            if (webhookPhone && webhookAmount) {
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

        } else if (updatedPayment.ticket_type_id || paymentMeta.ticket_type_id) {
            // It's a Ticket
            import('./ticket.service.js').then(async ({ default: TicketService }) => {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    logger.info(`[PURCHASE-FLOW] 7. Creating ticket for payment ${updatedPayment.id}`);
                    const ticket = await TicketService.createTicket(client, updatedPayment);
                    const qr = await TicketService.generateQRCode(ticket);
                    await TicketService.sendTicketEmail(ticket, updatedPayment, qr);

                    // Update payment to fully COMPLETED (already set above, but ensure consistency)
                    await client.query("UPDATE payments SET status = $1 WHERE id = $2", [PaymentStatus.COMPLETED, updatedPayment.id]);
                    await client.query('COMMIT');
                    logger.info(`[PURCHASE-FLOW] 8. Ticket created and sent successfully`);
                } catch (e) {
                    await client.query('ROLLBACK');
                    logger.error('[PURCHASE-FLOW] ERROR - Error processing ticket after payment:', e);
                    // Don't fail the webhook response, just log.
                } finally {
                    client.release();
                }
            });
            return { status: 'success', message: 'Payment processed and Ticket generation queued' };
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

    // New Orchestration Methods
    async initiateTicketPayment(payload) {
        // This logic is complex (price calc, discount validation).
        // Ideally it should be here.
        // Due to current step limitations and user request flow...
        // I am not moving the entire validation logic from Controller to here right now 
        // because I already deleted it from Controller without moving it! 
        // WAIT. I deleted the Controller logic in previous step.
        // I MUST implement it here now or it's lost.

        // Re-implementing validation logic...
        // I need to import Event, DiscountCode etc. or just query DB.
        // I'll query DB directly for simplicity and robustness.

        const { phone, email, ticketId, eventId, quantity = 1, discountCode, customerName } = payload;

        // 1. Validate Event
        const { rows: events } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (events.length === 0) throw new Error('Event not found');
        const event = events[0];

        // 2. Validate Ticket
        const { rows: ticketTypes } = await pool.query('SELECT price, name FROM event_ticket_types WHERE id = $1 AND event_id = $2', [ticketId, eventId]);
        if (ticketTypes.length === 0) throw new Error('Ticket type not found');
        const ticketType = ticketTypes[0];

        let amount = parseFloat(ticketType.price) * parseInt(quantity, 10);
        let discountAmount = 0;

        // 3. Discount
        if (discountCode) {
            const { rows: discounts } = await pool.query("SELECT * FROM discount_codes WHERE code = $1 AND event_id = $2 AND status = 'active'", [discountCode, eventId]);
            if (discounts.length > 0) {
                const d = discounts[0];
                if (d.type === 'percentage') {
                    // e.g. value 10 means 10% off
                    discountAmount = (amount * parseFloat(d.value)) / 100;
                } else {
                    // Fixed amount
                    discountAmount = parseFloat(d.value);
                }
                amount = Math.max(0, amount - discountAmount);
            }
        }

        const paymentData = {
            invoice_id: `INV-${Date.now()}`,
            email,
            phone_number: phone,
            amount: amount,
            status: 'pending',
            payment_method: 'payd',
            event_id: eventId,
            organizer_id: event.organizer_id,
            ticket_type_id: ticketId,
            metadata: {
                ticket_type_id: ticketId,
                quantity: quantity,
                customer_name: customerName,
                event_name: event.name
            }
        };

        // Insert Payment
        // Use direct insert keys
        const insertRes = await pool.query(
            `INSERT INTO payments (invoice_id, email, mobile_payment, amount, status, payment_method, event_id, organizer_id, ticket_type_id, metadata, whatsapp_number)
              VALUES ($1, $2, $3, $4, 'pending', 'payd', $5, $6, $7, $8, $9) RETURNING *`,
            [paymentData.invoice_id, email, phone, amount, eventId, event.organizer_id, ticketId, JSON.stringify(paymentData.metadata), phone]
        );
        const payment = insertRes.rows[0];

        // Call Payment Gateway
        const gwResult = await this.initiatePayment({ ...paymentData, firstName: customerName?.split(' ')[0], narrative: 'Ticket Purchase' });

        // Update Payment
        await pool.query("UPDATE payments SET provider_reference = $1, api_ref = $1 WHERE id = $2", [gwResult.reference, payment.id]);

        return { ...gwResult, paymentId: payment.id };
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
                const { rows: buyers } = await pool.query('SELECT * FROM buyers WHERE mobile_payment = $1 OR whatsapp_number = $1', [buyerMobilePayment]);
                if (buyers.length > 0) {
                    buyerId = buyers[0].id;
                    // If we found them in DB, we could prefer DB email if payload email is missing
                    if (!buyerEmail) buyerEmail = buyers[0].email;
                    if (!buyerWhatsApp) buyerWhatsApp = buyers[0].whatsapp_number;
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
                narrative: paymentData.metadata.narrative,
                billing_address: billingAddress // Add billing_address for Payd V3 requirements
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
