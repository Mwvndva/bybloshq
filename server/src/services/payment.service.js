import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import PaymentCompletionService from './paymentCompletion.service.js';

class PaymentService {
    constructor() {
        this.baseUrl = process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v3';
        this.username = process.env.PAYD_USERNAME;
        this.password = process.env.PAYD_PASSWORD;
        this.networkCode = process.env.PAYD_NETWORK_CODE;
        this.channelId = process.env.PAYD_CHANNEL_ID;
        // Use separate variable for payload username to avoid system USERNAME conflict
        this.payloadUsername = process.env.PAYD_PAYLOAD_USERNAME || 'mwxndx'; // Fallback for immediate test consistency if user hasn't renamed yet

        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
    }

    /**
     * Get Authorization Header for Basic Auth
     */
    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd credentials not configured');
        }
        const authString = `${this.username}:${this.password}`;
        return `Basic ${Buffer.from(authString).toString('base64')}`;
    }

    /**
     * Initiate a payment with Payd (STK Push)
     * Matches structure of: 
     * curl --location 'https://api.mypayd.app/api/v3/payments' \
     * --header 'Content-Type: application/json' \
     * --header 'Authorization: Basic ...' \
     * --data-raw '{ ... }'
     */
    async initiatePayment(paymentData) {
        try {
            const { email, amount, invoice_id, phone, narrative, firstName, lastName } = paymentData;

            if (!this.networkCode || !this.channelId) {
                throw new Error('Payd network code or channel ID not configured');
            }

            const paydAmount = parseFloat(amount);
            const fullName = firstName && lastName ? `${firstName} ${lastName}` : "Customer";
            const customerEmail = email || "customer@example.com";

            // Normalize phone: remove non-digits
            let cleanPhone = phone.replace(/\D/g, '');
            // Ensure 10 digits starting with 0 for local usage in phone_number?
            // Docs curl example: "phone_number": "07712345671"
            // Docs curl example: "account_number": "+254712434671"

            // Let's try to match the curl example logic:
            // If it starts with 254, replace with 0 for phone_number if needed, or keep as is?
            // Usually '07...' is standard for 'phone_number' in Kenya for STK push.
            if (cleanPhone.startsWith('254')) {
                cleanPhone = '0' + cleanPhone.substring(3);
            } else if (cleanPhone.length === 9) {
                cleanPhone = '0' + cleanPhone;
            }

            // For account_number, valid format is often MSISDN (254...) or same as phone.
            // Curl example uses +254 for account_number.
            // Let's generate a +254 version for account_number
            let accountNumber = cleanPhone;
            if (accountNumber.startsWith('0')) {
                accountNumber = '+254' + accountNumber.substring(1);
            }

            const payload = {
                username: this.payloadUsername,
                network_code: this.networkCode,
                account_name: fullName,
                account_number: accountNumber, // e.g. +254...
                amount: paydAmount,
                phone_number: cleanPhone, // e.g. 07...
                channel_id: this.channelId,
                narration: narrative || `Payment for ${invoice_id}`,
                currency: "KES",
                callback_url: process.env.PAYD_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/payments/webhook/payd` : "https://bybloshq.space/api/payments/webhook/payd"),
                transaction_channel: "mobile",
                // Pass our invoice_id as reference to help linking
                reference: String(invoice_id),
                client_reference: String(invoice_id),
                external_reference: String(invoice_id),
                customer_info: {
                    country: "Kenya",
                    address: "Nairobi", // Placeholder/Default
                    id_type: "National ID", // Placeholder/Default
                    id_number: "00000000", // Placeholder/Default
                    dob: "1990-01-01", // Placeholder/Default
                    name: fullName,
                    email: customerEmail,
                    phone: accountNumber // Use international format for customer info phone often
                }
            };

            logger.info('Sending Payd Request:', {
                url: `${this.baseUrl}/payments`,
                method: 'POST',
                // Mask sensitive info
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ***' },
                payload: { ...payload, username: '***' }
            });

            const response = await this.client.post('/payments', payload, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });

            logger.info('Payd Response:', response.data);

            // Return standardized response
            return {
                authorization_url: null,
                access_code: null,
                reference: response.data.transaction_id || response.data.reference || response.data.tracking_id || `REF-${Date.now()}`,
                status: response.data.status,
                original_response: response.data
            };

        } catch (error) {
            // Enhanced Error Logging
            const errorDetails = error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            } : { message: error.message };

            console.error('PAYD ERROR DETAILS:', JSON.stringify(errorDetails, null, 2));
            logger.error('Payd initialization error:', errorDetails);

            // Extract meaningful message
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Payment initialization failed';
            throw new Error(errorMessage);
        }
    }

    /**
     * Handle Payd Webhook/Callback
     */
    async handlePaydCallback(callbackData) {
        logger.info('Processing Payd Callback:', callbackData);

        // Map fields based on user documentation
        // { "transaction_reference": "TX...", "result_code": 200, "remarks": "...", ... }
        const reference = callbackData.transaction_reference || callbackData.transaction_id || callbackData.reference;
        const resultCode = callbackData.result_code;
        const status = callbackData.status; // Fallback if they send status

        // DEBUG: Force log to console for visibility
        // console.log('=== PAYD WEBHOOK RAW ===');
        // console.log(JSON.stringify(callbackData, null, 2));
        // console.log('========================');

        logger.info('Payd Webhook Data Extraction:', {
            extractedReference: reference,
            resultCode,
            status,
            rawKeys: Object.keys(callbackData)
        });

        if (!reference) {
            console.error('Missing reference', callbackData);
            // Don't throw immediately, check if we can find by invoice_id in other fields?
            // For now, throw but log visibly
            throw new Error('No transaction_reference provided in callback');
        }

        // Determine Success: result_code 200 OR 0 is success
        let isSuccess = false;
        if (resultCode == 200 || resultCode === '200' || resultCode == 0 || resultCode === '0') {
            isSuccess = true;
        } else if (!resultCode && (status === 'SUCCESS' || status === 'COMPLETED')) {
            // Fallback to old logic just in case
            isSuccess = true;
        }

        if (!isSuccess) {
            const { rowCount } = await pool.query(
                "UPDATE payments SET status = 'failed', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE provider_reference = $2",
                [JSON.stringify({ failure_reason: callbackData.remarks || callbackData.status_description || 'Failed', raw_callback: callbackData }), reference]
            );

            if (rowCount > 0) {
                return { status: 'failed', message: 'Payment marked as failed' };
            }

            // Check if it's a Withdrawal Request (Payout Failure)
            const { rows: withdrawalRows } = await pool.query(
                'SELECT * FROM withdrawal_requests WHERE provider_reference = $1 OR id::text = $1',
                [reference]
            );

            if (withdrawalRows.length > 0) {
                const withdrawal = withdrawalRows[0];
                if (withdrawal.status === 'failed') return { status: 'success', message: 'Already marked failed' };

                // Handle Failure - REFUND SELLER
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    // 1. Mark as failed
                    await client.query(
                        "UPDATE withdrawal_requests SET status = 'failed', raw_response = COALESCE(raw_response, '{}'::jsonb) || $1::jsonb WHERE id = $2",
                        [JSON.stringify(callbackData), withdrawal.id]
                    );

                    // 2. Refund Balance
                    await client.query(
                        "UPDATE sellers SET balance = balance + $1 WHERE id = $2",
                        [withdrawal.amount, withdrawal.seller_id]
                    );

                    await client.query('COMMIT');
                    logger.info(`Withdrawal ${withdrawal.id} FAILED. Computed refund of ${withdrawal.amount} to seller ${withdrawal.seller_id}`);
                    return { status: 'success', message: 'Withdrawal failure processed and refunded' };

                } catch (err) {
                    await client.query('ROLLBACK');
                    logger.error(`Error processing withdrawal refund for ${withdrawal.id}`, err);
                    throw err;
                } finally {
                    client.release();
                }
            }

            logger.warn(`Failed transaction not found in payments or withdrawals: ${reference}`);
            return { status: 'failed', message: 'Transaction not found' };
        }

        // Handle Success
        return await this.handleSuccessfulPayment({
            reference,
            amount: callbackData.amount,
            metadata: callbackData
        });
    }

    /**
     * Process successful payment logic and trigger ticket creation
     */
    async handleSuccessfulPayment(data) {
        const { reference, amount, metadata } = data;

        let payment = null;

        // 1. Find payment by reference OR invoice_id
        const { rows: refRows } = await pool.query(
            'SELECT * FROM payments WHERE provider_reference = $1 OR api_ref = $1 OR invoice_id = $1 LIMIT 1',
            [reference]
        );

        if (refRows.length > 0) {
            payment = refRows[0];
        } else {
            // 1b. Fuzzy match: Find by Status + Amount + Phone (if available)
            // This handles cases where Payd generates a new reference we don't know
            logger.info(`Reference ${reference} not found, attempting fuzzy match...`);

            const webhookPhone = metadata.phone_number || metadata.phone; // "254111..."
            const webhookAmount = parseFloat(amount);

            if (webhookPhone && webhookAmount) {
                // Extract last 9 digits to be safe (safely ignores 0 vs 254 prefix)
                const phoneTail = webhookPhone.slice(-9);

                logger.info(`Fuzzy matching for Amount: ${webhookAmount}, Phone Tail: ${phoneTail}`);

                const { rows: fuzzyRows } = await pool.query(
                    `SELECT * FROM payments 
                     WHERE status = 'pending' 
                     AND amount = $1 
                     AND phone_number LIKE '%' || $2 
                     ORDER BY created_at DESC LIMIT 1`,
                    [webhookAmount, phoneTail]
                );

                if (fuzzyRows.length > 0) {
                    payment = fuzzyRows[0];
                    logger.info(`Fuzzy match found: Payment ID ${payment.id}`);

                    // Update the payment with the CORRECT reference from Payd so subsequent hooks match
                    // We only update provider_reference, leaving api_ref as the original REF-... 
                    // so the frontend (which polls api_ref) can still find it.
                    await pool.query(
                        'UPDATE payments SET provider_reference = $1 WHERE id = $2',
                        [reference, payment.id]
                    );
                }
            } else {
                logger.warn('Insufficient data for fuzzy match (missing phone or amount)');
            }
        }

        // If still no payment, use the rows[0] (which will be undefined) or handle normally
        // const payment = rows[0]; // Logic below handles if (!payment)

        if (!payment) {
            // Check if it's a Withdrawal Request (Payout)
            const { rows: withdrawalRows } = await pool.query(
                'SELECT * FROM withdrawal_requests WHERE provider_reference = $1 OR id::text = $1',
                [reference]
            );

            if (withdrawalRows.length > 0) {
                const withdrawal = withdrawalRows[0];
                logger.info(`Payout Callback received for Withdrawal ${withdrawal.id}`);

                if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
                    return { status: 'success', message: 'Withdrawal already processed' };
                }

                // Mark as Completed
                // Since we are in handleSuccessfulPayment, we assume success
                await pool.query(
                    "UPDATE withdrawal_requests SET status = 'completed', raw_response = COALESCE(raw_response, '{}'::jsonb) || $1::jsonb, processed_at = NOW() WHERE id = $2",
                    [JSON.stringify(data.metadata || {}), withdrawal.id]
                );
                logger.info(`Withdrawal ${withdrawal.id} marked as COMPLETED`);
                return { status: 'success', message: 'Withdrawal processed successfully' };
            }

            logger.warn(`Payment/Withdrawal not found for reference: ${reference}`);
            return { status: 'error', message: 'Record not found' };
        }

        if (payment.status === 'completed' || payment.status === 'success') {
            return { status: 'success', message: 'Payment already completed' };
        }

        // 2. Validate Amount
        if (amount) {
            const paidAmount = parseFloat(amount);
            if (Math.abs(paidAmount - parseFloat(payment.amount)) > 1) {
                logger.warn(`Amount mismatch for ${payment.id}: expected ${payment.amount}, got ${paidAmount}`);
            }
        }

        // 3. Mark as Success in DB
        await pool.query(
            `UPDATE payments SET status = 'success', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
            [JSON.stringify({ payd_confirmation: metadata }), payment.id]
        );

        // 4. Trigger Post-Payment Logic (Tickets, Emails)
        const { rows: updatedRows } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
        return await PaymentCompletionService.processSuccessfulPayment(updatedRows[0]);
    }

    async checkPaymentStatus(identifier) {
        let rows;
        // Check if identifier is a valid integer (for ID lookup)
        const isId = /^\d+$/.test(identifier);

        if (isId) {
            const result = await pool.query('SELECT * FROM payments WHERE id = $1', [identifier]);
            rows = result.rows;
        } else {
            // It's a string reference (provider ref, invoice_id, etc.)
            const result = await pool.query(
                'SELECT * FROM payments WHERE provider_reference = $1 OR invoice_id = $1 OR api_ref = $1',
                [identifier]
            );
            rows = result.rows;
        }

        const payment = rows[0];
        if (!payment) throw new Error('Payment not found');
        return payment;
    }
}

export default new PaymentService();
