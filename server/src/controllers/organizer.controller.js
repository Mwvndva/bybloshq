import { sendEmail } from '../utils/email.js';
import { pool } from '../config/database.js';

import payoutService from '../services/payout.service.js';
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
  const client = await pool.connect();

  try {
    const organizerId = req.user?.id;
    const { amount, mpesaNumber, mpesaName, eventId } = req.body;

    if (!organizerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Validate required fields (check amount existence distinct from value being 0)
    if (!mpesaNumber || !mpesaName || !eventId) {
      return res.status(400).json({
        status: 'error',
        message: 'M-Pesa number, M-Pesa name, and Event ID are required'
      });
    }

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Withdrawal amount is required'
      });
    }

    // Validate amount is positive number
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount must be a positive number'
      });
    }

    // Start database transaction
    await client.query('BEGIN');

    // Verify event ownership and get current balance (locking the row)
    const eventResult = await client.query(
      `SELECT e.id, e.name, e.balance 
       FROM events e 
       WHERE e.id = $1 AND e.organizer_id = $2 
       FOR UPDATE`,
      [eventId, organizerId]
    );

    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Event not found or you are not authorized'
      });
    }

    const event = eventResult.rows[0];
    const currentBalance = parseFloat(event.balance || 0);

    // Calculate Gross Amount (Amount + 6% Fee)
    // Net = Gross * 0.94  =>  Gross = Net / 0.94
    const feePercentage = 0.06;
    const grossAmount = withdrawalAmount / (1 - feePercentage); // This is the amount we deduct from DB

    // Check if withdrawal amount exceeds event balance
    // We check GROSS amount against balance because balance is Gross Revenue
    if (grossAmount > currentBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: `Insufficient funds. Gross deduction including fees (KSh ${grossAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}) exceeds event balance (KSh ${currentBalance.toLocaleString()})`
      });
    }

    // Deduct GROSS amount from EVENT balance
    await client.query(
      'UPDATE events SET balance = balance - $1 WHERE id = $2',
      [grossAmount, eventId]
    );

    // Create withdrawal request record linked to event
    // We store the NET amount (what user receives)
    const requestResult = await client.query(
      `INSERT INTO withdrawal_requests (
          organizer_id, 
          event_id,
          amount, 
          mpesa_number, 
          mpesa_name, 
          status, 
          created_at
       )
       VALUES ($1, $2, $3, $4, $5, 'processing', NOW())
       RETURNING id, organizer_id, event_id, amount, mpesa_number, mpesa_name, status, created_at`,
      [organizerId, eventId, withdrawalAmount, mpesaNumber, mpesaName]
    );

    const withdrawalRequest = requestResult.rows[0];

    // Commit the transaction (balance deducted, request created)
    await client.query('COMMIT');

    // Initiate payout with Payd
    try {


      const payoutResponse = await payoutService.initiateMobilePayout({
        amount: withdrawalAmount,
        phone_number: mpesaNumber,
        narration: `Event Payout: ${event.name.substring(0, 20)}`,
        account_name: mpesaName
      });



      // Extract transaction ID from response
      const providerRef = payoutResponse.transaction_id || payoutResponse.reference || payoutResponse.data?.transaction_id || null;

      // Update the withdrawal request with provider reference
      await client.query(
        'UPDATE withdrawal_requests SET provider_reference = $1, raw_response = $2 WHERE id = $3',
        [providerRef, JSON.stringify(payoutResponse), withdrawalRequest.id]
      );

    } catch (apiError) {
      console.error('Payd API failed after balance deduction. Rolling back...', apiError);

      // Compensating Transaction
      try {
        await client.query('BEGIN');

        // Refund GROSS balance to EVENT
        await client.query(
          'UPDATE events SET balance = balance + $1 WHERE id = $2',
          [grossAmount, eventId]
        );

        // Update request status to failed
        await client.query(
          'UPDATE withdrawal_requests SET status = $1 WHERE id = $2',
          ['failed', withdrawalRequest.id]
        );

        await client.query('COMMIT');

        await client.query('COMMIT');

        // Determine user-friendly error message
        let userMessage = 'Payout processing failed. Your funds have been refunded.';
        let statusCode = 502; // Bad Gateway

        const errorMessage = apiError.message?.toLowerCase() || '';

        if (errorMessage.includes('insufficient balance')) {
          userMessage = 'Insufficient balance';
          statusCode = 400; // Using 400 to treat it as a standard failure
        } else if (errorMessage.includes('timeout')) {
          userMessage = 'Payout provider timed out. Your funds have been refunded. Please try again.';
          statusCode = 504; // Gateway Timeout
        }

        return res.status(statusCode).json({
          status: 'error',
          message: userMessage,
          detail: process.env.NODE_ENV === 'development' ? apiError.message : undefined
        });

      } catch (refundError) {
        console.error('CRITICAL: Failed to refund event balance after payout failure!', refundError);
        throw refundError;
      }
    }

    // Success response
    res.status(201).json({
      status: 'success',
      data: sanitizeWithdrawalRequest({
        ...withdrawalRequest,
        message: 'Withdrawal initiated successfully.'
      })
    });

  } catch (error) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (e) { }

    console.error('Error creating withdrawal request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create withdrawal request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
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
