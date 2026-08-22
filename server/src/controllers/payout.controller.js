import nodemailer from 'nodemailer';
import Organizer from '../models/organizer.model.js';
import { AppError } from '../utils/errorHandler.js';

// Email configuration for Zoho Mail
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
 * Request a payout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requestPayout = async (req, res, next) => {
  try {
    // Get organizer ID from authenticated user
    const organizerId = req.user.id;
    const { name, method, ...details } = req.body;
    
    // Find the organizer
    const organizer = await Organizer.findById(organizerId);
    if (!organizer) {
      throw new AppError('Organizer not found', 404);
    }

    if (!name || !method) {
      throw new AppError('Name and payment method are required', 400);
    }

    // Validate payment method
    if (!['mpesa', 'bank'].includes(method)) {
      throw new AppError('Invalid payment method. Must be either "mpesa" or "bank"', 400);
    }

    // Validate required fields based on payment method
    if (method === 'mpesa' && (!details.mpesaNumber || !details.registeredName)) {
      throw new AppError('M-Pesa number and registered name are required', 400);
    }

    if (method === 'bank' && (!details.bankName || !details.accountNumber)) {
      throw new AppError('Bank name and account number are required', 400);
    }

    // Prepare email content
    const emailContent = `
      New Payout Request:
      -------------------
      Organizer ID: ${organizerId}
      Organizer Name: ${name || organizer.name}
      Email: ${organizer.email}
      Payout Method: ${method.toUpperCase()}
      
      Payout Details:
      ${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n')}
      
      Please process this payout request as soon as possible.
    `;

    // Send email
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
      to: process.env.SUPPORT_EMAIL,
      subject: `Payout Request - ${organizer.full_name || 'Organizer'}`,
      text: emailContent,
    });

    res.status(200).json({
      success: true,
      message: 'Payout request submitted successfully',
    });
  } catch (error) {
    console.error('Error processing payout request:', error);
    next(error);
  }
};

/**
 * Get payout history for an organizer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getPayoutHistory = async (req, res, next) => {
  try {
    // In a real implementation, you would fetch this from your database
    // For now, we'll return an empty array
    res.status(200).json({
      success: true,
      data: [],
    });
  } catch (error) {
    next(error);
  }
};
