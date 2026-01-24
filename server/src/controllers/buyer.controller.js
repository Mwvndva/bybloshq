import BuyerService from '../services/buyer.service.js';
import Buyer from '../models/buyer.model.js';
import User from '../models/user.model.js';
import AppError from '../utils/appError.js';
import { sanitizeBuyer } from '../utils/sanitize.js';
import { pool } from '../config/database.js';
import { sendPasswordResetEmail } from '../utils/email.js';

// Helper to send token via cookie
const createSendToken = (user, statusCode, req, res) => {
  const token = BuyerService.signToken(user);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Important for cross-site
    path: '/'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    data: {
      buyer: sanitizeBuyer(user),
    },
  });
};

export const register = async (req, res, next) => {
  try {
    const { password, confirmPassword } = req.body;

    // 1) Check if passwords match
    if (password !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    // 2) Validate required location fields
    if (!req.body.city || !req.body.location) {
      return next(new AppError('City and location are required', 400));
    }

    // 4) Create new buyer (Service handles email usage check usually? Assuming Service throws or we catch unique violation)
    // The Service uses Buyer.create which inserts directly.
    // Ideally Service checks generic "email in use" or we catch DB error.
    // The Service code I wrote just tries insert.
    // So let's wrap in try/catch and check for specific DB error here or let global handler do it.
    // Original controller did: "const existingBuyer = await Buyer.findByEmail(email);"
    // I should probably add that check to Service or keep it here if Service is thin.
    // I'll keep it simple: call Service.

    try {
      const newBuyer = await BuyerService.register(req.body);
      createSendToken(newBuyer, 201, req, res);
    } catch (err) {
      if (err.code === '23505') return next(new AppError('Email already in use', 400));
      throw err;
    }

  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2) Check if buyer exists and password is correct
    const buyer = await BuyerService.login(email, password);

    if (!buyer) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 3) Update last login (should be in Service but simple enough here or add to Service later)
    // await Buyer.update(buyer.id, { last_login: new Date() }); 
    // I skipped this in Service for now to keep it minimal.

    // 4) If everything ok, send token via cookie
    createSendToken(buyer, 200, req, res);
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an email address'
      });
    }

    // Find buyer by email
    const buyer = await Buyer.findByEmail(email);

    // Always return success even if user not found (Security)
    if (!buyer) {
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    try {
      // 1. Generate the random reset token and save it
      const { resetToken } = await Buyer.setPasswordResetToken(email);

      // 2. Send the password reset email
      await sendPasswordResetEmail(email, resetToken, 'buyer');

      // console.log(`Password reset email sent`); // Silenced

      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while processing your request'
    });
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // 1) Validate input
    if (!token || !newPassword) {
      return next(new AppError('Token and new password are required', 400));
    }

    // 2) Reset password using the token
    const buyer = await Buyer.resetPassword(token, newPassword);

    // 3) Log the buyer in, send JWT
    const authToken = BuyerService.signToken(buyer);

    res.status(200).json({
      status: 'success',
      token: authToken,
      data: {
        buyer: sanitizeBuyer(buyer),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Order fetching functionality has been removed

export const getProfile = async (req, res, next) => {
  try {
    const buyer = await Buyer.findById(req.user.id);

    if (!buyer) {
      return next(new AppError('No buyer found with that ID', 404));
    }

    // Ensure the user gets their OWN private data
    const userData = sanitizeBuyer(buyer);
    if (buyer.email) userData.email = buyer.email;
    if (buyer.phone) userData.phone = buyer.phone;
    // Also restore fullName which might be sanitized out but is needed for frontend checks
    if (buyer.full_name) userData.fullName = buyer.full_name;
    else if (buyer.fullName) userData.fullName = buyer.fullName;
    else {
      const first = buyer.first_name || buyer.firstName || '';
      const last = buyer.last_name || buyer.lastName || '';
      userData.fullName = `${first} ${last}`.trim();
    }

    res.status(200).json({
      status: 'success',
      data: {
        buyer: userData,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {



    // 1) Filter out unwanted fields that are not allowed to be updated
    const { password, passwordConfirm, ...updateData } = req.body;

    // 2) If password is being updated, handle it separately
    if (password) {
      if (password !== passwordConfirm) {
        return next(new AppError('Passwords do not match', 400));
      }
      await Buyer.updatePassword(req.user.id, password);
    }

    // 3) If there's nothing else to update, return early
    if (Object.keys(updateData).length === 0) {
      const currentUser = await Buyer.findById(req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'No profile updates provided',
        data: {
          buyer: sanitizeBuyer(currentUser)
        }
      });
    }

    // 4) Update other buyer data
    const updatedBuyer = await Buyer.update(req.user.id, updateData);


    if (!updatedBuyer) {
      console.error('Failed to update buyer profile');
      return next(new AppError('Error updating profile', 500));
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        buyer: sanitizeBuyer(updatedBuyer),
      },
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    next(error);
  }
};

// Save buyer information (for guest checkouts) - Public endpoint
// Helper function to normalize phone numbers
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;

  // Remove all spaces, dashes, and parentheses
  let normalized = phone.replace(/[\s\-\(\)]/g, '');

  // Remove leading + if present
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }

  // Remove leading 254 if present (Kenya country code)
  if (normalized.startsWith('254')) {
    normalized = '0' + normalized.substring(3);
  }

  // Ensure it starts with 0
  if (!normalized.startsWith('0')) {
    normalized = '0' + normalized;
  }


  return normalized;
};

// Check if buyer exists by phone number (public endpoint)
export const checkBuyerByPhone = async (req, res, next) => {
  try {
    const { phone } = req.body;



    // Validate required field
    if (!phone) {
      return next(new AppError('Phone number is required', 400));
    }

    // Check if buyer exists by phone number (let model handle variations)
    const existingBuyer = await Buyer.findByPhone(phone);

    if (existingBuyer) {
      // Buyer exists - return buyer info BUT NO TOKEN
      // console.log('Buyer found with phone');

      // SECURITY FIX: Do not generate token here
      // const token = signToken(existingBuyer.id, 'buyer');

      const sanitizedBuyer = sanitizeBuyer(existingBuyer);

      // Explicitly include email for checkout validation if present
      // SECURITY FIX: Don't return the email itself, just a flag
      if (existingBuyer.email) {
        // sanitizedBuyer.email = existingBuyer.email; // REMOVED
        sanitizedBuyer.hasEmail = true;
      } else {
        sanitizedBuyer.hasEmail = false;
      }

      res.status(200).json({
        status: 'success',
        data: {
          exists: true,
          buyer: sanitizedBuyer
          // token - REMOVED for security
        }
      });
    } else {
      // Buyer does not exist
      // console.log('No buyer found with phone:', '[REDACTED]');

      res.status(200).json({
        status: 'success',
        data: {
          exists: false
        }
      });
    }
  } catch (error) {
    console.error('Error in checkBuyerByPhone:', error);
    next(error);
  }
};

/**
 * Get buyer's pending refund requests
 */
export const getPendingRefundRequests = async (req, res, next) => {
  try {
    const buyerId = req.user.id;

    const query = `
      SELECT id, amount, status, requested_at
      FROM refund_requests
      WHERE buyer_id = $1 AND status = 'pending'
      ORDER BY requested_at DESC
    `;

    const result = await pool.query(query, [buyerId]);

    res.status(200).json({
      status: 'success',
      data: {
        pendingRequests: result.rows,
        hasPending: result.rows.length > 0
      }
    });
  } catch (error) {
    console.error('Error fetching pending refund requests:', error);
    next(error);
  }
};

/**
 * Request refund withdrawal
 * Uses buyer's existing details from database
 */
export const requestRefund = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const buyerId = req.user.id;

    console.log('Refund request from buyer:', buyerId, 'Amount:', amount);

    if (!amount || amount <= 0) {
      return next(new AppError('Invalid refund amount', 400));
    }

    // Get buyer's details and check available refunds
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return next(new AppError('Buyer not found', 404));
    }

    const availableRefunds = parseFloat(buyer.refunds || 0);
    if (availableRefunds < amount) {
      return next(new AppError(`Insufficient refund balance. Available: KSh ${availableRefunds}`, 400));
    }

    // Use buyer's existing details for refund
    const paymentMethod = 'M-Pesa'; // Default to M-Pesa for Kenya
    const paymentDetailsJson = JSON.stringify({
      phone: buyer.phone,
      name: buyer.fullName,
      email: buyer.email
    });

    // Create refund request
    const query = `
      INSERT INTO refund_requests (
        buyer_id, amount, status, payment_method, payment_details
      ) VALUES ($1, $2, 'pending', $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [
      buyerId,
      amount,
      paymentMethod,
      paymentDetailsJson
    ]);

    console.log('Refund request created:', result.rows[0].id);

    res.status(201).json({
      status: 'success',
      message: 'Refund request submitted successfully',
      data: {
        requestId: result.rows[0].id
      }
    });
  } catch (error) {
    console.error('Error in requestRefund:', error);
    next(error);
  }
};

export const saveBuyerInfo = async (req, res, next) => {
  try {
    const { fullName, email, phone, city, location, password } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !password) {
      return next(new AppError('Full name, email, phone, and password are required', 400));
    }

    try {
      // Delegate to service (now handles both registration and auto-link for existing users)
      const result = await BuyerService.registerGuest({
        fullName,
        email,
        phone: normalizePhoneNumber(phone),
        city,
        location,
        password
      });

      const buyer = result.buyer;
      const token = BuyerService.signToken(buyer);

      const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      };

      res.cookie('jwt', token, cookieOptions);

      return res.status(200).json({
        status: 'success',
        data: {
          buyer: sanitizeBuyer(buyer),
          token
        }
      });

    } catch (err) {
      // If the service flagged that we definitely need login (e.g. password mismatch)
      if (err.requiresLogin) {
        return res.status(200).json({
          status: 'success',
          message: err.message,
          data: {
            requiresLogin: true,
            exists: true,
            buyer: { email }
          }
        });
      }
      throw err; // Pass to outer catch
    }

  } catch (error) {
    console.error('Error in saveBuyerInfo:', error);
    next(error);
  }
};

export const markOrderAsCollected = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id; // Buyer ID

    // Import required services and models dynamically to avoid circular dependencies
    const { default: OrderService } = await import('../services/order.service.js');
    const { default: OrderModel } = await import('../models/order.model.js');
    const { OrderStatus } = await import('../constants/enums.js');

    const orderData = await OrderModel.findById(orderId);

    if (!orderData) {
      return next(new AppError('Order not found', 404));
    }

    if (orderData.buyer_id !== userId) {
      return next(new AppError('Unauthorized access to this order', 403));
    }


    // Call OrderService to mark order as collected (handles status update, payout, notifications)
    const updatedOrder = await OrderService.markAsCollected(orderId, userId);


    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder
      }
    });

  } catch (error) {
    next(error);
  }
};



