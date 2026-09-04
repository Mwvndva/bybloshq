import BuyerService from './buyer.service.js';
import Buyer from './buyer.model.js';
import User from '../../identity/users/user.model.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import { sanitizeBuyer, sanitizeOrder, sanitizeWithdrawalRequest } from '../../../shared/utils/sanitize.js';
import logger from '../../../shared/utils/logger.js';
import AuthService from '../../identity/auth/auth.service.js';
import { setAuthCookie } from '../../../shared/utils/cookie.utils.js';
import { signToken, verifyToken } from '../../../shared/utils/jwt.js';
import { generateRefreshToken } from '../../../shared/utils/refreshToken.js';
import { revokeSessionTokens, clearAuthCookies } from '../../../shared/utils/sessionRevocation.js';
import OrderModel from "../../orders/order/order.model.js";
import { OrderStatus } from "../../../shared/constants/enums.js";
import WithdrawalService from '../../payments/withdrawals/withdrawal.service.js';
import { pool } from '../../../infrastructure/database/database.js';
import { addBusinessDays } from '../../orders/escrow/settlement.service.js';
import Fees from '../../../shared/config/fees.js';

// Helper to send token via cookie
const createSendToken = (data, statusCode, req, res, next) => {
  let token, buyer, user;

  if (data.token && data.profile) {
    // Standard AuthService format
    token = data.token;
    buyer = data.profile;
    user = data.user;
  } else {
    // Legacy direct buyer object
    buyer = data;
    const userId = buyer.user_id || buyer.userId;
    if (!userId) {
      // Cannot issue token — buyer not linked to users table
      logger.error('[AUTH] Cannot create token: buyer has no user_id', buyer.id);
      return next(new AppError('Authentication error. Please contact support.', 500));
    }
    token = signToken(userId, 'buyer');
  }

  setAuthCookie(res, token);
  if (buyer.password) buyer.password = undefined;

  // Long-lived rolling refresh token: lets the mobile app silently renew the 24h
  // access token so a buyer stays logged in without re-entering their details.
  const buyerUserId = user?.id || buyer?.user_id || buyer?.userId;
  const refreshToken = buyerUserId ? generateRefreshToken(buyerUserId, 'buyer') : undefined;

  // Ensure is_verified is attached to profile for sanitization
  if (user && user.is_verified !== undefined) {
    buyer.is_verified = user.is_verified;
  }

  return res.status(statusCode).json({
    status: 'success',
    message: (statusCode === 201 && !user?.is_verified)
      ? 'Account created! Please check your email to verify your account.'
      : (statusCode === 201 ? 'Account updated!' : undefined),
    data: {
      buyer: sanitizeBuyer(buyer),
      token: token,
      refreshToken: refreshToken,
      emailVerificationRequired: !user?.is_verified,
      emailVerificationSent: statusCode === 201 && !user?.is_verified
    }
  });
};

