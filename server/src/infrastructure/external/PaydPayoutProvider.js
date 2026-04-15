import axios from 'axios';
import https from 'https';
import logger from '../../utils/logger.js';
import { PaydError, PaydErrorCodes } from '../../utils/PaydError.js';
import Fees from '../../config/fees.js';

export class PaydPayoutProvider {
    constructor() {
        this.baseUrl = process.env.PAYD_PAYOUT_BASE_URL || 'https://api.payd.money/api/v2';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ByblosHQ/2.0 (Node.js)'
            },
            timeout: 30000,
            httpsAgent: new https.Agent({
                rejectUnauthorized: true,
                keepAlive: true,
                family: 4
            })
        });
    }

    async initiatePayout(data) {
        const { phone, amount, narration, callbackUrl } = data;
        const validatedAmount = this.validateAmount(amount);
        const normalizedPhone = this.normalizePhone(phone);

        const payload = {
            phone_number: normalizedPhone,
            amount: validatedAmount,
            narration: narration || 'Payout from ByblosHQ',
            callback_url: callbackUrl,
            channel: 'MPESA',
            currency: 'KES'
        };

        try {
            const response = await this._retryRequest(() => {
                return this.client.post('/withdrawal', payload, {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Accept': 'application/json'
                    }
                });
            });

            const reference = response.data.correlator_id || response.data.transaction_reference;

            return {
                success: true,
                reference,
                status: response.data.status || 'processing',
                originalResponse: response.data
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async checkBalance() {
        try {
            const response = await this.client.get(`/accounts/${this.username}/all_balances`, {
                baseURL: 'https://api.payd.money/api/v1',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });
            const fiat = response.data.fiat_balance || {};
            return {
                available: fiat.balance,
                currency: fiat.currency || 'KES'
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async checkPayoutStatus(reference) {
        // Placeholder for future background payout checks
        return { status: 'unknown', reference };
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
            throw new Error(`Invalid phone number: ${phone}`);
        }
        return digits;
    }

    validateAmount(amount) {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) throw new Error('Invalid amount');
        if (parsed < Fees.MIN_WITHDRAWAL_AMOUNT) throw new Error(`Minimum withdrawal is KES ${Fees.MIN_WITHDRAWAL_AMOUNT}`);
        if (parsed > Fees.MAX_WITHDRAWAL_AMOUNT) throw new Error(`Maximum withdrawal is KES ${Fees.MAX_WITHDRAWAL_AMOUNT}`);
        return parsed;
    }

    async _retryRequest(fn, retries = 3, delay = 1000) {
        let lastError;
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (error.response?.status >= 400 && error.response?.status < 500) throw error;
                if (i < retries) await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
            }
        }
        throw lastError;
    }

    handleError(error) {
        if (error.response) {
            return new PaydError(error.response.data.message || 'Payd API Error', PaydErrorCodes.TRANSACTION_FAILED, error.response.status, error.response.data);
        }
        return error;
    }
}
