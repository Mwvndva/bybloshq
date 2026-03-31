import { pool } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';
import whatsappService from '../services/whatsapp.service.js';
import Buyer from '../models/buyer.model.js';
import logger from '../utils/logger.js';

/**
 * Get all refund requests (Admin only)
 */
export const getAllRefundRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        rr.*,
        b.id as buyer_id,
        b.full_name as buyer_name,
        b.email as buyer_email,
        b.whatsapp_number as buyer_phone,
        b.refunds as buyer_current_refunds
      FROM refund_requests rr
      JOIN buyers b ON rr.buyer_id = b.id
    `;

    const queryParams = [];

    if (status) {
      query += ` WHERE rr.status = $1`;
      queryParams.push(status);
    }

    query += ` ORDER BY rr.requested_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    const countQuery = status
      ? `SELECT COUNT(*) FROM refund_requests WHERE status = $1`
      : `SELECT COUNT(*) FROM refund_requests`;
    const countParams = status ? [status] : [];
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      status: 'success',
      data: {
        requests: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
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

    const query = `
      SELECT 
        rr.*,
        b.id as buyer_id,
        b.full_name as buyer_name,
        b.email as buyer_email,
        b.whatsapp_number as buyer_phone,
        b.refunds as buyer_current_refunds
      FROM refund_requests rr
      JOIN buyers b ON rr.buyer_id = b.id
      WHERE rr.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return next(new AppError('Refund request not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        request: result.rows[0]
      }
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

  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    logger.info(`Admin ${adminId} confirming refund request ${id}`);

    await client.query('BEGIN');

    // Get refund request with lock
    const requestResult = await client.query(
      `SELECT rr.*, b.refunds as buyer_refunds
       FROM refund_requests rr
       JOIN buyers b ON rr.buyer_id = b.id
       WHERE rr.id = $1
       FOR UPDATE`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Refund request not found', 404));
    }

    const request = requestResult.rows[0];

    // Check if already processed
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return next(new AppError(`Refund request is already ${request.status}`, 400));
    }

    // Verify buyer still has sufficient refunds
    const buyerRefunds = parseFloat(request.buyer_refunds || 0);
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

    await client.query('COMMIT');

    logger.info(`Refund request ${id} confirmed. Deducted KSh ${requestAmount} from buyer ${request.buyer_id}`);

    // Send WhatsApp notification to buyer
    try {
      const buyer = await Buyer.findById(request.buyer_id);
      if (buyer) {
        await whatsappService.sendRefundApprovedNotification(buyer, requestAmount);
      }
    } catch (error) {
      logger.error('[REFUND] WhatsApp notification failed (refund already processed):', error.message);
      // Don't fail the request if notification fails
    }

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

    // Fetch all needed data in ONE query before updating
    const checkResult = await pool.query(
      `SELECT status, buyer_id, amount FROM refund_requests WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return next(new AppError('Refund request not found', 404));
    }

    const { status: currentStatus, buyer_id, amount } = checkResult.rows[0];

    if (currentStatus !== 'pending') {
      return next(new AppError(`Refund request is already ${currentStatus}`, 400));
    }

    // Update refund request status to rejected
    // Only set processed_by if adminId is a valid number
    const processedBy = typeof adminId === 'number' ? adminId : null;

    await pool.query(
      `UPDATE refund_requests
       SET status = 'rejected',
           admin_notes = $1,
           processed_by = $2,
           processed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [adminNotes || 'Refund request rejected', processedBy, id]
    );

    logger.info(`Refund request ${id} rejected`);

    // Get buyer details and send WhatsApp notification
    try {
      const buyer = await Buyer.findById(buyer_id);
      if (buyer) {
        await whatsappService.sendRefundRejectedNotification(buyer, amount, adminNotes);
      }
    } catch (error) {
      logger.error('[REFUND] WhatsApp rejection notification failed:', error.message);
      // Don't fail the request if notification fails
    }

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

