import CreatorService from '../services/creator.service.js';
import { setAuthCookie } from '../shared/utils/cookie.utils.js';

const sanitizeCreator = (creator = {}) => ({
  id: creator.id,
  userId: creator.user_id,
  firstName: creator.first_name,
  lastName: creator.last_name,
  email: creator.email,
  mpesaNumber: creator.mpesa_number,
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
      sellerId: req.user.sellerId || req.user.profileId,
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
    const invites = await CreatorService.listSellerInvites(req.user.sellerId || req.user.profileId);
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
    const result = await CreatorService.registerFromInvite(req.body);
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
    const dashboard = await CreatorService.getDashboard(req.user.creatorId || req.user.profileId);
    res.status(200).json({
      status: 'success',
      data: {
        creator: sanitizeCreator(dashboard.creator),
        shops: dashboard.shops,
        earnings: dashboard.earnings
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getReferralDashboard = async (req, res, next) => {
  try {
    const dashboard = await CreatorService.getReferralDashboard(req.user.creatorId || req.user.profileId);
    res.status(200).json({ status: 'success', data: dashboard });
  } catch (error) {
    next(error);
  }
};

export const generateReferralCode = async (req, res, next) => {
  try {
    const referralCode = await CreatorService.generateReferralCode(req.user.creatorId || req.user.profileId);
    res.status(200).json({ status: 'success', data: { referralCode } });
  } catch (error) {
    next(error);
  }
};
