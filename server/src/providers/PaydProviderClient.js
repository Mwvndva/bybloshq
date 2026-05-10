import axios from 'axios';
import https from 'https';
import fs from 'node:fs';
import dns from 'node:dns';
import logger from '../shared/utils/logger.js';
import { PaydError, PaydErrorCodes } from '../shared/utils/PaydError.js';
import { normalizeProviderAmount, normalizeProviderPaymentStatus } from '../shared/utils/paymentStatusNormalizer.js';

class PaydProviderClient {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.payd.money/api/v2';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;
        this.payloadUsername = process.env.PAYD_PAYLOAD_USERNAME || 'mwxndx';

        if (!this.username || !this.password) {
            logger.error('[PAYD-INIT] ERROR: PAYD_USERNAME and PAYD_PASSWORD must be set');
        }

        if (!this.baseUrl.startsWith('https://')) {
            logger.error('[PAYD-INIT] ERROR: PAYD_BASE_URL must use HTTPS');
        }

        try {
            dns.setDefaultResultOrder('ipv4first');
            const dnsServers = process.env.DNS_SERVERS ? process.env.DNS_SERVERS.split(',') : ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
            dns.setServers(dnsServers);
        } catch (error) {
            logger.warn('[PAYD-INIT] DNS cache setup failed:', error.message);
        }

        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 25000,
            scheduling: 'lifo',
            rejectUnauthorized: true,
            ca: process.env.PAYD_CA_CERT_PATH ? fs.readFileSync(process.env.PAYD_CA_CERT_PATH) : undefined
        });

        this.httpsAgent.on('free', (socket) => {
            if (socket.destroyed) return;
            const age = Date.now() - (socket._creationTime || Date.now());
            if (age > 60000) {
                logger.debug('[HTTPS-AGENT] Destroying stale socket (age > 60s)');
                socket.destroy();
            }
        });

        this.httpsAgent.on('connect', (socket) => {
            socket._creationTime = Date.now();
        });

        this.httpsAgent.on('error', (error) => {
            logger.error('[HTTPS-AGENT] Agent error:', error);
        });

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Byblos/1.1 (Axios)',
            },
            timeout: 30000,
            httpsAgent: this.httpsAgent
        });

        logger.info(`PaydProviderClient initialized with BaseURL: ${this.baseUrl}`);
    }

    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd credentials not configured');
        }
        return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }

    normalizePhoneForPayment(phone) {
        if (!phone) throw new PaydError('Phone number is required', PaydErrorCodes.INVALID_PHONE, 400);
        let digits = phone.toString().replace(/\D/g, '');

        if (digits.startsWith('254') && digits.length === 12) {
            digits = `0${digits.substring(3)}`;
        } else if (digits.length === 9) {
            digits = `0${digits}`;
        } else if (digits.startsWith('0') && digits.length === 10) {
            // already normalized
        } else {
            throw new PaydError(
                `Invalid phone number: "${phone}". Must be a valid Kenyan number (e.g. 0712345678)`,
                PaydErrorCodes.INVALID_PHONE,
                400
            );
        }

        if (!/^0\d{9}$/.test(digits)) {
            throw new PaydError(
                `Invalid phone number format: "${phone}". Must be 10 digits starting with 0 (e.g. 0712345678)`,
                PaydErrorCodes.INVALID_PHONE,
                400
            );
        }

        return digits;
    }

    normalizePaydPayload(rawPayload = {}, transactionId = null) {
        const root = rawPayload || {};
        const details = root.data || root;
        const { rawAmount, amount } = normalizeProviderAmount(root);

        return {
            success: true,
            transaction_id: transactionId || details.transaction_reference || root.transaction_reference || details.api_ref || root.api_ref || null,
            status: normalizeProviderPaymentStatus(root),
            amount,
            raw_amount: rawAmount,
            phone_number: details.payer || details.recipient || details.phone_number || root.phone_number,
            narration: details.reason || details.narration || root.narration,
            created_at: root.created_at || details.created_at,
            raw_response: root,
            ...details,
            data: details
        };
    }

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
                api_ref,
                callback_url
            } = paymentData;

            const numericAmount = Number.parseFloat(amount);
            if (numericAmount < 10) {
                throw new PaydError(
                    `Minimum transaction amount is 10 KES. Requested: ${numericAmount} KES.`,
                    PaydErrorCodes.INVALID_AMOUNT,
                    400
                );
            }

            if (!this.username || !this.password) {
                throw new PaydError('Payd credentials not configured', PaydErrorCodes.CONFIG_ERROR);
            }

            const balance = await this.checkBalance();
            if (balance) {
                logger.info('[PAYD-PAYIN] Platform balance check', {
                    available: balance.available_balance,
                    required: amount
                });
                if (Number.parseFloat(balance.available_balance) < numericAmount * 1.1) {
                    logger.warn('[PAYD-PAYIN] Low platform balance', {
                        available: balance.available_balance,
                        required: amount
                    });
                }
            }

            const normalizedPhone = this.normalizePhoneForPayment(phone);
            const callbackUrl = callback_url || process.env.PAYD_CALLBACK_URL ||
                (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/payments/webhook/payd` :
                    'https://bybloshq.space/api/payments/webhook/payd');

            const payload = {
                username: this.payloadUsername,
                channel: 'MPESA',
                amount: numericAmount,
                phone_number: normalizedPhone,
                narration: narration || narrative || `Payment for ${invoice_id}`,
                currency: 'KES',
                api_ref,
                callback_url: callbackUrl,
            };

            logger.info('[PAYD-PAYIN] Initiating payment', {
                invoice_id,
                email,
                amount: payload.amount,
                phone: normalizedPhone,
                endpoint: `${this.baseUrl}/payments`
            });

            const response = await this._retryRequest(async () => {
                return this.client.post('/payments', payload, {
                    headers: {
                        Authorization: this.getAuthHeader(),
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        Connection: 'keep-alive',
                    },
                    timeout: 30000,
                });
            }, 1, 2000);

            const responseData = response.data;
            const reference = responseData.transaction_reference;

            if (!reference) {
                logger.error('[PAYD-PAYIN] No transaction_reference in response', { invoice_id, raw: responseData });
                throw new PaydError(
                    'Payd did not return a transaction_reference. Payment request may still be processing — check webhook.',
                    PaydErrorCodes.TRANSACTION_FAILED,
                    500
                );
            }

            logger.info('[PAYD-PAYIN] Payment initiated successfully', {
                duration: `${Date.now() - startTime}ms`,
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
                original_response: responseData
            };
        } catch (error) {
            logger.error('[PAYD-PAYIN] Payment initiation failed — detailed diagnostics:', {
                duration: `${Date.now() - startTime}ms`,
                invoice_id: paymentData.invoice_id,
                errorCode: error.code,
                errorMessage: error.message,
                isAxiosError: !!error.isAxiosError,
                hasResponse: !!error.response,
                responseStatus: error.response?.status,
                responseData: error.response?.data ? JSON.stringify(error.response.data) : null,
                isTimeout: error.code === 'ECONNABORTED' || error.message?.includes('timeout'),
                isConnRefused: error.code === 'ECONNREFUSED',
                isConnReset: error.code === 'ECONNRESET',
                isDNSFail: error.code === 'ENOTFOUND',
            });
            throw this._handlePaydError(error);
        }
    }

    async checkTransactionStatus(transactionId) {
        try {
            logger.info('[PAYD-STATUS] Checking transaction status', { transaction_id: transactionId });

            const response = await this.client.get(`/payments/${transactionId}`, {
                headers: {
                    Authorization: this.getAuthHeader(),
                    Accept: 'application/json'
                }
            });

            const normalized = this.normalizePaydPayload(response.data, transactionId);

            logger.info('[PAYD-STATUS] Status retrieved', {
                transaction_id: transactionId,
                status: normalized.status,
                amount: normalized.raw_amount ?? normalized.amount
            });

            return normalized;
        } catch (error) {
            logger.error('[PAYD-STATUS] Status check failed', {
                transaction_id: transactionId,
                error: this._extractErrorDetails(error)
            });
            throw this._handlePaydError(error);
        }
    }

    async pollTransactionStatus(transactionId, options = {}) {
        const {
            maxAttempts = 60,
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
                logger.info('[PAYD-POLL] Poll attempt', { attempt, status: status.status, transaction_id: transactionId });

                if (finalStatuses.includes(status.status.toLowerCase())) {
                    logger.info('[PAYD-POLL] Final status reached', { status: status.status, attempts: attempt });
                    return status;
                }

                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }
            } catch (error) {
                logger.error('[PAYD-POLL] Poll attempt failed', {
                    attempt,
                    transaction_id: transactionId,
                    error: error.message
                });

                if (error.statusCode === 404) throw error;
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }
            }
        }

        logger.warn('[PAYD-POLL] Polling timeout', { transaction_id: transactionId, attempts: maxAttempts });
        return {
            success: false,
            status: 'timeout',
            message: `Transaction status polling timed out after ${maxAttempts} attempts`
        };
    }

    async checkBalance() {
        try {
            logger.info('[PAYD-BALANCE] Checking platform balance');

            const response = await this.client.get(`/accounts/${this.username}/all_balances`, {
                baseURL: 'https://api.payd.money/api/v1',
                timeout: 5000,
                headers: {
                    Authorization: this.getAuthHeader(),
                    Accept: 'application/json'
                }
            });

            const fiat = response.data.fiat_balance || {};
            logger.info('[PAYD-BALANCE] Balance retrieved', {
                available: fiat.balance,
                currency: fiat.currency
            });

            return {
                success: true,
                available_balance: fiat.balance,
                ledger_balance: fiat.balance,
                currency: fiat.currency || 'KES',
                last_updated: new Date().toISOString(),
                raw_response: response.data
            };
        } catch (error) {
            logger.warn('[PAYD-BALANCE] Balance check failed (non-critical, skipping)', {
                error: error.message || error.code
            });
            return null;
        }
    }

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

    getAgentStatus() {
        return {
            maxSockets: this.httpsAgent.maxSockets,
            maxFreeSockets: this.httpsAgent.maxFreeSockets,
            sockets: Object.keys(this.httpsAgent.sockets || {}).length,
            freeSockets: Object.keys(this.httpsAgent.freeSockets || {}).length,
            requests: Object.keys(this.httpsAgent.requests || {}).length
        };
    }

    resetAgent() {
        logger.warn('[HTTPS-AGENT] Resetting agent due to connection issues');
        this.httpsAgent.destroy();

        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 90000,
            scheduling: 'lifo',
            family: 4,
            rejectUnauthorized: true,
            ca: process.env.PAYD_CA_CERT_PATH ? fs.readFileSync(process.env.PAYD_CA_CERT_PATH) : undefined
        });

        this.client.defaults.httpsAgent = this.httpsAgent;
        logger.info('[HTTPS-AGENT] Agent reset complete');
    }

    async getNetworkStatus() {
        const targets = [
            { name: 'google', host: 'google.com', url: 'https://google.com' },
            { name: 'payd', host: 'api.payd.money', url: `${this.baseUrl}/payments` }
        ];

        const results = {};
        for (const target of targets) {
            const result = { dns: 'unknown', https: 'unknown' };
            try {
                const lookup = await new Promise((resolve, reject) => {
                    dns.lookup(target.host, (err, address) => {
                        if (err) reject(err);
                        else resolve(address);
                    });
                });
                result.dns = `ok (${lookup})`;
            } catch (error) {
                result.dns = `failed (${error.code || error.message})`;
            }

            try {
                const startTime = Date.now();
                await axios.get(target.url, { timeout: 5000, validateStatus: () => true });
                result.https = `ok (${Date.now() - startTime}ms)`;
            } catch (error) {
                result.https = `failed (${error.code || error.message})`;
            }
            results[target.name] = result;
        }
        return results;
    }

    async _retryRequest(fn, retries = 3, delay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                if (attempt > 1) logger.info(`[RETRY] Attempt ${attempt}/${retries + 1}`);
                const result = await fn();
                if (attempt > 1) logger.info(`[RETRY] Succeeded on attempt ${attempt}`);
                return result;
            } catch (error) {
                lastError = error;
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
        if (attempt > maxRetries) return false;
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
        if (networkErrors.some(err => error.code === err || error.message?.includes(err))) return true;
        if (error.response && error.response.status >= 500) return true;
        if (error.response && error.response.status >= 400 && error.response.status < 500) return false;
        return false;
    }

    _getRetryReason(error) {
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return 'Client error (4xx) - not retryable';
        }
        return 'Unknown or terminal error type';
    }

    _extractErrorDetails(error) {
        if (error.response) {
            return {
                type: 'http_error',
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            };
        }
        if (error.request) {
            return {
                type: 'no_response',
                message: error.message,
                code: error.code,
                timeout: error.code === 'ECONNABORTED'
            };
        }
        return {
            type: 'request_setup',
            message: error.message
        };
    }

    _handlePaydError(error) {
        if (error instanceof PaydError) return error;

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 401 || status === 403) {
                return new PaydError('Authentication failed. Please check Payd credentials.', PaydErrorCodes.AUTHENTICATION_FAILED, 401, { original: data });
            }

            if (status === 404) {
                return new PaydError('Transaction not found', PaydErrorCodes.TRANSACTION_NOT_FOUND, 404, { original: data });
            }

            if (status === 409) {
                return new PaydError('Duplicate transaction detected', PaydErrorCodes.DUPLICATE_TRANSACTION, 409, { original: data });
            }

            if (status >= 400 && status < 500) {
                return new PaydError(data.message || 'Bad request to Payd API', PaydErrorCodes.TRANSACTION_FAILED, status, { original: data });
            }

            if (status >= 500) {
                return new PaydError('Payd service temporarily unavailable', PaydErrorCodes.CONNECTION_FAILED, 503, { original: data });
            }
        }

        if (error.code === 'ECONNRESET' || error.message === 'socket hang up') {
            return new PaydError('Connection to Payd failed. Please try again.', PaydErrorCodes.CONNECTION_FAILED, 503, { code: error.code });
        }

        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return new PaydError('Request to Payd timed out. Please try again.', PaydErrorCodes.TIMEOUT, 504, { code: error.code });
        }

        return new PaydError(error.message || 'Unknown Payd error occurred', PaydErrorCodes.UNKNOWN_ERROR, 500, { original: error });
    }
}

export default PaydProviderClient;
