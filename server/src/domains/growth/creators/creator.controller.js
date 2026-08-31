import CreatorService from './creator.service.js';
import AuthService from '../../identity/auth/auth.service.js';
import WithdrawalService from '../../payments/withdrawals/withdrawal.service.js';
import { revokeSessionTokens, clearAuthCookies } from '../../../shared/utils/sessionRevocation.js';
import { sanitizeWithdrawalRequest } from '../../../shared/utils/sanitize.js';
import { setAuthCookie } from '../../../shared/utils/cookie.utils.js';
import { generateRefreshToken } from '../../../shared/utils/refreshToken.js';
import logger from '../../../shared/utils/logger.js';

const sanitizeCreator = (creator = {}) => ({
  id: creator.id,
  userId: creator.user_id,
  firstName: creator.first_name,
  lastName: creator.last_name,
  email: creator.email,
  mpesaNumber: creator.mpesa_number,
  whatsappNumber: creator.whatsapp_number,
  balance: Number(creator.balance || 0),
  totalSales: Number(creator.total_sales || 0),
  totalEarnings: Number(creator.total_earnings || 0),
  referralCode: creator.referral_code,
  totalReferralEarnings: Number(creator.total_referral_earnings || 0),
  status: creator.status,
  createdAt: creator.created_at
});

export const inviteCreator = async (req, res, next) => {
  try {
    const invite = await CreatorService.inviteCreator({
      sellerId: req.user.sellerId,
      invitedByUserId: req.user.userId || req.user.id,
      email: req.body.email
    });
    res.status(201).json({ status: 'success', data: { invite } });
  } catch (error) {
    next(error);
  }
};

export const listSellerInvites = async (req, res, next) => {
  try {
    const invites = await CreatorService.listSellerInvites(req.user.sellerId);
    res.status(200).json({ status: 'success', data: { invites } });
  } catch (error) {
    next(error);
  }
};

export const getInvite = async (req, res, next) => {
  try {
    const invite = await CreatorService.getInviteByToken(req.params.token);
    res.status(200).json({
      status: 'success',
      data: {
        invite: {
          email: invite.email,
          sellerName: invite.seller_name,
          shopName: invite.shop_name,
          expiresAt: invite.expires_at
        }
      }
    });
  } catch (error) {
    const message = error.message || 'Invalid or expired creator invite.';
    if (message.includes('already been used')) {
      return res.status(409).json({ status: 'fail', message });
    }
    if (message.includes('not found') || message.includes('expired')) {
      return res.status(404).json({ status: 'fail', message });
    }
    return res.status(400).json({ status: 'fail', message });
  }
};

