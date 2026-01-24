import { sendEmail } from '../utils/email.js';
import { pool } from '../config/database.js';

import payoutService from '../services/payout.service.js';
import withdrawalService from '../services/withdrawal.service.js';
import { sanitizeWithdrawalRequest } from '../utils/sanitize.js';

export const sendWithdrawalEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required email fields'
      });
    }



    const info = await sendEmail({
      to,
      subject,
      html
    });



    res.status(200).json({
      status: 'success',
      message: 'Withdrawal request email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending withdrawal email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send withdrawal request email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create withdrawal request for organizer
// @route   POST /api/organizers/withdrawal-request
// @access  Private
// @desc    Create withdrawal request for organizer (Event-based)
// @route   POST /api/organizers/withdrawal-request
// @access  Private
export const createWithdrawalRequest = async (req, res) => {
  try {
    const organizerId = req.user?.id;
    const { amount, mpesaNumber, mpesaName, eventId } = req.body;

    if (!organizerId) return res.status(401).json({ status: 'error', message: 'Authentication required' });
    if (!mpesaNumber || !mpesaName || !eventId) return res.status(400).json({ status: 'error', message: 'Missing required fields' });

    // Delegate to WithdrawalService
    const request = await withdrawalService.createWithdrawalRequest({
      entityId: eventId,
      entityType: 'event',
      organizerId: organizerId,
      amount,
      mpesaNumber,
      mpesaName
    });

    res.status(201).json({
      status: 'success',
      data: sanitizeWithdrawalRequest({
        ...request,
        message: 'Withdrawal initiated successfully.'
      })
    });

  } catch (error) {
    console.error('Error creating withdrawal request:', error);

    const statusCode = error.message.includes('Insufficient') ? 400 :
      error.message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Failed to create withdrawal request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get withdrawal history for a specific event
// @route   GET /api/organizers/events/:eventId/withdrawals
// @access  Private
export const getEventWithdrawals = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.id;

    // Verify ownership first
    const eventCheck = await pool.query(
      'SELECT id FROM events WHERE id = $1 AND organizer_id = $2',
      [eventId, organizerId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found or you are not authorized'
      });
    }

    const result = await pool.query(
      `SELECT * FROM withdrawal_requests 
       WHERE event_id = $1 
       ORDER BY created_at DESC`,
      [eventId]
    );

    res.status(200).json({
      status: 'success',
      data: {
        data: {
          withdrawals: result.rows.map(sanitizeWithdrawalRequest)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching event withdrawals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch withdrawal history'
    });
  }
};
