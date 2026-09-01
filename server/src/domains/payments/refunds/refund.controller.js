import * as refundRequestRepository from '../../orders/repositories/refundRequest.repository.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import logger from '../../../shared/utils/logger.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';

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
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    const request = await refundRequestRepository.findByIdWithBuyer(id);
    if (!request) {
      return next(new AppError('Refund request not found', 404));
    }

    if (request.status !== 'pending' && request.status !== 'manual_review') {
      return next(new AppError(`Refund request is already ${request.status}`, 400));
    }

    const processedBy = typeof adminId === 'number' ? adminId : null;
    await refundRequestRepository.markCompleted({
      id,
      adminNotes: adminNotes || 'Refund authorized by admin',
      processedBy
    });

    if (request.order_id) {
      const { pool } = await import('../../../infrastructure/database/database.js');
      await pool.query(
        `UPDATE product_orders
         SET status = 'REFUNDED'::order_status,
             payment_status = 'refunded'::payment_status,
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          request.order_id,
          JSON.stringify({
            refund_completed: {
              refund_request_id: id,
              admin_id: adminId,
              admin_notes: adminNotes || null,
              completed_at: new Date().toISOString()
            }
          })
        ]
      );
    }

    logger.info(`Refund request ${id} approved/completed by admin ${adminId}`);

    await eventBus.enqueueAndDispatch(AppEvents.REFUND.COMPLETED, {
      eventId: `refund.completed:${id}`,
      refund: {
        id,
        buyer_id: request.buyer_id,
        amount: request.amount,
        status: 'completed',
        adminNotes
      },
      buyer: {
        id: request.buyer_id,
        full_name: request.buyer_name,
        whatsapp_number: request.buyer_phone
      }
    }, 'RefundController.confirmRefundRequest').catch(() => {});

    res.status(200).json({
      status: 'success',
      message: 'Refund request confirmed and processed',
      data: {
        requestId: id
      }
    });
  } catch (error) {
    logger.error('Error confirming refund request:', error);
    next(error);
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
