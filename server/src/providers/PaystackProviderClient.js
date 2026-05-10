import axios from 'axios';
import https from 'https';
import dns from 'node:dns';
import logger from '../shared/utils/logger.js';
import { PaymentStatus } from '../shared/constants/enums.js';
import {
    normalizePaystackChargePayload,
    normalizePaystackPaymentStatus
} from '../shared/utils/paystackPaymentNormalizer.js';

class PaystackProviderClient {
    constructor() {
        this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
        this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;

        if (!this.secretKey) {
            logger.error('[PAYSTACK-INIT] ERROR: PAYSTACK_SECRET_KEY must be set');
        }

        if (!this.baseUrl.startsWith('https://')) {
            logger.error('[PAYSTACK-INIT] ERROR: PAYSTACK_BASE_URL must use HTTPS');
        }

        try {
            dns.setDefaultResultOrder('ipv4first');
            const dnsServers = process.env.DNS_SERVERS ? process.env.DNS_SERVERS.split(',') : ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
            dns.setServers(dnsServers);
        } catch (error) {
            logger.warn('[PAYSTACK-INIT] DNS setup failed:', error.message);
        }

        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 30000,
            scheduling: 'lifo',
            rejectUnauthorized: true
        });

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Byblos/1.1 (Axios)'
            },
            timeout: 30000,
            httpsAgent: this.httpsAgent
        });

        logger.info(`PaystackProviderClient initialized with BaseURL: ${this.baseUrl}`);
    }

    getAuthHeader() {
        if (!this.secretKey) {
            throw new Error('Paystack secret key not configured');
        }
        return `Bearer ${this.secretKey}`;
    }

    normalizePhoneForCharge(phone) {
        if (!phone) throw new Error('Phone number is required for Paystack charge');

        let digits = phone.toString().replace(/\D/g, '');
        if (digits.startsWith('254') && digits.length === 12) {
            // already country-prefixed
        } else if (digits.startsWith('0') && digits.length === 10) {
            digits = `254${digits.substring(1)}`;
        } else if (digits.length === 9 && /^[17]/.test(digits)) {
            digits = `254${digits}`;
        } else {
            throw new Error(`Invalid phone number: "${phone}". Use a valid Kenyan number such as 0712345678 or +254712345678.`);
        }

        if (!/^254[17]\d{8}$/.test(digits)) {
            throw new Error(`Invalid Kenyan phone number for Paystack charge: "${phone}".`);
        }

        return `+${digits}`;
    }

    normalizePhoneForPayment(phone) {
        return this.normalizePhoneForCharge(phone);
    }

    normalizePaystackChargePayload(rawPayload = {}, explicitReference = null) {
        return normalizePaystackChargePayload(rawPayload, explicitReference);
    }

    async initiatePayment(paymentData = {}) {
        const startTime = Date.now();
        const {
            email,
            amount,
            invoice_id,
            phone,
            phone_number,
            narration,
            narrative,
            api_ref,
            metadata = {}
        } = paymentData;

        try {
            const reference = String(api_ref || invoice_id || '').trim();
            if (!reference) {
                throw new Error('Paystack charge reference is required');
            }

            const normalizedPhone = this.normalizePhoneForCharge(phone || phone_number);
            const paystackAmount = this._toPaystackAmount(amount);
            const chargeEmail = email || process.env.PAYSTACK_DEFAULT_EMAIL || 'payments@bybloshq.space';
            const payload = {
                email: chargeEmail,
                amount: paystackAmount,
                currency: 'KES',
                reference,
                mobile_money: {
                    phone: normalizedPhone,
                    provider: 'mpesa'
                },
                metadata: {
                    ...metadata,
                    api_ref: metadata.api_ref || api_ref || reference,
                    invoice_id: metadata.invoice_id || invoice_id || null,
                    narration: metadata.narration || narration || narrative || `Payment for ${invoice_id || reference}`
                }
            };

            logger.info('[PAYSTACK-PAYIN] Initiating M-Pesa charge', {
                invoice_id,
                reference,
                amount: Number.parseFloat(amount),
                paystack_amount: paystackAmount,
                phone: normalizedPhone,
                endpoint: `${this.baseUrl}/charge`
            });

            const response = await this._retryRequest(async () => {
                return this.client.post('/charge', payload, {
                    headers: {
                        Authorization: this.getAuthHeader(),
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    timeout: 30000
                });
            }, 1, 2000);

            const responseData = response.data || {};
            if (responseData.status === false) {
                throw new Error(responseData.message || 'Paystack charge request failed');
            }

            const normalized = this.normalizePaystackChargePayload(responseData, reference);
            const providerReference = normalized.reference || reference;
            if (!providerReference) {
                throw new Error('Paystack did not return a charge reference');
            }

            logger.info('[PAYSTACK-PAYIN] M-Pesa charge initiated', {
                duration: `${Date.now() - startTime}ms`,
                reference: providerReference,
                status: normalized.status,
                invoice_id
            });

            return {
                success: true,
                reference: providerReference,
                transaction_id: providerReference,
                status: normalized.status === PaymentStatus.PENDING ? PaymentStatus.PENDING : normalized.status,
                message: responseData.message || normalized.display_text || 'M-Pesa prompt sent to customer phone',
                original_response: responseData
            };
        } catch (error) {
            logger.error('[PAYSTACK-PAYIN] M-Pesa charge initiation failed', {
                duration: `${Date.now() - startTime}ms`,
                invoice_id,
                error: this._extractErrorDetails(error)
            });
            throw this._handlePaystackError(error);
        }
    }

    async checkTransactionStatus(reference) {
        try {
            if (!reference) throw new Error('Paystack transaction reference is required');

            logger.info('[PAYSTACK-STATUS] Verifying transaction', { reference });

            const response = await this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`, {
                headers: {
                    Authorization: this.getAuthHeader(),
                    Accept: 'application/json'
                },
                timeout: 30000
            });

            const normalized = this.normalizePaystackChargePayload(response.data, reference);

            logger.info('[PAYSTACK-STATUS] Transaction verification retrieved', {
                reference,
                status: normalized.status,
                amount: normalized.amount
            });

            return normalized;
        } catch (error) {
            logger.error('[PAYSTACK-STATUS] Transaction verification failed', {
                reference,
                error: this._extractErrorDetails(error)
            });
            throw this._handlePaystackError(error);
        }
    }

    async pollTransactionStatus(reference, options = {}) {
        const {
            maxAttempts = 60,
            intervalMs = 5000,
            finalStatuses = [
                PaymentStatus.COMPLETED,
                PaymentStatus.SUCCESS,
                PaymentStatus.PAID,
                PaymentStatus.FAILED,
                PaymentStatus.CANCELLED,
                PaymentStatus.COMPENSATION_REQUIRED,
                PaymentStatus.MANUAL_REVIEW_REQUIRED
            ]
        } = options;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const status = await this.checkTransactionStatus(reference);
            if (finalStatuses.includes(String(status.status || '').toLowerCase())) {
                return status;
            }
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        return {
            success: false,
            status: 'timeout',
            reference,
            message: `Paystack transaction verification timed out after ${maxAttempts} attempts`
        };
    }

    async checkBalance() {
        const response = await this.client.get('/balance', {
            headers: {
                Authorization: this.getAuthHeader(),
                Accept: 'application/json'
            },
            timeout: 15000
        });
        const balances = Array.isArray(response.data?.data) ? response.data.data : [];
        const kes = balances.find(balance => String(balance.currency || '').toUpperCase() === 'KES') || balances[0] || {};
        return {
            success: response.data?.status !== false,
            available_balance: this._fromPaystackAmount(kes.balance || 0),
            ledger_balance: this._fromPaystackAmount(kes.ledger_balance ?? kes.balance ?? 0),
            currency: kes.currency || 'KES',
            raw_response: response.data
        };
    }

    async hasSufficientBalance(requiredAmount, bufferPercent = 10) {
        const balance = await this.checkBalance();
        const available = Number.parseFloat(balance.available_balance || 0);
        const required = Number.parseFloat(requiredAmount) * (1 + bufferPercent / 100);
        return {
            sufficient: available >= required,
            available,
            required,
            buffer: bufferPercent
        };
    }

    getAgentStatus() {
        return {
            provider: 'paystack',
            maxSockets: this.httpsAgent.maxSockets,
            maxFreeSockets: this.httpsAgent.maxFreeSockets,
            sockets: Object.keys(this.httpsAgent.sockets || {}).length,
            freeSockets: Object.keys(this.httpsAgent.freeSockets || {}).length,
            requests: Object.keys(this.httpsAgent.requests || {}).length
        };
    }

    resetAgent() {
        this.httpsAgent.destroy();
        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 30000,
            scheduling: 'lifo',
            rejectUnauthorized: true
        });
        this.client.defaults.httpsAgent = this.httpsAgent;
        return this.getAgentStatus();
    }

    async getNetworkStatus() {
        const targets = [
            { name: 'google', host: 'google.com', url: 'https://google.com' },
            { name: 'paystack', host: 'api.paystack.co', url: `${this.baseUrl}/` }
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

    _toPaystackAmount(amount) {
        const numericAmount = Number.parseFloat(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new Error(`Invalid Paystack amount: ${amount}`);
        }
        return Math.round(numericAmount * 100);
    }

    _fromPaystackAmount(amountSubunit) {
        return Math.round(Number(amountSubunit)) / 100;
    }

    _normalizePaystackStatus(status) {
        return normalizePaystackPaymentStatus(status);
    }

    async _retryRequest(fn, retries = 1, delay = 1000) {
        let lastError;
        for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (!this._shouldRetry(error, attempt, retries)) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            }
        }
        throw lastError;
    }

    _shouldRetry(error, attempt, maxRetries) {
        if (attempt > maxRetries) return false;
        const retryableCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ECONNABORTED']);
        if (retryableCodes.has(error.code)) return true;
        return Boolean(error.response && error.response.status >= 500);
    }

    _getRetryReason(error) {
        if (error.code) return error.code;
        if (error.response?.status) return `HTTP_${error.response.status}`;
        return error.message || 'unknown_paystack_error';
    }

    _extractErrorDetails(error) {
        if (error.response) {
            return {
                type: 'http_error',
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            };
        }
        if (error.request) {
            return {
                type: 'no_response',
                message: error.message,
                code: error.code
            };
        }
        return {
            type: 'request_setup',
            message: error.message
        };
    }

    _handlePaystackError(error) {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.message || error.response.data?.error || error.message;
            const wrapped = new Error(message || 'Paystack request failed');
            wrapped.statusCode = status;
            wrapped.provider = 'paystack';
            wrapped.providerPayload = error.response.data;
            return wrapped;
        }

        const wrapped = new Error(error.message || 'Unknown Paystack error');
        wrapped.statusCode = error.code === 'ECONNABORTED' ? 504 : 500;
        wrapped.provider = 'paystack';
        wrapped.providerPayload = error;
        return wrapped;
    }
}

export default PaystackProviderClient;
