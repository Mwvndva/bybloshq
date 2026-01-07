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
            timeout: 30000,
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
        const baseUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'https://bybloshq-f1rz.onrender.com';
        return `${baseUrl}/api/callbacks/payd`;
    }

    async initiateMobilePayout(payoutData) {
        try {
            const { amount, phone_number, narration, account_name, reference } = payoutData;

            if (!this.networkCode || !this.channelId) {
                throw new Error('Payd network code or channel ID not configured');
            }

            const callbackUrl = await this.getCallbackUrl();
            logger.info(`Initiating Payout. Callback URL: ${callbackUrl}`);

            const payload = {
                username: this.username,
                network_code: this.networkCode,
                account_name: account_name || "Seller Withdrawal",
                account_number: phone_number,
                amount: parseFloat(amount),
                phone_number: phone_number,
                channel_id: this.channelId,
                narration: narration || "Withdrawal",
                currency: "KES",
                transaction_channel: "mobile",
                channel: "mobile",
                provider_name: "Mobile Wallet (M-PESA)",
                provider_code: "MPESA",
                callback_url: callbackUrl,
                reference: reference
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
}

export default new PayoutService();