export const logout = async (req, res) => {
  // Revoke BOTH the access token and the refresh token so the session truly ends.
  await revokeSessionTokens(req);
  clearAuthCookies(res);
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
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

    try {
      // Delegate to AuthService
      const result = await AuthService.register(req.body, 'buyer');

      if (result.status === 'pending_verification') {
        return res.status(200).json({
          status: 'success',
          message: 'Account pending verification! Please check your email to complete your registration.',
          data: {
            email: result.email,
            emailVerificationRequired: true,
            emailVerificationSent: true
          }
        });
      }

      // Auto-login for existing users added to buyer role
      const loginData = await AuthService.login(req.body.email, password, 'buyer');

      createSendToken(loginData, 201, req, res);
    } catch (err) {
      if (err.code === '23505') return next(new AppError('Email already in use', 400));
      // Handle manual duplications checks from Service
      if (err.message && (
        err.message.includes('A buyer account with this email already exists') ||
        err.message.includes('An account with this email already exists')
      )) {
        return next(new AppError(err.message, 409));
      }
      throw err;
    }

  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const data = await AuthService.login(email, password, 'buyer');
    if (!data) {
      return next(new AppError('Invalid email or password', 401));
    }

    createSendToken(data, 200, req, res, next);
  } catch (error) {
    if (error.isRoleMismatch) {
      return res.status(401).json({
        status: 'error',
        message: error.message,
        code: 'WRONG_PORTAL'
      });
    }
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({
        status: 'error',
        message: error.message,
        code: 'EMAIL_NOT_VERIFIED',
        email: error.email,
        userType: error.userType
      });
    }

    if (error.code === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        status: 'error',
        message: error.message,
        code: 'PENDING_VERIFICATION',
        email: error.email,
        userType: error.userType
      });
    }

    if (error.code === 'TERMS_NOT_ACCEPTED') {
      return res.status(403).json({
        status: 'error',
        message: error.message,
        code: 'TERMS_NOT_ACCEPTED',
        email: error.email,
        userType: error.userType
      });
    }
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

    await AuthService.forgotPassword(email, 'buyer');

    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while processing your request'
    });
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, email } = req.body; // Added email

    // 1) Validate input
    if (!token || !newPassword || !email) {
      return next(new AppError('Token, email, and new password are required', 400));
    }

    // 2) Reset password using AuthService
    try {
      await AuthService.resetPassword(email, token, newPassword);
    } catch (err) {
      return next(new AppError(err.message || 'Invalid or expired token', 400));
    }

    // 3) Log the buyer in, send JWT
    const data = await AuthService.login(email, newPassword, 'buyer');

    createSendToken(data, 200, req, res);
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query

    if (!token || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and email are required'
      })
    }

    const result = await AuthService.verifyEmail(email, token)

    // Verification doubles as login (magic-link): a valid token proves the person
    // controls this email, so issue a buyer session and land them signed in — the
    // Android deep-link uses this to drop straight into the orders tab. (verifyEmail
    // throws on an invalid/expired token, so reaching here means it was valid.)
    let sessionToken = null
    if (result.user?.id && result.user.role === 'buyer') {
      sessionToken = signToken(result.user.id, 'buyer')
      setAuthCookie(res, sessionToken)
    }

    return res.status(200).json({
      status: 'success',
      message: sessionToken
        ? 'Email verified — you are now signed in.'
        : (result.alreadyVerified
          ? 'Your email is already verified. You can log in.'
          : 'Email verified successfully! You can now log in.'),
      data: {
        alreadyVerified: result.alreadyVerified,
        email: result.user.email,
        ...(sessionToken ? { token: sessionToken, autoLoggedIn: true } : {})
      }
    })
  } catch (error) {
    logger.error('Email verification failed:', error.message)
    return res.status(400).json({
      status: 'error',
      message: error.message
    })
  }
}

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      })
    }

    await AuthService.resendVerificationEmail(email.toLowerCase().trim(), 'buyer')

    // Always return 200 to prevent email enumeration
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    })
  } catch (error) {
    logger.error('Resend verification failed:', error.message)
    // Still return 200 — do not reveal whether email exists
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    })
  }
}


// Order fetching functionality has been removed

