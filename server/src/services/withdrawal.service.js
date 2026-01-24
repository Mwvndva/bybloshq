import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import payoutService from './payout.service.js';
import whatsappService from './whatsapp.service.js';

class WithdrawalService {
    /**
     * Create a withdrawal request for a specified entity (seller or organizer)
     * 
     * @param {Object} data 
     * @param {number} data.entityId
     * @param {string} data.entityType - 'seller', 'organizer', or 'event'
     * @param {number} data.amount
     * @param {string} data.mpesaNumber
     * @param {string} data.mpesaName
     * @param {number} [data.organizerId] - Required for entityType 'event'
     */
    async createWithdrawalRequest({ entityId, entityType, amount, mpesaNumber, mpesaName, organizerId }) {
        // 1. Validate & Normalize
        let withdrawalAmount;
        let normalizedPhone;
        try {
            withdrawalAmount = payoutService.validateWithdrawal(amount);
            normalizedPhone = payoutService.normalizePhoneNumber(mpesaNumber);
        } catch (validationError) {
            throw validationError;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 2. Lock & Check Balance based on Entity type
            let table = '';
            let checkQuery = '';
            let checkParams = [entityId];

            if (entityType === 'seller') {
                table = 'sellers';
                checkQuery = 'SELECT id, balance, full_name as owner_name FROM sellers WHERE id = $1 FOR UPDATE';
            } else if (entityType === 'organizer') {
                table = 'organizers';
                checkQuery = 'SELECT id, balance, full_name as owner_name FROM organizers WHERE id = $1 FOR UPDATE';
            } else if (entityType === 'event') {
                table = 'events';
                checkQuery = 'SELECT id, balance, name as owner_name FROM events WHERE id = $1 AND organizer_id = $2 FOR UPDATE';
                checkParams.push(organizerId);
            }

            const { rows: [entity] } = await client.query(checkQuery, checkParams);

            if (!entity) throw new Error(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or unauthorized`);

            // 3. Deduction Logic (Handling fees for events)
            let deductionAmount = withdrawalAmount;
            if (entityType === 'event') {
                const feePercentage = 0.06;
                deductionAmount = withdrawalAmount / (1 - feePercentage);
            }

            if (parseFloat(entity.balance) < deductionAmount) throw new Error('Insufficient balance');

            // 4. Deduct Balance
            await client.query(`UPDATE ${table} SET balance = balance - $1 WHERE id = $2`, [deductionAmount, entityId]);

            // 5. Create Withdrawal Request Record
            const insertCols = ['amount', 'mpesa_number', 'mpesa_name', 'status', 'created_at'];
            const insertVals = [withdrawalAmount, normalizedPhone, mpesaName, 'processing', 'NOW()'];

            if (entityType === 'seller') {
                insertCols.unshift('seller_id');
                insertVals.unshift(entityId);
            } else if (entityType === 'organizer') {
                insertCols.unshift('organizer_id');
                insertVals.unshift(entityId);
            } else if (entityType === 'event') {
                insertCols.unshift('organizer_id', 'event_id');
                insertVals.unshift(organizerId, entityId);
            }

            const queryText = `INSERT INTO withdrawal_requests (${insertCols.join(', ')}) 
                         VALUES (${insertCols.map((_, i) => `$${i + 1}`).join(', ')}) 
                         RETURNING id, amount, mpesa_number, status, created_at`;

            const { rows: [request] } = await client.query(queryText, insertVals);

            const reference = `WR-${request.id}-${Date.now()}`;
            await client.query('UPDATE withdrawal_requests SET provider_reference = $1 WHERE id = $2', [reference, request.id]);

            await client.query('COMMIT');

            // 5. Initiate External Payout (Async)
            this._initiatePayout(request, entity, reference, withdrawalAmount, normalizedPhone, mpesaName)
                .catch(err => logger.error(`[WithdrawalService] Async Payout Initiation Error for ID ${request.id}:`, err));

            return request;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Internal helper to initiate the payout via PayoutService
     */
    async _initiatePayout(request, entity, reference, amount, phone, name) {
        try {
            logger.info(`[WithdrawalService] Initiating Payout for ReqID ${request.id} (${reference})`);

            const payoutResponse = await payoutService.initiateMobilePayout({
                amount,
                phone_number: phone,
                narration: `Withdrawal for ${entity.owner_name || entity.full_name}`,
                account_name: name,
                reference: reference // Pass local WR reference for idempotency
            });

            // Update provider details
            const providerId = payoutResponse.correlator_id || payoutResponse.transaction_id;
            if (providerId) {
                await pool.query('UPDATE withdrawal_requests SET raw_response = $1, provider_reference = $2 WHERE id = $3',
                    [JSON.stringify(payoutResponse), providerId, request.id]
                );
            } else {
                await pool.query('UPDATE withdrawal_requests SET raw_response = $1 WHERE id = $2',
                    [JSON.stringify(payoutResponse), request.id]
                );
            }

            // Notify User
            if (entity.phone) {
                whatsappService.notifySellerWithdrawalUpdate(entity.phone, {
                    amount,
                    status: 'processing',
                    reference: providerId || reference,
                    reason: null,
                    newBalance: null
                }).catch(err => logger.error('[WithdrawalService] WA notification failed:', err));
            }

        } catch (apiError) {
            logger.error(`[WithdrawalService] Payd API Failed for ReqID ${request.id}: ${apiError.message}`);

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await payoutService.processRefund(client, { ...request, seller_id: entity.id }); // Using generic refund logic
                await client.query('UPDATE withdrawal_requests SET status = $1, metadata = jsonb_set(COALESCE(metadata, \'{}\'::jsonb), \'{error}\', $2::jsonb) WHERE id = $3',
                    ['failed', JSON.stringify(apiError.message), request.id]);
                await client.query('COMMIT');

                if (entity.phone) {
                    whatsappService.notifySellerWithdrawalUpdate(entity.phone, {
                        amount,
                        status: 'failed',
                        reference,
                        reason: apiError.message,
                        newBalance: null // Could fetch but skipping for brevity
                    }).catch(() => { });
                }
            } catch (refundErr) {
                await client.query('ROLLBACK');
                logger.error('[WithdrawalService] CRITICAL: Post-API refund failed:', refundErr);
            } finally {
                client.release();
            }
        }
    }

    /**
     * Reconcile withdrawals stuck in 'processing' state
     * @param {number} hoursAgo 
     */
    async reconcileStuckWithdrawals(hoursAgo = 1) {
        logger.info(`[WithdrawalService] Starting reconciliation for withdrawals older than ${hoursAgo} hours`);

        const { rows: stuckWithdrawals } = await pool.query(
            `SELECT * FROM withdrawal_requests 
       WHERE status = 'processing' 
       AND created_at < NOW() - INTERVAL '${hoursAgo} hours'
       AND created_at > NOW() - INTERVAL '48 hours'
       ORDER BY created_at ASC`
        );

        logger.info(`[WithdrawalService] Found ${stuckWithdrawals.length} stuck withdrawals`);

        for (const request of stuckWithdrawals) {
            try {
                if (!request.provider_reference) {
                    logger.warn(`[WithdrawalService] Request ${request.id} has no provider reference, skipping.`);
                    continue;
                }

                const providerData = await payoutService.checkPayoutStatus(request.provider_reference);
                const status = (providerData.status || providerData.status_code || '').toUpperCase();

                if (['SUCCESS', 'COMPLETED', '0'].includes(status)) {
                    await pool.query(
                        'UPDATE withdrawal_requests SET status = $1, processed_at = NOW(), metadata = COALESCE(metadata, \'{}\'::jsonb) || $2 WHERE id = $3',
                        ['completed', JSON.stringify({ reconciliation: providerData }), request.id]
                    );
                    logger.info(`[WithdrawalService] Reconciled ReqID ${request.id} as COMPLETED`);
                } else if (['FAILED', 'REJECTED'].includes(status)) {
                    const client = await pool.connect();
                    try {
                        await client.query('BEGIN');
                        await payoutService.processRefund(client, request);
                        await client.query(
                            'UPDATE withdrawal_requests SET status = $1, processed_at = NOW(), metadata = COALESCE(metadata, \'{}\'::jsonb) || $2 WHERE id = $3',
                            ['failed', JSON.stringify({ reconciliation: providerData }), request.id]
                        );
                        await client.query('COMMIT');
                        logger.info(`[WithdrawalService] Reconciled ReqID ${request.id} as FAILED and refunded`);
                    } catch (refundErr) {
                        await client.query('ROLLBACK');
                        throw refundErr;
                    } finally {
                        client.release();
                    }
                } else {
                    logger.info(`[WithdrawalService] ReqID ${request.id} still in status: ${status}`);
                }
            } catch (err) {
                logger.error(`[WithdrawalService] Failed to reconcile ReqID ${request.id}:`, err.message);
            }
        }
    }
}

export default new WithdrawalService();
