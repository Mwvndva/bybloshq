import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export const handlePaydCallback = async (req, res) => {
    const client = await pool.connect();
    // Default response to acknowledge receipt immediately
    // Payd might retry if we error out, but we want to log internal errors
    try {
        const callbackData = req.body;
        logger.info('Received Payd Callback:', callbackData);

        // 1. Extract Info
        const providerRef = callbackData.transaction_id || callbackData.reference || callbackData.original_reference;
        const status = callbackData.status || callbackData.status_code;

        if (!providerRef) {
            logger.warn('Callback missing reference. Data:', callbackData);
            return res.status(400).json({ status: 'error', message: 'Missing transaction reference' });
        }

        // 2. Map Status
        let newStatus = null;
        if (['SUCCESS', 'COMPLETED', '0'].includes(status)) {
            newStatus = 'completed';
        } else if (['FAILED', 'REJECTED'].includes(status)) {
            newStatus = 'failed';
        } else {
            logger.info(`Callback ignored status: '${status}'`);
            return res.status(200).json({ status: 'ignored' });
        }

        await client.query('BEGIN');

        // 3. Find Request
        const { rows: [request] } = await client.query(
            'SELECT id, status, amount, seller_id, organizer_id, event_id FROM withdrawal_requests WHERE provider_reference = $1 FOR UPDATE',
            [providerRef]
        );

        if (!request) {
            logger.warn(`Reference not found: ${providerRef}`);
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Transaction not found' });
        }

        // 4. Idempotency Check
        if (['completed', 'failed', 'rejected'].includes(request.status)) {
            await client.query('ROLLBACK');
            return res.status(200).json({ status: 'already_processed' });
        }

        // 5. Update Status
        const failureReason = callbackData.status_description || callbackData.message || 'Unknown provider error';
        await client.query(
            'UPDATE withdrawal_requests SET status = $1, processed_at = NOW(), metadata = $2 WHERE id = $3',
            [newStatus, JSON.stringify({ ...callbackData, failure_reason: failureReason }), request.id]
        );

        // 6. Handle failure (Refunds)
        if (newStatus === 'failed') {
            await refundBalance(client, request);
            logger.info(`Refunded ${request.amount} for ref: ${providerRef}`);
        }

        await client.query('COMMIT');
        logger.info(`Callback processed. Ref: ${providerRef} -> ${newStatus}`);
        res.status(200).json({ status: 'success' });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Callback processing error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
};

/**
 * Refund helper to keep main logic clean
 */
async function refundBalance(client, request) {
    if (request.event_id) {
        const feePercentage = 0.06;
        const grossRefund = request.amount / (1 - feePercentage);
        await client.query('UPDATE events SET balance = balance + $1 WHERE id = $2', [grossRefund, request.event_id]);
    } else if (request.seller_id) {
        await client.query('UPDATE sellers SET balance = balance + $1 WHERE id = $2', [request.amount, request.seller_id]);
    } else if (request.organizer_id) {
        await client.query('UPDATE organizers SET balance = balance + $1 WHERE id = $2', [request.amount, request.organizer_id]);
    }
}
