import axios from 'axios';
import https from 'https';
import fs from 'node:fs';
import dns from 'node:dns';
import logger from '../../utils/logger.js';
import { PaydError, PaydErrorCodes } from '../../utils/PaydError.js';

export class PaydPaymentProvider {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.payd.money/api/v2';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;
        this.payloadUsername = process.env.PAYD_PAYLOAD_USERNAME || 'mwxndx';

        // Set DNS cache for reliability
        try {
            dns.setDefaultResultOrder('ipv4first');
            const dnsServers = process.env.DNS_SERVERS ? process.env.DNS_SERVERS.split(',') : ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
            dns.setServers(dnsServers);
        } catch (e) {
            logger.warn('[PaydPaymentProvider] DNS cache setup failed:', e.message);
        }

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

    async initiateSTKPush(data) {
        const { amount, phone, invoiceId, callbackUrl } = data;
        const normalizedPhone = this.normalizePhone(phone);

        const payload = {
            username: this.payloadUsername,
            channel: "MPESA",
            amount: parseFloat(amount),
            phone_number: normalizedPhone,
            narration: `Payment for ${invoiceId}`,
            currency: "KES",
            callback_url: callbackUrl,
        };

        try {
            const response = await this._retryRequest(() => {
                return this.client.post('/payments', payload, {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Accept': 'application/json'
                    }
                });
            });

            return {
                success: true,
                reference: response.data.transaction_reference,
                originalResponse: response.data
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async checkTransactionStatus(reference) {
        try {
            const response = await this.client.get(`/payments/${reference}`, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async checkPaymentStatus(reference) {
        const data = await this.checkTransactionStatus(reference);
        const isCompleted = data.status === 'success' || data.status === 'completed';

        return {
            isCompleted,
            status: data.status,
            callbackData: {
                transaction_reference: reference,
                status: data.status,
                message: data.message || 'Status check'
            }
        };
    }

    getAuthHeader() {
        const authString = `${this.username}:${this.password}`;
        return `Basic ${Buffer.from(authString).toString('base64')}`;
    }

    normalizePhone(phone) {
        let digits = phone.toString().replace(/\D/g, '');
        if (digits.startsWith('254') && digits.length === 12) {
            digits = '0' + digits.substring(3);
        } else if (digits.length === 9) {
            digits = '0' + digits;
        }

        if (!/^0[17]\d{8}$/.test(digits)) {
            throw new PaydError(`Invalid phone number: ${phone}`, PaydErrorCodes.INVALID_PHONE, 400);
        }
        return digits;
    }

    async _retryRequest(fn, retries = 3, delay = 1000) {
        let lastError;
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (!this.shouldRetry(error, i, retries)) throw error;
                await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
            }
        }
        throw lastError;
    }

    shouldRetry(error, attempt, max) {
        if (attempt >= max) return false;
        if (error.response && error.response.status >= 400 && error.response.status < 500) return false;
        return true;
    }

    handleError(error) {
        if (error.response) {
            return new PaydError(error.response.data.message || 'Payd API Error', PaydErrorCodes.TRANSACTION_FAILED, error.response.status, error.response.data);
        }
        return error;
    }
}
