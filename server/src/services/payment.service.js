import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import Payment from '../models/payment.model.js';
import PaymentCompletionService from './paymentCompletion.service.js';
import { pool } from '../config/database.js';

class PaymentService {
    constructor() {
        this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        this.paystackBaseUrl = 'https://api.paystack.co';

        // Create axios instance
        this.client = axios.create({
            baseURL: this.paystackBaseUrl,
            headers: {
                Authorization: `Bearer ${this.paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds
        });
    }

    /**
     * Initiate a payment with Paystack
     * @param {Object} paymentData
     * @returns {Promise<Object>}
     */
    async initiatePayment(paymentData) {
        try {
            const { email, amount, invoice_id, callback_url, metadata } = paymentData;

            // Paystack expects amount in kobo (multiply by 100)
            const paystackAmount = Math.round(parseFloat(amount) * 100);

            const payload = {
                email,
                amount: paystackAmount,
                reference: `REF-${invoice_id}-${Date.now()}`,
                metadata: {
                    ...metadata,
                    invoice_id
                },
                callback_url: callback_url || process.env.PAYSTACK_CALLBACK_URL,
            };

            const response = await this.client.post('/transaction/initialize', payload);

            return {
                authorization_url: response.data.data.authorization_url,
                access_code: response.data.data.access_code,
                reference: response.data.data.reference,
            };
        } catch (error) {
            logger.error('Paystack initialization error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Payment initialization failed');
        }
    }

    /**
     * Handle Paystack Webhook
     * @param {Object} eventData
     * @param {Object} headers
     * @param {string} clientIp
     */
    async handlePaystackWebhook(eventData, headers, clientIp) {
        // 1. Validate Signature
        const signature = headers['x-paystack-signature'];
        if (!signature) {
            throw new Error('No signature provided');
        }

        const hash = crypto
            .createHmac('sha512', this.paystackSecretKey)
            .update(JSON.stringify(eventData))
            .digest('hex');

        if (hash !== signature) {
            throw new Error('Invalid signature');
        }

        // 2. Validate IP (Optional but recommended)
        // Paystack IPs: 52.31.139.75, 52.49.173.169, 52.214.14.220

        // 3. Process Event
        const { event, data } = eventData;

        if (event === 'charge.success') {
            return await this.handleSuccessfulPayment(data);
        }

        return { status: 'ignored', message: `Event ${event} ignored` };
    }

    /**
     * Process successful payment data
     * @param {Object} data 
     */
    async handleSuccessfulPayment(data) {
        const { reference, amount, metadata } = data;

        // Find payment record by reference using raw query since we don't know if findByReference exists on model
        const { rows } = await pool.query(
            'SELECT * FROM payments WHERE provider_reference = $1 OR api_ref = $1 LIMIT 1',
            [reference]
        );

        const payment = rows[0];

        if (!payment) {
            logger.warn(`Payment not found for reference: ${reference}`);
            return { status: 'error', message: 'Payment record not found' };
        }

        if (payment.status === 'completed') {
            return { status: 'success', message: 'Payment already completed' };
        }

        // Verify amount
        const paidAmount = amount / 100;
        if (Math.abs(paidAmount - parseFloat(payment.amount)) > 1) {
            logger.warn(`Amount mismatch for ${payment.id}: expected ${payment.amount}, got ${paidAmount}`);
        }

        // Update metadata with actual Paystack confirmation if needed
        await pool.query(
            `UPDATE payments SET status = 'success', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
            [JSON.stringify({ paystack_confirmation: data }), payment.id]
        );

        // Re-fetch updated payment for completion service
        const { rows: updatedRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
        const updatedPayment = updatedRows[0];

        return await PaymentCompletionService.processSuccessfulPayment(updatedPayment);
    }

    /**
     * Check Status
     * @param {string} paymentId 
     */
    async checkPaymentStatus(paymentId) {
        // Check DB status
        const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
        const payment = rows[0];

        if (!payment) throw new Error('Payment not found');

        // If pending, verify with Paystack
        if (payment.status === 'pending' && payment.provider_reference) {
            try {
                const response = await this.client.get(`/transaction/verify/${payment.provider_reference}`);
                if (response.data.data.status === 'success') {
                    // It was successful, update our DB!
                    await this.handleSuccessfulPayment(response.data.data);
                    return { ...payment, status: 'completed' }; // processed
                }
            } catch (e) {
                logger.warn('Failed to verify with Paystack:', e.message);
            }
        }

        return payment;
    }
}

export default new PaymentService();
