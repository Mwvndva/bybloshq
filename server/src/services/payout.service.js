import axios from 'axios';
import https from 'https';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';

/**
 * PayoutService — Payd Kenya M-Pesa Payouts
 * 
 * API: POST https://api.payd.money/api/v2/withdrawal
 * Auth: HTTP Basic Auth (username:password)
 * Docs: https://magic.payd.money/kenya-payouts
 */
class PayoutService {
    constructor() {
        // Separate base URL for payouts (v2) vs payments (v3)
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
                rejectUnauthorized: false, // Keep until production SSL confirmed
                keepAlive: true,
                family: 4 // Force IPv4
            })
        });

        logger.info(`[PayoutService] Initialized. Base URL: ${this.baseUrl}`);
    }

    /**
     * Build Basic Auth header
     */
    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd payout credentials (PAYD_USERNAME, PAYD_PASSWORD) not configured');
        }
        return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }

    /**
     * Get payout callback URL
     * SEPARATE from payment callback — uses /api/callbacks/payd-payout
     */
    getCallbackUrl() {
        if (process.env.PAYD_PAYOUT_CALLBACK_URL) {
            return process.env.PAYD_PAYOUT_CALLBACK_URL;
        }
        const base = process.env.BACKEND_URL || 'https://bybloshq.space';
        return `${base}/api/callbacks/payd-payout`;
    }

    /**
     * Normalize phone number for PAYOUT API
     * 
     * Payd payout API requires 0XXXXXXXXX format (10 digits, starts with 0)
     * This is DIFFERENT from the payment (STK push) API which uses 254XXXXXXXXX
     * 
     * @param {string|number} phone
     * @returns {string} e.g. "0712345678"
     */
    normalizePhoneForPayout(phone) {
        let digits = phone.toString().replace(/\D/g, '');

        // Strip country code if present
        if (digits.startsWith('254') && digits.length === 12) {
            digits = '0' + digits.substring(3);
        } else if (digits.startsWith('+254')) {
            digits = '0' + digits.substring(4);
        } else if (digits.length === 9) {
            // Bare 9-digit number e.g. 712345678
            digits = '0' + digits;
        }

        if (!digits.startsWith('0') || digits.length !== 10) {
            throw new Error(
                `Invalid phone number format: "${phone}". ` +
                `Payout requires a 10-digit Kenyan number starting with 0 (e.g. 0712345678)`
            );
        }

        return digits;
    }

    /**
     * Validate withdrawal amount against Payd limits
     * @param {number} amount
     * @returns {number} validated amount
     */
    validateAmount(amount) {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            throw new Error('Invalid withdrawal amount');
        }
        if (parsed < Fees.MIN_WITHDRAWAL_AMOUNT) {
            throw new Error(`Minimum withdrawal amount is KES ${Fees.MIN_WITHDRAWAL_AMOUNT}`);
        }
        if (parsed > Fees.MAX_WITHDRAWAL_AMOUNT) {
            throw new Error(`Maximum withdrawal amount is KES ${Fees.MAX_WITHDRAWAL_AMOUNT.toLocaleString()}`);
        }
        return parsed;
    }

    /**
     * Initiate a Kenya M-Pesa payout via Payd
     * 
     * @param {Object} params
     * @param {string} params.phone_number - Raw phone (will be normalized)
     * @param {number} params.amount - Amount in KES
     * @param {string} params.narration - Description shown to recipient
     * @returns {Promise<{correlator_id: string, message: string, status: string}>}
     */
    async initiatePayout({ phone_number, amount, narration }) {
        const validatedAmount = this.validateAmount(amount);
        const normalizedPhone = this.normalizePhoneForPayout(phone_number);
        const callbackUrl = this.getCallbackUrl();

        const payload = {
            phone_number: normalizedPhone,
            amount: validatedAmount,
            narration: narration || 'Withdrawal request',
            callback_url: callbackUrl,
            channel: 'MPESA',
            currency: 'KES'
        };

        logger.info('[PayoutService] Initiating payout', {
            phone: normalizedPhone,
            amount: validatedAmount,
            callbackUrl
        });

        try {
            const response = await this.client.post('/withdrawal', payload, {
                headers: { Authorization: this.getAuthHeader() }
            });

            const data = response.data;
            logger.info('[PayoutService] Payout accepted by Payd', {
                correlatorId: data.correlator_id,
                status: data.status
            });

            return data; // { success, correlator_id, message, status }

        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Payout initiation failed';
            logger.error('[PayoutService] Payout initiation failed', {
                status: error.response?.status,
                message: msg,
                payload
            });
            throw new Error(msg);
        }
    }

    /**
     * Refund a failed withdrawal back to the entity's wallet balance.
     * Called inside a DB transaction.
     * 
     * @param {Object} client - Active DB transaction client
     * @param {Object} request - withdrawal_requests row
     * @returns {Promise<number|null>} newBalance
     */
    async refundToWallet(client, request) {
        const amount = parseFloat(request.amount);
        let newBalance = null;

        if (request.seller_id) {
            const { rows } = await client.query(
                'UPDATE sellers SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
                [amount, request.seller_id]
            );
            newBalance = parseFloat(rows[0]?.balance ?? 0);
            logger.info(`[PayoutService] Refunded KES ${amount} to seller ${request.seller_id}. New balance: ${newBalance}`);

        } else if (request.event_id) {
            // For event withdrawals: refund the gross deducted amount (amount + fee)
            const feeRate = 0.06;
            const grossAmount = amount / (1 - feeRate);
            const { rows } = await client.query(
                'UPDATE events SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                [grossAmount, request.event_id]
            );
            newBalance = parseFloat(rows[0]?.balance ?? 0);
            logger.info(`[PayoutService] Refunded KES ${grossAmount} (gross) to event ${request.event_id}`);

        } else if (request.organizer_id) {
            const { rows } = await client.query(
                'UPDATE organizers SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
                [amount, request.organizer_id]
            );
            newBalance = parseFloat(rows[0]?.balance ?? 0);
            logger.info(`[PayoutService] Refunded KES ${amount} to organizer ${request.organizer_id}. New balance: ${newBalance}`);

        } else {
            logger.error('[PayoutService] Cannot refund: no entity_id on request', request);
        }

        return newBalance;
    }
}

export default new PayoutService();