export const getProfile = async (req, res, next) => {
  try {
    // Primary: buyers.id, set by auth crossRoles query
    const buyerLookupId = req.user.buyerId;
    let buyer = buyerLookupId ? await Buyer.findById(buyerLookupId) : null;

    // Fallback: find by user_id
    const userId = req.user.userId || req.user.id;
    if (!buyer && userId) {
      buyer = await Buyer.findByUserId(userId);
    }

    // If authenticated user lacks a buyer profile, auto-provision one seamlessly
    if (!buyer && userId) {
      const user = await User.findById(userId);
      if (user) {
        buyer = await Buyer.create({
          fullName: user.full_name || user.email?.split('@')[0] || 'Buyer',
          email: user.email,
          mobilePayment: user.phone || '',
          whatsappNumber: user.phone || '',
          city: 'Nairobi',
          location: 'Nairobi',
          userId: user.id,
          termsAccepted: true
        });
        logger.info(`[BUYER-PROFILE] Auto-provisioned buyer profile for user ${userId}`);
      }
    }

    if (!buyer) {
      return next(new AppError('No buyer profile found for this account', 404));
    }

    // Add verification status from req.user (Task 10 fix)
    buyer.is_verified = req.user.is_verified;

    res.status(200).json({
      status: 'success',
      data: { buyer: sanitizeBuyer(buyer) }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    // 1) Filter out unwanted fields that are not allowed to be updated directly
    // password is handled separately
    const { password, passwordConfirm, ...rawUpdateData } = req.body;
    const allowedProfileFields = new Set([
      'fullName',
      'mobilePayment',
      'whatsappNumber',
      'city',
      'location',
      'latitude',
      'longitude',
      'fullAddress'
    ]);
    const updateData = Object.fromEntries(
      Object.entries(rawUpdateData).filter(([key]) => allowedProfileFields.has(key))
    );

    // 2) Security: Basic Input Validation for Phones
    const phoneRegex = /^(\+?254|0)?[17]\d{8}$/; // Matches 07xx or 01xx or +2547xx

    if (updateData.whatsappNumber && !phoneRegex.test(updateData.whatsappNumber)) {
      // Allow empty string if user is clearing it, but valid if provided
      if (updateData.whatsappNumber.trim() !== '') {
        return next(new AppError('Invalid WhatsApp number format. Use 07... or 01...', 400));
      }
    }

    if (updateData.mobilePayment && !phoneRegex.test(updateData.mobilePayment)) {
      if (updateData.mobilePayment.trim() !== '') {
        return next(new AppError('Invalid Mobile Payment number format. Use 07... or 01...', 400));
      }
    }

    // 3) If password is being updated, handle it separately
    if (password) {
      if (password !== passwordConfirm) {
        return next(new AppError('Passwords do not match', 400));
      }
      // B-2 FIX: Use unified User model for password updates
      await User.updatePassword(req.user.id, password);
    }

    // 4) If there's nothing else to update, return early
    if (Object.keys(updateData).length === 0 && !password) {
      const currentUser = await Buyer.findById(req.user.buyerId);
      return res.status(200).json({
        status: 'success',
        message: 'No profile updates provided',
        data: {
          buyer: sanitizeBuyer(currentUser)
        }
      });
    }

    // 5) Update other buyer data
    let updatedBuyer = null;
    if (Object.keys(updateData).length > 0) {
      updatedBuyer = await Buyer.update(req.user.buyerId, updateData);
    } else {
      updatedBuyer = await Buyer.findById(req.user.buyerId);
    }

    if (!updatedBuyer) {
      logger.error('Failed to update buyer profile');
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
    logger.error('Error in updateProfile:', error);
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
      // logger.info('Buyer found with phone');

      // SECURITY FIX: Do not generate token here
      // const token = signToken(existingBuyer.id, 'buyer');

      res.status(200).json({
        status: 'success',
        data: {
          exists: true,
          buyer: {
            hasEmail: !!existingBuyer.email,
          }
        }
      });
    } else {
      res.status(200).json({
        status: 'success',
        data: {
          exists: false
        }
      });
    }
  } catch (error) {
    logger.error('Error in checkBuyerByPhone:', error);
    next(error);
  }
};

/**
 * Helper to compute a buyer's T+2 refund clearance state.
 * T+2 holding period applies 2 business days from the moment a refund is credited.
 */
export async function getBuyerRefundClearance(buyerId) {
  const [buyerResult, refundRequestsResult, refundedOrdersResult] = await Promise.all([
    pool.query(`SELECT refunds, mobile_payment, whatsapp_number, full_name FROM buyers WHERE id = $1`, [buyerId]),
    pool.query(
      `SELECT id, amount, processed_at, updated_at, requested_at, payment_details
       FROM refund_requests
       WHERE buyer_id = $1 AND status = 'completed'
       ORDER BY COALESCE(processed_at, updated_at, requested_at) DESC`,
      [buyerId]
    ),
    pool.query(
      `SELECT id, total_amount AS amount, updated_at
       FROM product_orders
       WHERE buyer_id = $1 AND status = 'REFUNDED'
         AND id NOT IN (SELECT order_id FROM refund_requests WHERE buyer_id = $1 AND order_id IS NOT NULL)
       ORDER BY updated_at DESC`,
      [buyerId]
    )
  ]);

  const buyer = buyerResult.rows[0];
  const totalRefunds = Number.parseFloat(buyer?.refunds || 0);

  let unclearedAmount = 0;
  let nextAvailableAt = null;
  const now = new Date();

  // Aggregate all completed refund events
  const allEvents = [
    ...refundRequestsResult.rows.map(rr => ({
      amount: Number.parseFloat(rr.amount || 0),
      creditedAt: rr.payment_details?.credited_at
        ? new Date(rr.payment_details.credited_at)
        : new Date(rr.processed_at || rr.updated_at || rr.requested_at)
    })),
    ...refundedOrdersResult.rows.map(po => ({
      amount: Number.parseFloat(po.amount || 0),
      creditedAt: new Date(po.updated_at)
    }))
  ];

  for (const event of allEvents) {
    if (!Number.isFinite(event.amount) || event.amount <= 0) continue;
    const availableTime = addBusinessDays(event.creditedAt, 2);
    if (now < availableTime) {
      unclearedAmount += event.amount;
      if (!nextAvailableAt || availableTime < nextAvailableAt) {
        nextAvailableAt = availableTime;
      }
    }
  }

  const clearingBalance = Math.min(totalRefunds, unclearedAmount);
  const availableBalance = Math.max(0, totalRefunds - clearingBalance);

  return {
    totalRefunds,
    availableBalance,
    clearingBalance,
    nextAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
    isClearing: clearingBalance > 0,
    buyerPhone: buyer?.mobile_payment || buyer?.whatsapp_number || '',
    buyerName: buyer?.full_name || ''
  };
}

/**
 * Get buyer's pending refund requests and T+2 clearance status
 */
export const getPendingRefundRequests = async (req, res, next) => {
  try {
    const buyerId = req.user.buyerId;
    const [pendingWithdrawalsResult, clearance] = await Promise.all([
      WithdrawalService.getRefundWithdrawalsForBuyer(buyerId, {
        status: 'processing',
        limit: 50
      }),
      getBuyerRefundClearance(buyerId)
    ]);

    const pendingRequests = pendingWithdrawalsResult.rows;

    res.status(200).json({
      status: 'success',
      data: {
        pendingRequests: pendingRequests.map(request => sanitizeWithdrawalRequest(request)),
        hasPending: pendingRequests.length > 0,
        ...clearance
      }
    });
  } catch (error) {
    logger.error('Error fetching pending refund requests:', error);
    next(error);
  }
};

/**
 * Request refund withdrawal
 * Enforces minimum withdrawal amount (KSh 50), withdrawal charges, and T+2 clearance.
 */
export const requestRefund = async (req, res, next) => {
  try {
    const { amount, mpesaNumber, mpesaName } = req.body;
    const buyerId = req.user.buyerId;

    const withdrawalAmount = Number.parseFloat(amount);
    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount < Fees.MIN_WITHDRAWAL_AMOUNT) {
      return next(new AppError(`Minimum withdrawal amount is KES ${Fees.MIN_WITHDRAWAL_AMOUNT}`, 400));
    }

    const withdrawalFee = Fees.calculateWithdrawalFee(withdrawalAmount);
    const totalDeducted = withdrawalAmount + withdrawalFee;

    const clearance = await getBuyerRefundClearance(buyerId);

    if (totalDeducted > clearance.availableBalance) {
      if (totalDeducted <= clearance.totalRefunds && clearance.clearingBalance > 0) {
        const nextDateStr = clearance.nextAvailableAt
          ? new Date(clearance.nextAvailableAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'soon';
        return next(new AppError(
          `Your withdrawal of KES ${withdrawalAmount.toLocaleString()} requires KES ${totalDeducted.toLocaleString()} from your balance (including KES ${withdrawalFee} withdrawal charge). KES ${clearance.clearingBalance.toLocaleString()} is currently clearing under the standard T+2 holding period and will be ready for withdrawal on ${nextDateStr}.`,
          400
        ));
      }
      return next(new AppError(
        `Insufficient available balance. Available: KES ${clearance.availableBalance.toLocaleString()}, Required: KES ${totalDeducted.toLocaleString()} (including KES ${withdrawalFee} withdrawal charge).`,
        400
      ));
    }

    const payoutPhone = mpesaNumber || clearance.buyerPhone;
    const payoutName = mpesaName || clearance.buyerName;

    const request = await WithdrawalService.createWithdrawalRequest({
      entityId: buyerId,
      entityType: 'buyer_refund',
      amount: withdrawalAmount,
      mpesaNumber: payoutPhone,
      mpesaName: payoutName,
      idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey || `refund-w-${buyerId}-${Date.now()}`
    });

    logger.info(`Refund withdrawal request created: ${request.id} for buyer ${buyerId}, amount: ${withdrawalAmount}, fee: ${withdrawalFee}, total: ${totalDeducted}`);

    res.status(201).json({
      status: 'success',
      message: 'Refund withdrawal submitted successfully. You will be notified once processed.',
      data: {
        requestId: request.id,
        withdrawal: sanitizeWithdrawalRequest(request),
        withdrawalFee,
        totalDeducted
      }
    });
  } catch (error) {
    logger.error('Error in requestRefund:', error);
    next(error);
  }
};

import { z } from 'zod';

const buyerInfoSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  mobilePayment: z.string().optional(),
  whatsappNumber: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  location: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).refine(data => data.phone || data.mobilePayment || data.whatsappNumber, {
  message: "At least one contact method (phone, mobilePayment, or whatsappNumber) is required",
  path: ["phone"]
});

export const saveBuyerInfo = async (req, res, next) => {
  try {
    // 1. Validate body
    const validatedData = buyerInfoSchema.parse(req.body);
    const {
      fullName, email, phone, mobilePayment, whatsappNumber,
      city, location, password
    } = validatedData;

    const effectivePhone = phone || mobilePayment || whatsappNumber;

    // Add validation:
    if (!req.body.termsAccepted) {
      return next(new AppError('You must accept the Terms and Conditions to continue.', 400));
    }

    // 2. Register buyer immediately (follows pending registration flow)
    let result;
    try {
      result = await BuyerService.registerGuest({
        fullName,
        email,
        phone: normalizePhoneNumber(effectivePhone),
        mobilePayment: mobilePayment || effectivePhone,
        whatsappNumber: whatsappNumber || effectivePhone,
        city,
        location: location || city || 'Not specified', // FIXED BUG-GUEST-02: fallback prevents null
        password,
        termsAccepted: req.body.termsAccepted === true // Explicitly from frontend
      });
      if (result.status === 'identity_required') {
        result = await AuthService.registerGuestBuyer(result.registrationData);
      }
    } catch (err) {
      if (err.requiresLogin) {
        return res.status(200).json({
          status: 'success',
          data: { requiresLogin: true, exists: true, buyer: { email } }
        });
      }
      throw err;
    }

    // 3. Handle pending verification (Verify-Before-Create)
    if (result.status === 'pending_verification') {
      return res.status(200).json({
        status: 'success',
        data: {
          emailVerificationRequired: true,
          email: result.email,
          message: 'Please verify your email address to complete your account setup. You can still proceed with your purchase now.'
        }
      });
    }

    // 4. Handle immediate creation (e.g. if user already existed)
    const buyerProfile = result.buyer || result.user;
    if (!buyerProfile) {
      throw new Error('Failed to create or retrieve buyer profile');
    }

    // SECURITY FIX: Ensure the user is verified before issuing a token
    const userId = buyerProfile.user_id || buyerProfile.userId;
    const user = await User.findById(userId);

    if (user && !user.is_verified) {
      return res.status(200).json({
        status: 'success',
        data: {
          emailVerificationRequired: true,
          email: user.email,
          message: 'Your account is pending verification. Please check your email to complete your account setup.'
        }
      });
    }

    const token = BuyerService.signToken(buyerProfile);

    // 5. Set auth cookie
    setAuthCookie(res, token);

    return res.status(200).json({
      status: 'success',
      data: { buyer: sanitizeBuyer(buyerProfile) }
    });

  } catch (error) {
    logger.error('Error in saveBuyerInfo:', error);
    next(error);
  }
};

export const autoLogin = async (req, res, next) => {
  try {
    const { autoLoginToken } = req.body;

    if (!autoLoginToken) {
      return next(new AppError('Auto-login token is required', 400));
    }

    // Verify the token
    let decoded;
    try {
      decoded = verifyToken(autoLoginToken);
    } catch (err) {
      return next(new AppError('Invalid or expired auto-login token', 401));
    }

    // Verify it's actually an auto-login token (not a regular JWT)
    if (!decoded.autoLogin || decoded.purpose !== 'payment_success') {
      return next(new AppError('Invalid token type', 401));
    }

    // Fetch the buyer profile
    const buyer = await Buyer.findByUserId(decoded.id);
    if (!buyer) {
      return next(new AppError('Buyer profile not found', 404));
    }

    // Exchange the short-lived auto-login token for a normal buyer session cookie.
    const sessionToken = signToken(decoded.id, 'buyer');
    setAuthCookie(res, sessionToken);

    logger.info(`[AUTO-LOGIN] Buyer ${buyer.id} auto-logged in after payment success`);

    return res.status(200).json({
      status: 'success',
      message: 'Logged in successfully',
      data: {
        buyer: sanitizeBuyer(buyer),
        redirectTo: '/buyer/orders' // tells frontend where to go
      }
    });

  } catch (error) {
    logger.error('Error in autoLogin:', error);
    next(error);
  }
};

export const markOrderAsCollected = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const buyerId = req.user.buyerId;  // buyers.id from crossRoles

    if (!buyerId) {
      return next(new AppError('No buyer profile found. Cannot collect order.', 403));
    }

    const orderData = await OrderModel.findById(orderId);
    if (!orderData) {
      return next(new AppError('Order not found', 404));
    }

    // Compare buyers.id with buyers.id
    if (String(orderData.buyerId) !== String(buyerId)) {
      return next(new AppError('You can only collect your own orders', 403));
    }

    const updatedOrder = await OrderService.markAsCollected(orderId, buyerId);

    res.status(200).json({
      status: 'success',
      data: { order: sanitizeOrder(updatedOrder, 'buyer') }
    });
  } catch (error) {
    next(error);
  }
};


// Self-service account deletion (Google Play data-deletion requirement).
export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    let buyerId = req.user.buyerId;
    if (!buyerId && userId) {
      const buyer = await Buyer.findByUserId(userId);
      buyerId = buyer?.id;
    }
    if (!buyerId) {
      return next(new AppError('Buyer account not found.', 404));
    }
    await Buyer.softDeleteAccount(buyerId, userId);
    res.clearCookie('token');
    res.status(200).json({ status: 'success', message: 'Your account has been deleted.' });
  } catch (error) {
    next(error);
  }
};
