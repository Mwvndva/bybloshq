import axios from 'axios';
import logger from '../utils/logger.js';

class PayoutService {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v3';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;
        this.networkCode = process.env.PAYD_NETWORK_CODE;
        this.channelId = process.env.PAYD_CHANNEL_ID;

        // Create axios instance
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds
        });
    }

    /**
     * Get Authorization Header
     */
    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd credentials not configured');
        }
        const authString = `${this.username}:${this.password}`;
        const base64Auth = Buffer.from(authString).toString('base64');
        return `Basic ${base64Auth}`;
    }

    /**
     * Initiate a mobile payout
     * @param {Object} payoutData
     * @returns {Promise<Object>}
     */
    async initiateMobilePayout(payoutData) {
        try {
            const { amount, phone_number, narration, account_name } = payoutData;

            if (!this.networkCode || !this.channelId) {
                throw new Error('Payd network code or channel ID not configured');
            }

            // Format amount as number
            const payoutAmount = parseFloat(amount);

            // Construct payload based on documentation
            const payload = {
                username: this.username,
                network_code: this.networkCode,
                account_name: account_name || "Seller Withdrawal",
                account_number: phone_number,
                amount: payoutAmount,
                phone_number: phone_number,
                channel_id: this.channelId,
                narration: narration || "Withdrawal",
                currency: "KES",
                // Using a transaction channel appropriate for mobile money
                transaction_channel: "mobile",
                channel: "mobile",
                provider_name: "Mobile Wallet (M-PESA)",
                provider_code: "MPESA",
                // Ideally we should have a callback URL
                callback_url: process.env.PAYD_CALLBACK_URL || "https://example.com/callback"
            };

            logger.info('Initiating Payd Payout');

            const response = await this.client.post('/withdrawal', payload, {
                headers: {
                    Authorization: this.getAuthHeader()
                }
            });

            logger.info('Payd Payout Status:', response.data.status || 'Success');

            return response.data;
        } catch (error) {
            logger.error('Payd Payout Error:', error.response?.data || error.message);

            // Enhance error with response data if available
            if (error.response?.data) {
                const errorData = error.response.data;
                throw new Error(errorData.message || 'Payout initialization failed');
            }

            throw new Error(error.message || 'Payout initialization failed');
        }
    }
}

export default new PayoutService();
