import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import PaystackProviderClient from '../../../infrastructure/providers/PaystackProviderClient.js';
import CorePaymentService from './CorePaymentService.js';
import { PaymentStatus } from '../../../shared/constants/enums.js';

export class PaymentService {
    async initiateProductPayment(normalizedOrder) {
        return CorePaymentService.initiateProductPayment(normalizedOrder);
    }

    /**
     * Check payment provider balance.
     */
    async checkBalance() {
        const paystack = new PaystackProviderClient();
        return paystack.checkBalance();
    }

    /**
     * Process pending payments within the given lookback window.
     * Claims pending payments with FOR UPDATE SKIP LOCKED and verifies status.
     *
     * @param {number} [hoursAgo=24]
     * @param {number} [limit=50]
     */
    async processPendingPayments(hoursAgo = 24, limit = 50) {
        return PaymentService.processPendingPayments(hoursAgo, limit);
    }

    /**
     * Static helper to process pending payments.
     *
     * @param {number} [hoursAgo=24]
     * @param {number} [limit=50]
     */
    static async processPendingPayments(hoursAgo = 24, limit = 50) {
        const client = await pool.connect();
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        const results = [];

        try {
            const { rows: pendingPayments } = await client.query(
                `SELECT * FROM payments
                 WHERE status = 'pending'::payment_status
                   AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
                 ORDER BY created_at ASC
                 LIMIT $2
                 FOR UPDATE SKIP LOCKED`,
                [hoursAgo, limit]
            );

            processedCount = pendingPayments.length;

            for (const payment of pendingPayments) {
                try {
                    const ref = payment.provider_reference || payment.api_ref || payment.invoice_id;
                    if (!ref) {
                        logger.warn(`[PaymentService] Pending payment ${payment.id} has no reference for status verification`);
                        continue;
                    }

                    const paystack = new PaystackProviderClient();
                    const verifiedPayload = await paystack.verifyTransaction(ref);
                    const completionResult = await CorePaymentService.completeVerifiedPayment({
                        reference: ref,
                        paymentId: payment.id,
                        providerPayload: verifiedPayload,
                        source: 'payment_cron'
                    });

                    if (completionResult.status === 'success') {
                        successCount += 1;
                    }
                    results.push(completionResult);
                } catch (err) {
                    const error = /** @type {Error} */ (err);
                    errorCount += 1;
                    logger.error(`[PaymentService] Error processing pending payment ${payment.id}:`, error.message);
                }
            }
            return {
                processedCount,
                successCount,
                errorCount,
                results
            };
        } finally {
            client.release();
        }
    }

    static async checkPaymentStatus(identifier) {
        const client = await pool.connect();
        try {
            const res = await client.query(
                'SELECT * FROM payments WHERE id = $1 OR reference = $2 OR provider_reference = $1 LIMIT 1',
                [identifier, identifier]
            );
            return res.rows[0] || null;
        } finally {
            client.release();
        }
    }

    static async hasSufficientBalance(requiredAmount, bufferPercent = 10) {
        const multiplier = 1 + (bufferPercent / 100);
        const threshold = requiredAmount * multiplier;
        return true;
    }

    static async _updatePaymentOnSuccess(client, paymentId, providerData) {
        const res = await client.query(
            "UPDATE payments SET status = $1, provider_data = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
            [PaymentStatus.SUCCESSFUL, JSON.stringify(providerData), paymentId]
        );
        return res.rows[0];
    }
}

const paymentService = new PaymentService();

export { CorePaymentService as PaymentLifecycleService };
export default paymentService;

