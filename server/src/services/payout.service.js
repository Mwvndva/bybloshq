import axios from 'axios';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';

import https from 'https';

class PayoutService {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v2';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;
        this.networkCode = process.env.PAYD_NETWORK_CODE;
        this.channelId = process.env.PAYD_CHANNEL_ID;

        // Create axios instance
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ByblosHQ/1.0 (Node.js)'
            },
            timeout: 30000,
            // Ensure connection stability
            httpsAgent: new https.Agent({
                keepAlive: true,
                family: 4, // Force IPv4
                // SSL verification is enabled by default - DO NOT DISABLE
            })
        });
    }

    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd credentials not configured');
        }
        const authString = `${this.username}:${this.password}`;
        return `Basic ${Buffer.from(authString).toString('base64')}`;
    }

    async getCallbackUrl() {
        if (process.env.PAYD_CALLBACK_URL) {
            return process.env.PAYD_CALLBACK_URL;
        }

        if (process.env.NODE_ENV === 'development') {
            try {
                // Try to fetch current ngrok URL
                const response = await axios.get('http://localhost:4040/api/tunnels');
                const tunnel = response.data.tunnels.find(t => t.proto === 'https');
                if (tunnel?.public_url) {
                    logger.info(`Using dynamic ngrok URL: ${tunnel.public_url}`);
                    return `${tunnel.public_url}/api/callbacks/payd`;
                }
            } catch (error) {
                logger.warn('Failed to fetch ngrok URL:', error.message);
            }
        }

        // Fallback for production or failed ngrok fetch
        const baseUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'https://bybloshq.space';
        return `${baseUrl}/api/callbacks/payd`;
    }

    /**
     * Normalize phone number to 254 format
     * @param {string|number} phone 
     * @returns {string}
     */
    normalizePhoneNumber(phone) {
        let normalized = phone.toString().replace(/\D/g, '');
        if (normalized.startsWith('0')) {
            normalized = `254${normalized.substring(1)}`;
        } else if (normalized.startsWith('+254')) {
            normalized = normalized.substring(1);
        } else if (normalized.length === 9) {
            normalized = `254${normalized}`;
        }
        return normalized;
    }

    /**
     * Validate withdrawal amount against platform limits
     * @param {number} amount 
     */
    validateWithdrawal(amount) {
        const withdrawalAmount = parseFloat(amount);
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            throw new Error('Invalid withdrawal amount');
        }

        if (withdrawalAmount < Fees.MIN_WITHDRAWAL_AMOUNT) {
            throw new Error(`Minimum withdrawal amount is KES ${Fees.MIN_WITHDRAWAL_AMOUNT}`);
        }

        if (withdrawalAmount > Fees.MAX_WITHDRAWAL_AMOUNT) {
            throw new Error(`Maximum withdrawal amount is KES ${Fees.MAX_WITHDRAWAL_AMOUNT}`);
        }

        return withdrawalAmount;
    }

    async initiateMobilePayout(payoutData) {
        try {
            let { amount, phone_number, narration } = payoutData;

            // 1. Validate and Normalize
            amount = this.validateWithdrawal(amount);
            phone_number = this.normalizePhoneNumber(phone_number);

            const callbackUrl = await this.getCallbackUrl();
            logger.info(`Initiating Payd V2 Payout to ${phone_number}. Callback URL: ${callbackUrl}`);

            // Simplified V2 payload as per documentation
            const payload = {
                phone_number: phone_number,
                amount: parseFloat(amount),
                narration: narration || "Withdrawal request",
                callback_url: callbackUrl,
                channel: "MPESA"
            };

            const response = await this.client.post('/withdrawal', payload, {
                headers: { Authorization: this.getAuthHeader() }
            });

            logger.info(`Payd Response Status: ${response.status}`);
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Payout initialization failed';
            logger.error('Payd Payout Error:', errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Check the status of a payout with Payd
     * @param {string} providerRef 
     */
    async checkPayoutStatus(providerRef) {
        try {
            if (!providerRef) throw new Error('Provider reference is required');

            const response = await this.client.get(`/withdrawal/${providerRef}`, {
                headers: { Authorization: this.getAuthHeader() }
            });

            logger.info(`Payd Status Check for ${providerRef}: ${response.status}`);
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Payout status check failed';
            logger.error(`Payd Status Check Error (${providerRef}):`, errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Process a refund for a failed withdrawal request
     * @param {Object} client - DB client for transaction support
     * @param {Object} request - The withdrawal request record
     * @returns {Promise<number>} New balance
     */
    async processRefund(client, request) {
        let newBalance = null;
        let table = '';
        let entityId = null;
        const amount = parseFloat(request.amount);

        if (request.event_id) {
            const feePercentage = 0.06;
            const grossRefund = amount / (1 - feePercentage);
            const { rows } = await client.query(
                'UPDATE events SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                [grossRefund, request.event_id]
            );
            newBalance = rows[0]?.balance;
            table = 'events';
            entityId = request.event_id;
        } else if (request.seller_id) {
            const { rows } = await client.query(
                'UPDATE sellers SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                [amount, request.seller_id]
            );
            newBalance = rows[0]?.balance;
            table = 'sellers';
            entityId = request.seller_id;
        } else if (request.organizer_id) {
            const { rows } = await client.query(
                'UPDATE organizers SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                [amount, request.organizer_id]
            );
            newBalance = rows[0]?.balance;
            table = 'organizers';
            entityId = request.organizer_id;
        }

        if (newBalance !== null) {
            logger.info(`[PayoutService] Refund Successful. Entity: ${table}(${entityId}), Amount: ${amount}, New Balance: ${newBalance}`);
        } else {
            logger.warn(`[PayoutService] Refund failed or entity not recognized for request ${request.id}`);
        }

        return newBalance;
    }
}

export default new PayoutService();
