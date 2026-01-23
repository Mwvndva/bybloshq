import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import whatsappService from '../services/whatsapp.service.js';

export const handlePaydCallback = async (req, res) => {
    const client = await pool.connect();
    // Default response to acknowledge receipt immediately
    // Payd might retry if we error out, but we want to log internal errors
    try {
        logger.info('Received Payd Callback Headers:', req.headers);
        logger.info('Received Payd Callback Body (Raw):', JSON.stringify(req.body, null, 2));

        // Normalize payload: Payd sometimes matches success/fail inside a 'data' wrapper
        const payload = req.body.data || req.body;
        const callbackData = payload;

        // 1. Extract Info
        // Payd V3 uses correlator_id, others might use transaction_id
        // We also check for 'reference' as a fallback
        const providerRef = payload.correlator_id || payload.transaction_id || payload.reference || payload.original_reference;
        const status = payload.status || payload.status_code;

        logger.info(`[PAYD-CALLBACK] Processing Callback. Derived Ref: '${providerRef}', Derived Status: '${status}'`);
        logger.info(`[PAYD-CALLBACK] Payload content:`, JSON.stringify(payload, null, 2));

        if (!providerRef) {
            logger.warn('Callback missing reference. Payload:', payload);
            return res.status(400).json({ status: 'error', message: 'Missing transaction reference' });
        }

        // 2. Map Status
        let newStatus = null;
        const statusStr = String(status).toUpperCase();
        if (['SUCCESS', 'COMPLETED', '0'].includes(statusStr)) {
            newStatus = 'completed';
        } else if (['FAILED', 'REJECTED'].includes(statusStr)) {
            newStatus = 'failed';
        } else {
            logger.info(`Callback ignored status: '${status}'`);
            return res.status(200).json({ status: 'ignored' });
        }

        await client.query('BEGIN');

        // 3. Find Request with User Phone details
        const { rows: [request] } = await client.query(
            `SELECT wr.id, wr.status, wr.amount, wr.seller_id, wr.organizer_id, wr.event_id, 
                    COALESCE(s.phone, o.phone) as phone
             FROM withdrawal_requests wr 
             LEFT JOIN sellers s ON wr.seller_id = s.id 
             LEFT JOIN organizers o ON wr.organizer_id = o.id
             WHERE wr.provider_reference = $1 
             FOR UPDATE OF wr`,
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
        let refundNewBalance = null;
        if (newStatus === 'failed') {
            refundNewBalance = await refundBalance(client, request);
            logger.info(`Refunded ${request.amount} for ref: ${providerRef}`);
        }

        await client.query('COMMIT');
        logger.info(`Callback processed. Ref: ${providerRef} -> ${newStatus}`);

        // 7. WhatsApp Notification
        if (request.phone) {
            whatsappService.notifySellerWithdrawalUpdate(request.phone, {
                amount: request.amount,
                status: newStatus,
                reference: providerRef,
                reason: failureReason,
                newBalance: refundNewBalance
            }).catch(err => logger.error('Failed to send callback WA notification:', err));
        }

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
    let newBalance = null;
    let table = '';

    if (request.event_id) {
        const feePercentage = 0.06;
        const grossRefund = request.amount / (1 - feePercentage);
        const { rows } = await client.query('UPDATE events SET balance = balance + $1 WHERE id = $2 RETURNING balance', [grossRefund, request.event_id]);
        newBalance = rows[0]?.balance;
        table = 'events';
    } else if (request.seller_id) {
        const { rows } = await client.query('UPDATE sellers SET balance = balance + $1 WHERE id = $2 RETURNING balance', [request.amount, request.seller_id]);
        newBalance = rows[0]?.balance;
        table = 'sellers';
    } else if (request.organizer_id) {
        const { rows } = await client.query('UPDATE organizers SET balance = balance + $1 WHERE id = $2 RETURNING balance', [request.amount, request.organizer_id]);
        newBalance = rows[0]?.balance;
        table = 'organizers';
    }

    if (newBalance !== null) {
        logger.info(`Refund Successful. Entity: ${table}, Amount: ${request.amount}, New Balance: ${newBalance}`);
    }
    return newBalance;
}
