import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export const handlePaydCallback = async (req, res) => {
    const client = await pool.connect();

    try {
        const callbackData = req.body;
        logger.info('Received Payd Callback:', callbackData);

        // Payd callback structure usually contains a reference ID and status
        // Adjust these fields based on actual Payd documentation
        // Assuming: transaction_id or reference, and status_code or status
        const providerRef = callbackData.transaction_id || callbackData.reference || callbackData.original_reference;
        const status = callbackData.status || callbackData.status_code;

        if (!providerRef) {
            logger.warn('Payd Callback missing reference:', callbackData);
            return res.status(400).json({ status: 'error', message: 'Missing transaction reference' });
        }

        // Map Payd status to our status
        let newStatus = null;
        if (status === 'SUCCESS' || status === 'COMPLETED' || status === '0') { // '0' is often success code
            newStatus = 'completed';
        } else if (status === 'FAILED' || status === 'REJECTED') {
            newStatus = 'failed';
        }

        if (!newStatus) {
            logger.info(`Payd Callback status '${status}' ignored or unknown.`);
            return res.status(200).json({ status: 'ignored' });
        }

        await client.query('BEGIN');

        // Find the withdrawal request
        const requestResult = await client.query(
            'SELECT id, status, amount, seller_id, organizer_id, event_id FROM withdrawal_requests WHERE provider_reference = $1 FOR UPDATE',
            [providerRef]
        );

        if (requestResult.rows.length === 0) {
            logger.warn(`Withdrawal request not found for ref: ${providerRef}`);
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Transaction not found' });
        }

        const request = requestResult.rows[0];

        // If already in final state, ignore
        if (['completed', 'failed', 'rejected'].includes(request.status)) {
            await client.query('ROLLBACK');
            return res.status(200).json({ status: 'already_processed' });
        }

        // Update status
        await client.query(
            'UPDATE withdrawal_requests SET status = $1, processed_at = NOW(), metadata = $2 WHERE id = $3',
            [newStatus, JSON.stringify(callbackData), request.id]
        );

        // If failed, refund the money!
        if (newStatus === 'failed') {
            if (request.event_id) {
                // Determine Gross Amount (restore fees)
                const feePercentage = 0.06;
                const grossRefund = request.amount / (1 - feePercentage);

                await client.query(
                    'UPDATE events SET balance = balance + $1 WHERE id = $2',
                    [grossRefund, request.event_id]
                );
            } else if (request.seller_id) {
                await client.query(
                    'UPDATE sellers SET balance = balance + $1 WHERE id = $2',
                    [request.amount, request.seller_id]
                );
            } else if (request.organizer_id) {
                await client.query(
                    'UPDATE organizers SET balance = balance + $1 WHERE id = $2',
                    [request.amount, request.organizer_id]
                );
            }
            logger.info(`Refunded ${request.amount} to user due to failed payout (Ref: ${providerRef})`);
        }

        await client.query('COMMIT');

        logger.info(`Processed callback for request ${request.id}, status updated to ${newStatus}`);
        res.status(200).json({ status: 'success' });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error processing callback:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
};
