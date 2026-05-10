import axios from 'axios';
import crypto from 'node:crypto';
import https from 'https';
import logger from '../shared/utils/logger.js';
import {
    normalizePaystackTransferPayload,
    normalizePaystackTransferStatus
} from '../shared/utils/paystackTransferNormalizer.js';

class PaystackTransferClient {
    constructor() {
        this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Byblos/1.1 (Axios)'
            },
            timeout: 30000,
            httpsAgent: new https.Agent({
                keepAlive: true,
                rejectUnauthorized: true
            })
        });
    }

    getAuthHeader() {
        if (!this.secretKey) throw new Error('Paystack secret key not configured');
        return `Bearer ${this.secretKey}`;
    }

    normalizePhoneForTransfer(phone) {
        if (!phone) throw new Error('Phone number is required for transfer');
        let digits = phone.toString().replace(/\D/g, '');
        if (digits.startsWith('254') && digits.length === 12) {
            digits = `0${digits.slice(3)}`;
        } else if (digits.startsWith('0') && digits.length === 10) {
            // already in the local format Paystack expects for Kenya mobile money recipients
        } else if (digits.length === 9 && /^[17]/.test(digits)) {
            digits = `0${digits}`;
        } else {
            throw new Error(`Invalid Kenyan phone number for transfer: "${phone}".`);
        }

        if (!/^0[17]\d{8}$/.test(digits)) {
            throw new Error(`Invalid Kenyan phone number for transfer: "${phone}".`);
        }

        return digits;
    }

    async createTransferRecipient({ name, phoneNumber, currency = 'KES' }) {
        const normalizedCurrency = String(currency || 'KES').toUpperCase();
        if (normalizedCurrency !== 'KES') {
            throw new Error('Only KES M-Pesa wallet transfer recipients are supported in v1');
        }

        const accountNumber = this.normalizePhoneForTransfer(phoneNumber);
        const payload = {
            type: 'mobile_money',
            name: name || accountNumber,
            account_number: accountNumber,
            bank_code: 'MPESA',
            currency: normalizedCurrency
        };

        const response = await this.client.post('/transferrecipient', payload, {
            headers: { Authorization: this.getAuthHeader() }
        });

        const data = response.data?.data || response.data || {};
        const recipientCode = data.recipient_code || data.recipientCode;
        if (!recipientCode) {
            throw new Error(response.data?.message || 'Paystack did not return a transfer recipient code');
        }
        return { ...data, recipient_code: recipientCode };
    }

    async initiateTransfer({ amount, phoneNumber, name, narration, reference, currency = 'KES' }) {
        const validatedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(validatedAmount) || validatedAmount <= 0) {
            throw new Error('Invalid transfer amount');
        }

        const normalizedCurrency = String(currency || 'KES').toUpperCase();
        if (normalizedCurrency !== 'KES') {
            throw new Error('Only KES M-Pesa wallet transfers are supported in v1');
        }

        const recipient = await this.createTransferRecipient({ name, phoneNumber, currency: normalizedCurrency });
        const paystackAmount = this._toPaystackAmount(validatedAmount);
        const transferReference = this.normalizeTransferReference(reference);
        const payload = {
            source: 'balance',
            amount: paystackAmount,
            recipient: recipient.recipient_code,
            reason: narration || 'Byblos seller withdrawal',
            reference: transferReference,
            currency: normalizedCurrency
        };

        logger.info('[PAYSTACK-TRANSFER] Initiating transfer', {
            reference: transferReference,
            amount: validatedAmount,
            recipient: recipient.recipient_code
        });

        const response = await this.client.post('/transfer', payload, {
            headers: { Authorization: this.getAuthHeader() }
        });

        return this.normalizePaystackTransferPayload(response.data, transferReference);
    }

    async verifyTransfer(reference) {
        if (!reference) throw new Error('Transfer reference is required');
        const response = await this.client.get(`/transfer/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: this.getAuthHeader() }
        });
        return this.normalizePaystackTransferPayload(response.data, reference);
    }

    async checkBalance() {
        const response = await this.client.get('/balance', {
            headers: { Authorization: this.getAuthHeader() }
        });
        const balances = response.data?.data || [];
        const kes = Array.isArray(balances)
            ? balances.find(row => String(row.currency || '').toUpperCase() === 'KES') || balances[0] || {}
            : balances;
        return {
            currency: kes.currency || 'KES',
            available_balance: this._fromPaystackAmount(kes.balance || 0),
            ledger_balance: this._fromPaystackAmount(kes.ledger_balance ?? kes.balance ?? 0),
            raw_response: response.data
        };
    }

    normalizePaystackTransferPayload(rawPayload = {}, explicitReference = null) {
        return normalizePaystackTransferPayload(rawPayload, explicitReference);
    }

    normalizeTransferPayload(rawPayload = {}, explicitReference = null) {
        return this.normalizePaystackTransferPayload(rawPayload, explicitReference);
    }

    normalizeTransferReference(reference) {
        const raw = String(reference || `byblos-transfer-${crypto.randomUUID()}`).trim();
        let normalized = raw
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[-_]+|[-_]+$/g, '');

        if (normalized.length >= 16 && normalized.length <= 50) {
            return normalized;
        }

        const suffix = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
        const base = normalized || 'byblos-transfer';
        const maxBaseLength = 50 - suffix.length - 1;
        normalized = `${base.slice(0, maxBaseLength).replace(/[-_]+$/g, '')}-${suffix}`;

        if (normalized.length < 16) {
            return `byblos-transfer-${suffix}`.slice(0, 50);
        }

        return normalized;
    }

    _toPaystackAmount(amount) {
        const parsed = Number.parseFloat(amount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error(`Invalid Paystack transfer amount: ${amount}`);
        }
        return Math.round(parsed * 100);
    }

    _fromPaystackAmount(amountSubunit) {
        const parsed = Number.parseFloat(amountSubunit);
        return Number.isFinite(parsed) ? Math.round(parsed) / 100 : parsed;
    }

    _normalizeTransferStatus(status) {
        return normalizePaystackTransferStatus({ status });
    }
}

export default PaystackTransferClient;
