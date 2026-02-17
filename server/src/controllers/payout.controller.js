import withdrawalService from '../services/withdrawal.service.js';
import { AppError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';

/**
 * POST /api/organizers/request-payout
 * Organizer or event withdrawal
 */
export const requestPayout = async (req, res, next) => {
  try {
    const organizerId = req.user?.id;
    if (!organizerId) return next(new AppError('Authentication required', 401));

    const { amount, mpesaNumber, mpesaName, eventId } = req.body;

    if (!amount || !mpesaNumber || !mpesaName) {
      return next(new AppError('amount, mpesaNumber, and mpesaName are required', 400));
    }

    const request = eventId
      ? await withdrawalService.createWithdrawalRequest({
        entityId: parseInt(eventId),
        entityType: 'event',
        amount,
        mpesaNumber,
        mpesaName,
        organizerId
      })
      : await withdrawalService.createWithdrawalRequest({
        entityId: organizerId,
        entityType: 'organizer',
        amount,
        mpesaNumber,
        mpesaName
      });

    res.status(201).json({
      status: 'success',
      message: 'Withdrawal submitted. You will receive a WhatsApp notification once processed.',
      data: {
        id: request.id,
        amount: parseFloat(request.amount),
        mpesaNumber: request.mpesa_number,
        status: request.status,
        createdAt: request.created_at
      }
    });

  } catch (error) {
    logger.error('[PayoutController] requestPayout error:', error.message);
    const code = error.message.includes('Insufficient') ? 400
      : error.message.includes('Minimum') || error.message.includes('Maximum') ? 400
        : error.message.includes('not found') ? 404 : 500;
    next(new AppError(error.message, code));
  }
};

/**
 * GET /api/organizers/payouts
 * Payout history for the authenticated organizer
 */
export const getPayoutHistory = async (req, res, next) => {
  try {
    const organizerId = req.user?.id;
    if (!organizerId) return next(new AppError('Authentication required', 401));

    const { rows } = await pool.query(
      `SELECT 
                wr.id,
                wr.amount,
                wr.mpesa_number,
                wr.mpesa_name,
                wr.status,
                wr.provider_reference,
                wr.created_at,
                wr.processed_at,
                wr.event_id,
                e.name  AS event_name,
                CASE 
                    WHEN wr.status = 'failed' 
                    THEN COALESCE(wr.metadata->>'api_error', wr.metadata->'payd_callback'->>'remarks', 'Unknown error')
                    ELSE NULL
                END AS failure_reason,
                CASE 
                    WHEN wr.status = 'completed'
                    THEN wr.metadata->'payd_callback'->>'third_party_trans_id'
                    ELSE NULL
                END AS mpesa_receipt
             FROM withdrawal_requests wr
             LEFT JOIN events e ON wr.event_id = e.id
             WHERE wr.organizer_id = $1
             ORDER BY wr.created_at DESC
             LIMIT 100`,
      [organizerId]
    );

    res.status(200).json({
      status: 'success',
      count: rows.length,
      data: rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        mpesaNumber: r.mpesa_number,
        mpesaName: r.mpesa_name,
        status: r.status,
        providerReference: r.provider_reference,
        eventId: r.event_id,
        eventName: r.event_name,
        failureReason: r.failure_reason,
        mpesaReceipt: r.mpesa_receipt,
        createdAt: r.created_at,
        processedAt: r.processed_at
      }))
    });

  } catch (error) {
    logger.error('[PayoutController] getPayoutHistory error:', error.message);
    next(new AppError('Failed to fetch payout history', 500));
  }
};
