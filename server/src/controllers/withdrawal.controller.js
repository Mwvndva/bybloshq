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
       VALUES ($1, $2, $3, $4, 'completed', NOW())
       RETURNING id`,
      [sellerId, mpesaNumber, registeredName, amount]
    );

    console.log('✅ Withdrawal saved to database:', {
      withdrawalId: withdrawalResult.rows[0].id,
      status: 'completed'
    });

    // Prepare response data
    const responseData = {
      status: 'success',
      message: 'Withdrawal request submitted and processed successfully',
      data: {
        withdrawalId: withdrawalResult.rows[0].id,
        amount: parseFloat(amount),
        status: 'completed',
        requestedAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
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
    console.log('📧 Sending notification email to business email...');

    const emailContent = `
New Seller Withdrawal Request:
-----------------------------

Seller Information:
• Seller ID: ${sellerId}
• Seller Name: ${seller.full_name}
• Shop Name: ${seller.shop_name}
• Seller Email: ${seller.email}
• Seller Phone: ${seller.phone}

Withdrawal Request:
• M-Pesa Number: ${mpesaNumber}
• Registered Name: ${registeredName}
• Amount: Ksh ${parseFloat(amount).toFixed(2)}
• Request Time: ${new Date().toLocaleString()}

Action Required:
Please send Ksh ${parseFloat(amount).toFixed(2)} to the M-Pesa number ${mpesaNumber} registered to ${registeredName}.

This withdrawal request has been automatically approved and should be processed within 24 hours.
    `;

    // Send email with timeout to prevent hanging
    try {
      console.log('📨 Sending to business email: byblosexperience@zohomail.com');

      // Check if email configuration is properly set
      const requiredEmailVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USERNAME', 'EMAIL_PASSWORD', 'EMAIL_FROM_EMAIL'];
      const missingEmailVars = requiredEmailVars.filter(varName => !process.env[varName]);

      if (missingEmailVars.length > 0) {
        console.error('❌ Email configuration incomplete. Missing variables:', missingEmailVars);
        console.error('📧 Email configuration status:', {
          EMAIL_HOST: process.env.EMAIL_HOST ? 'Set' : 'Missing',
          EMAIL_PORT: process.env.EMAIL_PORT ? 'Set' : 'Missing',
          EMAIL_USERNAME: process.env.EMAIL_USERNAME ? `${process.env.EMAIL_USERNAME.substring(0, 10)}...` : 'Missing',
          EMAIL_FROM_EMAIL: process.env.EMAIL_FROM_EMAIL ? 'Set' : 'Missing',
          EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ? 'Set' : 'Missing'
        });
        console.log('⚠️ Skipping email notification due to missing configuration');
        return;
      }

      const emailConfig = {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE,
        username: process.env.EMAIL_USERNAME,
        fromEmail: process.env.EMAIL_FROM_EMAIL,
        fromName: process.env.EMAIL_FROM_NAME
      };

      console.log('✅ Email configuration verified for business email');
      console.log('📧 Email configuration check:', {
        host: emailConfig.host ? 'Set' : 'Missing',
        port: emailConfig.port ? 'Set' : 'Missing',
        username: emailConfig.username ? `${emailConfig.username.substring(0, 10)}...` : 'Missing',
        fromEmail: emailConfig.fromEmail ? 'Set' : 'Missing'
      });

      // Create a promise that rejects after 30 seconds
      const emailPromise = transporter.sendMail({
        from: `"${emailConfig.fromName || 'Byblos Platform'}" <${emailConfig.fromEmail}>`,
        to: 'byblosexperience@zohomail.com',
        subject: `Seller Withdrawal Request - ${seller.shop_name || seller.full_name} - Ksh ${parseFloat(amount).toFixed(2)}`,
        text: emailContent,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout after 30 seconds')), 30000)
      );

      await Promise.race([emailPromise, timeoutPromise]);
      console.log('✅ Withdrawal notification email sent to business successfully');
    } catch (emailError) {
      console.error('❌ Failed to send withdrawal email to business:', {
        message: emailError.message,
        code: emailError.code,
        command: emailError.command,
        response: emailError.response,
        stack: emailError.stack
      });

      // Log email configuration for debugging
      console.error('📧 Email configuration status:', {
        EMAIL_HOST: process.env.EMAIL_HOST ? 'Set' : 'Missing',
        EMAIL_PORT: process.env.EMAIL_PORT ? 'Set' : 'Missing',
        EMAIL_USERNAME: process.env.EMAIL_USERNAME ? `${process.env.EMAIL_USERNAME.substring(0, 10)}...` : 'Missing',
        EMAIL_FROM_EMAIL: process.env.EMAIL_FROM_EMAIL ? 'Set' : 'Missing',
        EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ? 'Set' : 'Missing'
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

/**
 * Get a specific withdrawal by ID for the authenticated seller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getWithdrawalById = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;

    console.log('🔍 Fetching withdrawal by ID for seller:', { sellerId, withdrawalId: id });

    const result = await pool.query(
      `SELECT id, amount, status, requested_at as "requestedAt",
              processed_at as "processedAt", mpesa_number as "mpesaNumber",
              registered_name as "registeredName", notes
       FROM seller_withdrawals
       WHERE id = $1 AND seller_id = $2`,
      [id, sellerId]
    );

    if (result.rows.length === 0) {
      return next(new AppError('Withdrawal not found', 404));
    }

    console.log('✅ Withdrawal found:', result.rows[0].id);

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching withdrawal by ID:', error);
    next(new AppError('Failed to fetch withdrawal', 500));
  }
};