export const register = async (req, res, next) => {
  try {
    const result = req.body.token
      ? await CreatorService.registerFromInvite(req.body)
      : await CreatorService.registerDirect(req.body);
    res.status(201).json({
      status: 'success',
      message: result.status === 'created'
        ? 'Creator access added. You can now log in.'
        : 'Creator account created. Please verify your email before logging in.',
      data: result
    });
  } catch (error) {
    const message = error.message || 'Could not register creator account.';
    if (message.includes('already been used') || message.includes('already registered')) {
      return res.status(409).json({ status: 'fail', message });
    }
    if (message.includes('not found') || message.includes('expired')) {
      return res.status(404).json({ status: 'fail', message });
    }
    if (error.code === 'EXISTING_ACCOUNT' || message.includes('already has a Byblos account')) {
      return res.status(400).json({
        status: 'fail',
        code: 'EXISTING_ACCOUNT',
        message,
        data: error.existingRoles || {}
      });
    }
    if (message.includes('required') || message.includes('do not match') || message.includes('email')) {
      return res.status(400).json({ status: 'fail', message });
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await CreatorService.login(req.body.email, req.body.password);
    if (!result) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    setAuthCookie(res, result.token);
    // Rolling refresh token keeps the creator signed in on the mobile app.
    const refreshToken = result.user?.id ? generateRefreshToken(result.user.id, 'creator') : undefined;
    res.status(200).json({
      status: 'success',
      data: {
        creator: sanitizeCreator(result.profile),
        token: result.token,
        refreshToken: refreshToken,
        user: {
          email: result.user.email,
          role: 'creator',
          is_verified: result.user.is_verified
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  // Revoke BOTH the access token and the refresh token so the session truly ends.
  await revokeSessionTokens(req);
  clearAuthCookies(res);
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { email, token } = req.query;
    const result = await CreatorService.verifyEmail(email, token);
    res.status(200).json({
      status: 'success',
      message: result.alreadyVerified ? 'Email already verified.' : 'Email verified successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    await CreatorService.resendVerification(String(req.body.email || '').toLowerCase().trim());
    res.status(200).json({ status: 'success', message: 'Verification email sent.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password — emails an ambassador a reset link
 * @route   POST /api/creators/forgot-password
 * @access  Public
 * Ambassadors authenticate via the unified `users` table, so the role-agnostic
 * AuthService drives this exactly like buyer/seller. Responds uniformly to avoid
 * account enumeration.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Please provide an email address' });
    }

    await AuthService.forgotPassword(email, 'creator');

    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  } catch (error) {
    logger.error('Creator forgot password error:', error.message);
    return res.status(500).json({ status: 'error', message: 'An error occurred while processing your request' });
  }
};

/**
 * @desc    Reset password using the emailed token
 * @route   POST /api/creators/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!token || !newPassword || !email) {
      return res.status(400).json({ status: 'error', message: 'Token, email, and new password are required' });
    }

    try {
      await AuthService.resetPassword(email, token, newPassword);
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message || 'Invalid or expired token' });
    }

    return res.status(200).json({ status: 'success', message: 'Password has been reset successfully.' });
  } catch (error) {
    logger.error('Creator reset password error:', error.message);
    return res.status(500).json({ status: 'error', message: 'An error occurred while resetting your password.' });
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const creator = await CreatorService.findByUserId(req.user.userId || req.user.id);
    res.status(200).json({ status: 'success', data: { creator: sanitizeCreator(creator) } });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await CreatorService.getDashboard(req.user.creatorId, req.query.period);
    res.status(200).json({
      status: 'success',
      data: {
        creator: sanitizeCreator(dashboard.creator),
        shops: dashboard.shops,
        shopRequests: dashboard.shopRequests,
        earnings: dashboard.earnings,
        analysis: dashboard.analysis,
        analysisPeriod: dashboard.analysisPeriod,
        monthly: dashboard.monthly,
        leaderboard: dashboard.leaderboard,
        withdrawals: dashboard.withdrawals,
        linkClicks: dashboard.linkClicks
      }
    });
  } catch (error) {
    next(error);
  }
};

export const acceptShopRequest = async (req, res, next) => {
  try {
    const result = await CreatorService.respondToShopRequest({
      creatorId: req.user.creatorId,
      inviteId: req.params.inviteId,
      action: 'accept'
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const denyShopRequest = async (req, res, next) => {
  try {
    const result = await CreatorService.respondToShopRequest({
      creatorId: req.user.creatorId,
      inviteId: req.params.inviteId,
      action: 'deny'
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const getReferralDashboard = async (req, res, next) => {
  try {
    const dashboard = await CreatorService.getReferralDashboard(req.user.creatorId);
    res.status(200).json({ status: 'success', data: dashboard });
  } catch (error) {
    next(error);
  }
};

export const generateReferralCode = async (req, res, next) => {
  try {
    const referralCode = await CreatorService.generateReferralCode(req.user.creatorId);
    res.status(200).json({ status: 'success', data: { referralCode } });
  } catch (error) {
    next(error);
  }
};

export const trackLinkClick = async (req, res, next) => {
  try {
    await CreatorService.recordLinkClick({
      code: req.params.code,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

export const requestWithdrawal = async (req, res, next) => {
  try {
    const request = await WithdrawalService.createWithdrawalRequest({
      entityId: req.user.creatorId,
      entityType: 'creator',
      amount: req.body.amount,
      idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey
    });
    res.status(201).json({ status: 'success', data: { withdrawal: sanitizeWithdrawalRequest(request) } });
  } catch (error) {
    next(error);
  }
};
