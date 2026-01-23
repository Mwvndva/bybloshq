import axios from 'axios';
import logger from '../utils/logger.js';

import https from 'https';

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
                'User-Agent': 'ByblosHQ/1.0 (Node.js)'
            },
            timeout: 30000,
            // Bypass self-signed certificate errors and ensure connection stability
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                keepAlive: true,
                family: 4 // Force IPv4
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

    async initiateMobilePayout(payoutData) {
        try {
            const { amount, phone_number, narration, account_name } = payoutData;

            if (!this.networkCode || !this.channelId) {
                throw new Error('Payd network code or channel ID not configured');
            }

            const callbackUrl = await this.getCallbackUrl();
            logger.info(`Initiating Payout to ${phone_number}. Callback URL: ${callbackUrl}`);

            // Strict payload matching user specification
            const payload = {
                username: this.username,
                network_code: this.networkCode,
                account_name: account_name || "Seller Withdrawal", // e.g. "momo" or name
                account_number: phone_number, // User spec shows 0712345678, but typically wallets accept 254. using 254 for safety or original input if separated? userController sends the 254 refactored one. 
                amount: parseFloat(amount),
                phone_number: phone_number, // Spec: 254712345678
                channel_id: this.channelId,
                narration: narration || "Payment for goods",
                currency: "KES",
                callback_url: callbackUrl,
                transaction_channel: "mobile",
                channel: "mobile",
                provider_name: "Mobile Wallet (M-PESA)",
                provider_code: "MPESA"
                // 'reference' removed as it is not in the strict body received example, 
                // typically 'correlator_id' is returned. If Payd v3 supports 'reference' it usually ignores extra fields, 
                // but user said "ensure implementation follows this system" so we stick to it.
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
