import * as refundRequestRepository from '../../orders/repositories/refundRequest.repository.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import logger from '../../../shared/utils/logger.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import { pool } from '../../../infrastructure/database/database.js';
import settlementService from '../../orders/escrow/settlement.service.js';

/**
 * Get all refund requests (Admin only)
 */
export const getAllRefundRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;

    const [requests, total] = await Promise.all([
      refundRequestRepository.findAllWithBuyer({ status, limit: parsedLimit, offset }),
      refundRequestRepository.countAll({ status })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        requests,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          pages: Math.ceil(total / parsedLimit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching refund requests:', error);
    next(error);
  }
};

/**
 * Get refund request by ID (Admin only)
 */
export const getRefundRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await refundRequestRepository.findByIdWithBuyer(id);

    if (!request) {
      return next(new AppError('Refund request not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { request }
    });
  } catch (error) {
    logger.error('Error fetching refund request:', error);
    next(error);
  }
};

/**
 * Confirm/Complete refund request (Admin only)
 */
export const confirmRefundRequest = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    await client.query('BEGIN');

    const lockedRequest = await refundRequestRepository.findByIdForUpdate(id, client);
    if (!lockedRequest) {
      await client.query('ROLLBACK');
      return next(new AppError('Refund request not found', 404));
    }

    if (lockedRequest.status !== 'pending' && lockedRequest.status !== 'manual_review') {
      await client.query('ROLLBACK');
      return next(new AppError(`Refund request is already ${lockedRequest.status}`, 400));
    }

    const refundAmount = Number.parseFloat(lockedRequest.amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Invalid refund amount', 400));
    }

    const processedBy = typeof adminId === 'number' ? adminId : null;
    const completedNotes = adminNotes || 'Refund authorized by admin';

    // 1. Credit buyer's refund balance
    await client.query(
      `UPDATE buyers
       SET refunds = COALESCE(refunds, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [refundAmount, lockedRequest.buyer_id]
    );

    // 2. Mark refund request as completed and record credit details
    const creditDetails = {
      credited_to_buyer: true,
      credited_amount: refundAmount,
      credited_at: new Date().toISOString(),
      credited_by_admin: adminId
    };

    await client.query(
      `UPDATE refund_requests
       SET status = 'completed',
           admin_notes = $1,
           processed_by = $2,
           payment_details = COALESCE(payment_details, '{}'::jsonb) || $3::jsonb,
           processed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [completedNotes, processedBy, JSON.stringify(creditDetails), id]
    );

    // 3. Update order status and reverse seller settlement if associated with an order
    if (lockedRequest.order_id) {
      try {
        await client.query(
          `UPDATE product_orders
           SET status = 'REFUNDED'::order_status,
               payment_status = 'cancelled'::payment_status,
               metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            lockedRequest.order_id,
            JSON.stringify({
              refund_completed: {
                refund_request_id: id,
                admin_id: adminId,
                admin_notes: completedNotes,
                refund_amount: refundAmount,
                completed_at: new Date().toISOString()
              }
            })
          ]
        );
      } catch (orderErr) {
        logger.warn(`[REFUND] Order ${lockedRequest.order_id} status update fallback:`, orderErr.message);
        await client.query(
          `UPDATE product_orders
           SET status = 'REFUNDED'::order_status,
               updated_at = NOW()
           WHERE id = $1`,
          [lockedRequest.order_id]
        ).catch(() => {});
      }

      try {
        await settlementService.reverseOrderSettlementForRefund(client, lockedRequest.order_id, 'manual_admin_refund');
      } catch (settleErr) {
        logger.warn(`[REFUND] Order ${lockedRequest.order_id} settlement reversal fallback:`, settleErr.message);
      }
    }

    await client.query('COMMIT');

    logger.info(`Refund request ${id} approved/completed by admin ${adminId} (credited ${refundAmount} to buyer ${lockedRequest.buyer_id})`);

    // Fetch buyer details for event notification
    const requestWithBuyer = await refundRequestRepository.findByIdWithBuyer(id);

    await eventBus.enqueueAndDispatch(AppEvents.REFUND.COMPLETED, {
      eventId: `refund.completed:${id}`,
      refund: {
        id,
        buyer_id: lockedRequest.buyer_id,
        amount: lockedRequest.amount,
        status: 'completed',
        adminNotes: completedNotes
      },
      buyer: {
        id: lockedRequest.buyer_id,
        full_name: requestWithBuyer?.buyer_name || null,
        whatsapp_number: requestWithBuyer?.buyer_phone || null
      }
    }, 'RefundController.confirmRefundRequest').catch(() => {});

    res.status(200).json({
      status: 'success',
      message: 'Refund request confirmed and credited to buyer refund balance',
      data: {
        requestId: id,
        creditedAmount: refundAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Error confirming refund request:', error);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Reject refund request (Admin only)
 */
export const rejectRefundRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    logger.info(`Admin ${adminId} rejecting refund request ${id}`);

    const header = await refundRequestRepository.findHeaderById(id);

    if (!header) {
      return next(new AppError('Refund request not found', 404));
    }

    const { status: currentStatus, buyer_id, amount, full_name, whatsapp_number } = header;

    if (currentStatus !== 'pending' && currentStatus !== 'manual_review') {
      return next(new AppError(`Refund request is already ${currentStatus}`, 400));
    }

    const processedBy = typeof adminId === 'number' ? adminId : null;

    await refundRequestRepository.markRejected({
      id,
      adminNotes: adminNotes || 'Refund request rejected',
      processedBy
    });

    logger.info(`Refund request ${id} rejected`);

    await eventBus.enqueueAndDispatch(AppEvents.REFUND.REJECTED, {
      eventId: `refund.rejected:${id}`,
      refund: {
        id,
        buyer_id,
        amount,
        status: 'rejected',
        adminNotes
      },
      buyer: {
        id: buyer_id,
        full_name,
        whatsapp_number
      }
    }, 'RefundController.rejectRefundRequest').catch(() => {});

    res.status(200).json({
      status: 'success',
      message: 'Refund request rejected',
      data: {
        requestId: id
      }
    });
  } catch (error) {
    logger.error('Error rejecting refund request:', error);
    next(error);
  }
};
