// Seller auth handlers (login, register, session, email verification, password).
// Split from seller.controller.js in Phase 15.7b; re-exported via that barrel.
import AuthService from '../services/auth.service.js';
import ReferralService from '../services/referral.service.js';
import logger from '../shared/utils/logger.js';
import { getTokenFromRequest, verifyToken } from '../shared/utils/jwt.js';
import { generateRefreshToken } from '../shared/utils/refreshToken.js';
import { setAuthCookie } from '../shared/utils/cookie.utils.js';
import { sanitizeSeller } from '../shared/utils/sanitize.js';

// Helper to send token via cookie
const sendTokenResponse = (data, statusCode, res, message) => {
  const { user, profile, token } = data;

  setAuthCookie(res, token);

  // Long-lived rolling refresh token so the mobile app can silently renew the
  // 24h access token and keep the seller logged in across app restarts.
  const refreshToken = user?.id ? generateRefreshToken(user.id, 'seller') : undefined;

  const registrationMessage = statusCode === 201
    ? 'Account created! Please verify your email before listing products.'
    : message;

  // Ensure is_verified is attached for sanitization (Task 10 fix)
  if (user && profile) {
    profile.is_verified = user.is_verified;
  }

  res.status(statusCode).json({
    status: 'success',
    message: (statusCode === 201 && !user?.is_verified)
      ? 'Account created! Please verify your email before listing products.'
      : (statusCode === 201 ? 'Account updated!' : message),
    data: {
      seller: sanitizeSeller(profile),
      token: token,
      refreshToken: refreshToken,
      user: { email: user.email, role: user.role, is_verified: user.is_verified },
      emailVerificationRequired: !user?.is_verified,
      emailVerificationSent: statusCode === 201 && !user?.is_verified
    }
  });
};

export const logout = async (req, res) => {
  // Blacklist the current token so it can't be reused
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      const decoded = verifyToken(token);
      const tokenBlacklist = (await import('../services/tokenBlacklist.service.js')).default;
      await tokenBlacklist.addToken(token, decoded.exp);
    } catch (err) {
      // Token may be invalid/expired — that's fine, just clear cookies
      logger.debug('[LOGOUT] Could not blacklist token:', err.message);
    }
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: new Date(0),
    path: '/'
  };
  res.cookie('jwt', '', cookieOptions);
  res.cookie('token', '', cookieOptions);
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};

export const register = async (req, res) => {
  try {
    // Register logic delegated to AuthService
    const result = await AuthService.register(req.body, 'seller');

    // If verification is required, don't login or issue token
    if (result.status === 'pending_verification') {
      return res.status(200).json({
        status: 'success',
        message: 'Registration received! Please check your email to verify your account before logging in.',
        data: {
          email: result.email,
          emailVerificationRequired: true,
          emailVerificationSent: true
        }
      });
    }

    // Auto-login for existing users added to seller role
    const loginData = await AuthService.login(req.body.email, req.body.password, 'seller');

    sendTokenResponse(loginData, 201, res, 'Registration successful');

    // ── Referral hook (post-response, non-blocking) ──
    const refCode = req.body.referralCode || req.body.referral_code || req.query.ref;
    if (refCode) {
      const newSellerId = loginData?.profile?.id;
      if (newSellerId) {
        ReferralService.applyReferral(newSellerId, refCode).catch((err) =>
          logger.warn(`[REFERRAL] applyReferral failed: ${err.message}`)
        );
      }
    }
  } catch (error) {
    if (error.message.includes('exists')) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password, 'seller');

    if (!data) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    sendTokenResponse(data, 200, res, 'Login successful');
  } catch (e) {
    // Role mismatch — give clear, actionable message
    if (e.isRoleMismatch) {
      return res.status(401).json({
        status: 'error',
        message: e.message, // "Wrong portal. This account is registered as a buyer."
        code: 'WRONG_PORTAL'
      });
    }
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({
        status: 'error',
        message: e.message,
        code: 'EMAIL_NOT_VERIFIED',
        email: e.email,
        userType: e.userType
      });
    }

    if (e.code === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        status: 'error',
        message: e.message,
        code: 'PENDING_VERIFICATION',
        email: e.email,
        userType: e.userType
      });
    }
    if (e.code === 'TERMS_NOT_ACCEPTED') {
      return res.status(403).json({
        status: 'error',
        message: e.message,
        code: 'TERMS_NOT_ACCEPTED',
        email: e.email,
        userType: e.userType
      });
    }
    console.error('Seller login error:', e);
    res.status(500).json({ status: 'error', message: 'Login failed. Please try again.' });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/sellers/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body; // Added email requirement

    if (!token || !newPassword || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Token, email, and new password are required'
      });
    }

    try {
      await AuthService.resetPassword(email, token, newPassword);
    } catch (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Invalid or expired token'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while resetting your password.'
    });
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

    return res.status(200).json({
      status: 'success',
      message: result.alreadyVerified
        ? 'Your email is already verified. You can log in.'
        : 'Email verified successfully! You can now log in.',
      data: {
        alreadyVerified: result.alreadyVerified,
        email: result.user.email
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
      return res.status(400).json({ status: 'error', message: 'Email is required' })
    }
    await AuthService.resendVerificationEmail(email.toLowerCase().trim(), 'seller')
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    })
  } catch (error) {
    logger.error('Seller resend verification failed:', error.message)
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    })
  }
}

/**
 * @desc    Forgot password
 * @route   POST /api/sellers/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an email address'
      });
    }

    await AuthService.forgotPassword(email, 'seller');

    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while processing your request'
    });
  }
};
