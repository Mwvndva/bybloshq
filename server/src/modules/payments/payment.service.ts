import axios from 'axios';
import https from 'https';
import logger from '../../shared/utils/logger.js';
import { pool } from '../../shared/db/database.js';
import FulfillmentService from '../fulfillment/fulfillment.service.js';
import OrderService from '../orders/order.service.js';

class PaymentService {
    private baseUrl: string;
    private username: string;
    private password: string;
    private httpsAgent: https.Agent;

    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.payd.money/api/v2';
        this.username = process.env.PAYD_USERNAME || '';
        this.password = process.env.PAYD_PASSWORD || '';

        this.httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 50,
            timeout: 25000
        });
    }

    /**
     * Initiate product payment (Creates order + initiates STK)
     */
    async initiateProductPayment(normalizedOrder: any) {
        const { buyer, service, metadata } = normalizedOrder;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create Order record (Securely determines prices from DB)
            const order = await OrderService.createOrder(normalizedOrder, client);

            // 🚫 NEVER trust client-sent totals again (CRITICAL FIX: PRICE-TRUST)
            const secureAmount = Number.parseFloat(order.total_amount);

            // 🛠️ HARD GUARD: Detect and reject mismatch early
            const clientAmount = Number.parseFloat(service.total);
            if (!isNaN(clientAmount) && clientAmount !== secureAmount) {
                logger.warn(`[Payment] Amount mismatch detected! Client sent ${clientAmount}, DB verified ${secureAmount}. Order: ${order.id}`);
                throw new Error('Payment amount mismatch detected. Security alert triggered.');
            }

            // 2. Create Payment record using only secure amount
            const insertRes = await client.query(
                `INSERT INTO payments (invoice_id, email, mobile_payment, amount, status, payment_method, metadata)
                 VALUES ($1, $2, $3, $4, 'pending', 'payd', $5) RETURNING *`,
                [String(order.id), buyer.email, buyer.phone, secureAmount, JSON.stringify({ order_id: order.id, ...metadata })]
            );
            const payment = insertRes.rows[0];

            await client.query('COMMIT');

            // 3. Initiate Gateway using secure amount
            try {
                const gwPayload = {
                    amount: secureAmount,
                    phone: buyer.phone,
                    invoice_id: String(order.id),
                    narration: metadata.narration || `Payment for ${service.title}`
                };

                const result = await this.initiatePayment(gwPayload);

                if (result.reference) {
                    await pool.query("UPDATE payments SET provider_reference = $1 WHERE id = $2", [result.reference, payment.id]);
                }

                return {
                    success: true,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    paymentId: payment.id,
                    paymentResult: result
                };
            } catch (gwError: any) {
                logger.error('[Payment] Gateway initiation failed:', gwError.message);
                return {
                    success: false,
                    orderId: order.id,
                    error: 'Payment initiation failed. Please try again from Order History.'
                };
            }
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Initiate M-Pesa STK Push
     */
    async initiatePayment(paymentData: any) {
        logger.info(`[Payment] Initiating STK Push for ${paymentData.amount} KES`);

        const payload = {
            username: process.env.PAYD_PAYLOAD_USERNAME || 'mwxndx',
            channel: "MPESA",
            amount: paymentData.amount,
            phone_number: paymentData.phone,
            narration: paymentData.narration || `Order ${paymentData.invoice_id}`,
            currency: "KES",
            callback_url: process.env.PAYD_CALLBACK_URL
        };

        try {
            const response = await axios.post(`${this.baseUrl}/payments`, payload, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
            } as any);

            return {
                success: true,
                reference: (response.data as any).transaction_reference,
                message: 'STK push sent'
            };
        } catch (error: any) {
            logger.error('[Payment] Initiation failed:', error.message);
            throw error;
        }
    }

    /**
     * Handle Webhook from Payd
     */
    async handleCallback(callbackData: any) {
        logger.info('[Payment] Received webhook:', callbackData);

        const reference = callbackData.transaction_reference;
        const isSuccess = callbackData.status === 'SUCCESS' || callbackData.result_code === 0;

        if (!isSuccess) {
            logger.warn(`[Payment] Payment failed for reference ${reference}`);
            return { success: false };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Find and LOCK Order (CRITICAL FIX: CONCURRENCY-LOCK)
            const { rows } = await client.query(
                `SELECT id, total_amount, status, metadata 
                 FROM product_orders 
                 WHERE (order_number = $1 OR payment_reference = $1) 
                 FOR UPDATE`,
                [reference]
            );

            if (rows.length === 0) {
                logger.error(`[Payment] Order not found for reference ${reference}`);
                await client.query('ROLLBACK');
                return { success: false, message: 'Order not found' };
            }

            const order = rows[0];

            // 1b. Idempotency Guard (Inside lock)
            const terminalStatuses = ['COMPLETED', 'COLLECTION_PENDING', 'DELIVERY_PENDING', 'SERVICE_PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'];
            if (terminalStatuses.includes(order.status)) {
                logger.warn(`[Payment] Order ${order.id} already processed (${order.status}). Skipping duplicate fulfillment.`);
                await client.query('ROLLBACK');
                return { success: true };
            }

            // 🛠️ FRAUD GUARD: Verify paid amount matches order total (CRITICAL FIX: PRICE-TRUST)
            const paidAmount = Number.parseFloat(callbackData.amount);
            const expectedAmount = Number.parseFloat(order.total_amount);

            if (!isNaN(paidAmount) && paidAmount < expectedAmount) {
                logger.error('[Payment] FRAUD ALERT: Amount mismatch!', {
                    orderId: order.id,
                    expected: expectedAmount,
                    received: paidAmount
                });
                // Mark order as FRAUD or FAILED to block fulfillment
                await client.query("UPDATE product_orders SET status = 'FAILED', notes = $1 WHERE id = $2",
                    [`FRAUD ATTEMPT: Paid ${paidAmount} but required ${expectedAmount}`, order.id]);
                await client.query('COMMIT');
                return { success: false, message: 'Fraud detected: amount mismatch' };
            }

            // 2. Trigger Fulfillment
            // Passing the current client would be ideal for shared transaction, but FulfillmentService currently manages its own internal transactions.
            // Since we hold the lock on 'product_orders', even external transactions in FulfillmentService will be safe from concurrent runs for this specific order.
            await FulfillmentService.handlePaymentSuccess(order.id);

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`[Payment] Webhook processing failed for ${reference}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Check payment status (Polling support)
     */
    async checkPaymentStatus(reference: string) {
        try {
            const response = await axios.get(`${this.baseUrl}/payments/${reference}`, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                },
                httpsAgent: this.httpsAgent
            } as any);

            const data = response.data as any;
            const details = data.data || data;
            let status = (details.status || data.status || 'pending').toLowerCase();

            if (status === 'processed' || status === 'paid') status = 'completed';
            if (status === 'fail') status = 'failed';

            return {
                success: true,
                reference,
                status,
                amount: Number.parseFloat(data.amount || 0),
                raw: data
            };
        } catch (error: any) {
            logger.error(`[Payment] Status check failed for ${reference}:`, error.message);
            throw error;
        }
    }

    private getAuthHeader() {
        const authString = `${this.username}:${this.password}`;
        return `Basic ${Buffer.from(authString).toString('base64')}`;
    }
}

export default new PaymentService();
