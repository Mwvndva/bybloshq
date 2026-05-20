import { pool } from '../shared/db/database.js';
import * as refundRequestRepository from '../repositories/refundRequest.repository.js';
import { AppError } from '../shared/utils/errorHandler.js';
import logger from '../shared/utils/logger.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

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
 * This deducts the amount from buyer's refunds
 */
export const confirmRefundRequest = async (req, res, next) => {
  const client = await pool.connect();
  let approvedEventId = null;

  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    logger.info(`Admin ${adminId} confirming refund request ${id}`);

    await client.query('BEGIN');

    // Lock the refund request row
    const requestResult = await client.query(
      `SELECT rr.*
       FROM refund_requests rr
       WHERE rr.id = $1
       FOR UPDATE`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Refund request not found', 404));
    }

    const request = requestResult.rows[0];

    // Check status before acquiring the buyer lock (fast check)
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return next(new AppError(`Refund request is already ${request.status}`, 400));
    }

    // Lock the buyer row SEPARATELY to serialize concurrent refund processing
    // for the same buyer across different refund requests
    const buyerResult = await client.query(
      `SELECT id, refunds, full_name, whatsapp_number FROM buyers WHERE id = $1 FOR UPDATE`,
      [request.buyer_id]
    );

    if (buyerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Buyer account not found', 404));
    }

    const buyer = buyerResult.rows[0];
    const buyerRefunds = parseFloat(buyer.refunds || 0);
    const requestAmount = parseFloat(request.amount);

    if (buyerRefunds < requestAmount) {
      await client.query('ROLLBACK');
      return next(new AppError('Buyer does not have sufficient refund balance', 400));
    }

    // Update refund request status to completed
    // Only set processed_by if adminId is a valid number
    const processedBy = typeof adminId === 'number' ? adminId : null;

    await client.query(
      `UPDATE refund_requests
       SET status = 'completed',
           admin_notes = $1,
           processed_by = $2,
           processed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [adminNotes || 'Refund processed successfully', processedBy, id]
    );

    // Deduct amount from buyer's refunds
    await client.query(
      `UPDATE buyers
       SET refunds = GREATEST(refunds - $1, 0),
           updated_at = NOW()
       WHERE id = $2`,
      [requestAmount, request.buyer_id]
    );

    const approvedEvent = await eventBus.enqueueInTransaction(client, AppEvents.REFUND.APPROVED, {
      eventId: `refund.approved:${id}`,
      refund: {
        ...request,
        id,
        amount: requestAmount,
        status: 'completed'
      },
      buyer
    });
    approvedEventId = approvedEvent.eventId;

    await client.query('COMMIT');

    logger.info(`Refund request ${id} confirmed. Deducted KSh ${requestAmount} from buyer ${request.buyer_id}`);

    eventBus.dispatchAfterCommit(approvedEventId, 'RefundController.confirmRefundRequest');

    res.status(200).json({
      status: 'success',
      message: 'Refund request confirmed and processed successfully',
      data: {
        requestId: id,
        amountProcessed: requestAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
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

    if (currentStatus !== 'pending') {
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
    }, 'RefundController.rejectRefundRequest');

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




