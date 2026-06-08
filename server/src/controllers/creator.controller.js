import CreatorService from '../services/creator.service.js';
import WithdrawalService from '../services/withdrawal.service.js';
import { sanitizeWithdrawalRequest } from '../shared/utils/sanitize.js';
import { setAuthCookie } from '../shared/utils/cookie.utils.js';
import { getTokenFromRequest, verifyToken } from '../shared/utils/jwt.js';
import logger from '../shared/utils/logger.js';

const sanitizeCreator = (creator = {}) => ({
  id: creator.id,
  userId: creator.user_id,
  firstName: creator.first_name,
  lastName: creator.last_name,
  email: creator.email,
  mpesaNumber: creator.mpesa_number,
  whatsappNumber: creator.whatsapp_number,
  instagramLink: creator.instagram_link,
  tiktokLink: creator.tiktok_link,
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
    next(error);
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
    res.status(200).json({
      status: 'success',
      data: {
        creator: sanitizeCreator(result.profile),
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
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      const decoded = verifyToken(token);
      const tokenBlacklist = (await import('../services/tokenBlacklist.service.js')).default;
      await tokenBlacklist.addToken(token, decoded.exp);
    } catch (err) {
      logger.debug('[CREATOR_LOGOUT] Could not blacklist token:', err.message);
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
