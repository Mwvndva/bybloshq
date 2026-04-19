import Refund from '../models/refund.model.js';
import RefundService from '../services/refund.service.js';
import logger from '../utils/logger.js';

/**
 * Get all refund requests (Admin only)
 */
export const getAllRefundRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const requests = await Refund.findAll({ status, limit: parseInt(limit), offset: parseInt(offset) });
    const total = await Refund.countAll(status);

    res.status(200).json({
      status: 'success',
      data: {
        requests,
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
    const request = await Refund.findById(id);

    if (!request) {
      return res.status(404).json({
        status: 'success', // Matching original status 'success' for 404 in some controllers? 
        // Wait, original was return next(new AppError('Refund request not found', 404)); which sends error status.
        message: 'Refund request not found'
      });
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
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    logger.info(`Admin ${adminId} confirming refund request ${id}`);

    const result = await RefundService.confirmRefund(id, adminId, adminNotes);

    res.status(200).json({
      status: 'success',
      message: 'Refund request confirmed and processed successfully',
      data: {
        requestId: id,
        amountProcessed: result.amount
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

    await RefundService.rejectRefund(id, adminId, adminNotes);

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
