import { pool } from '../config/database.js';
import nodemailer from 'nodemailer';
import { AppError } from '../utils/errorHandler.js';

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Request a withdrawal
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requestWithdrawal = async (req, res, next) => {
  console.log('🔄 Withdrawal request received');
  console.log('🔗 Request details:', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
    contentType: req.headers['content-type'],
    authorization: req.headers.authorization ? 'Bearer token present' : 'No token',
    body: req.body ? 'Has body' : 'No body',
    user: req.user ? `User ID: ${req.user.id}` : 'No user'
  });

  try {
    const sellerId = req.user.id;
    const { mpesaNumber, registeredName, amount } = req.body;

    console.log('📋 Withdrawal request details:', {
      sellerId,
      mpesaNumber: mpesaNumber ? `${mpesaNumber.substring(0, 6)}...` : 'missing',
      registeredName: registeredName ? `${registeredName.substring(0, 10)}...` : 'missing',
      amount: amount ? `Ksh ${parseFloat(amount).toFixed(2)}` : 'missing',
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!mpesaNumber || !registeredName || !amount) {
      console.log('❌ Validation failed: Missing required fields');
      throw new AppError('M-Pesa number, registered name, and amount are required', 400);
    }

    // Get seller details
    console.log('🔍 Fetching seller details for ID:', sellerId);
    const sellerResult = await pool.query(
      'SELECT full_name, email, phone, shop_name FROM sellers WHERE id = $1',
      [sellerId]
    );

    if (sellerResult.rows.length === 0) {
      console.log('❌ Seller not found in database');
      throw new AppError('Seller not found', 404);
    }

    const seller = sellerResult.rows[0];
    console.log('✅ Seller found:', {
      id: sellerId,
      name: seller.full_name,
      shop: seller.shop_name,
      email: seller.email
    });

    // Save withdrawal request to database
    console.log('💾 Saving withdrawal request to database...');
    const withdrawalResult = await pool.query(
      `INSERT INTO seller_withdrawals
       (seller_id, mpesa_number, registered_name, amount, status, requested_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id`,
      [sellerId, mpesaNumber, registeredName, amount]
    );

    console.log('✅ Withdrawal saved to database:', {
      withdrawalId: withdrawalResult.rows[0].id,
      status: 'pending'
    });

    // Prepare response data
    const responseData = {
      status: 'success',
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalId: withdrawalResult.rows[0].id,
        amount: parseFloat(amount),
        status: 'pending',
        requestedAt: new Date().toISOString()
      }
    };

    console.log('📤 Sending response to client immediately:', {
      statusCode: 200,
      responseSize: JSON.stringify(responseData).length,
      withdrawalId: responseData.data.withdrawalId
    });

    // Send response immediately (don't wait for email)
    res.status(200).json(responseData);

    // Send email asynchronously in the background with timeout
    console.log('📧 Sending notification email in background...');

    // Check if email configuration is available
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_FROM_EMAIL) {
      console.warn('⚠️ Email configuration missing - skipping email notification');
      console.log('🎉 Withdrawal request completed successfully');
      return;
    }

    const emailContent = `
New Withdrawal Request:
----------------------

Seller Details:
- ID: ${sellerId}
- Name: ${seller.full_name}
- Shop: ${seller.shop_name}
- Email: ${seller.email}
- Phone: ${seller.phone}

Withdrawal Details:
------------------
- M-Pesa Number: ${mpesaNumber}
- Registered Name: ${registeredName}
- Amount: Ksh ${parseFloat(amount).toFixed(2)}
- Status: Pending

Requested At: ${new Date().toLocaleString()}

Please process this withdrawal request within 24-48 hours.
    `;

    // Send email with timeout to prevent hanging
    try {
      console.log('📨 Email configuration:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE,
        from: process.env.EMAIL_FROM_EMAIL,
        to: process.env.EMAIL_FROM_EMAIL
      });

      // Create a promise that rejects after 10 seconds
      const emailPromise = transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
        to: process.env.EMAIL_FROM_EMAIL,
        subject: `Withdrawal Request - ${seller.shop_name || 'Seller'}`,
        text: emailContent,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout after 10 seconds')), 10000)
      );

      await Promise.race([emailPromise, timeoutPromise]);
      console.log('✅ Withdrawal notification email sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send withdrawal email:', {
        message: emailError.message,
        code: emailError.code,
        command: emailError.command,
        response: emailError.response
      });
      // Email failure doesn't affect the withdrawal request
    }

    console.log('🎉 Withdrawal request fully completed');
  } catch (error) {
    console.error('💥 Error processing withdrawal request:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    });
    next(error);
  }
};

/**
 * Get withdrawal history for a seller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getWithdrawals = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    
    const result = await pool.query(
      `SELECT id, amount, status, requested_at as "requestedAt",
              processed_at as "processedAt", mpesa_number as "mpesaNumber",
              registered_name as "registeredName"
       FROM seller_withdrawals
       WHERE seller_id = $1
       ORDER BY requested_at DESC`,
      [sellerId]
    );

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    next(error);
  }
};
