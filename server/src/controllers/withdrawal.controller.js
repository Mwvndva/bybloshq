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
  try {
    const sellerId = req.user.id;
    const { mpesaNumber, registeredName, amount } = req.body;

    // Validate required fields
    if (!mpesaNumber || !registeredName || !amount) {
      throw new AppError('M-Pesa number, registered name, and amount are required', 400);
    }

    // Get seller details
    const sellerResult = await pool.query(
      'SELECT full_name, email, phone, shop_name FROM sellers WHERE id = $1',
      [sellerId]
    );

    if (sellerResult.rows.length === 0) {
      throw new AppError('Seller not found', 404);
    }

    const seller = sellerResult.rows[0];

    // Save withdrawal request to database
    const withdrawalResult = await pool.query(
      `INSERT INTO withdrawals 
       (seller_id, mpesa_number, registered_name, amount, status, requested_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id`,
      [sellerId, mpesaNumber, registeredName, amount]
    );

    // Prepare email content
    const emailContent = `
      New Withdrawal Request:
      -------------------
      Seller ID: ${sellerId}
      Seller Name: ${seller.full_name}
      Shop Name: ${seller.shop_name}
      Email: ${seller.email}
      Phone: ${seller.phone}
      
      Withdrawal Details:
      -------------------
      M-Pesa Number: ${mpesaNumber}
      Registered Name: ${registeredName}
      Amount: Ksh ${parseFloat(amount).toFixed(2)}
      
      Requested At: ${new Date().toLocaleString()}
      
      Please process this withdrawal request as soon as possible.
    `;

    // Send email to admin
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
      to: process.env.EMAIL_FROM_EMAIL, // Send to admin email
      subject: `Withdrawal Request - ${seller.shop_name || 'Seller'}`,
      text: emailContent,
    });

    res.status(200).json({
      status: 'success',
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalId: withdrawalResult.rows[0].id,
        amount: parseFloat(amount),
        status: 'pending',
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error processing withdrawal request:', error);
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
       FROM withdrawals 
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
