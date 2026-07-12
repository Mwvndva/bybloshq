import { validate } from '../middleware/validate.js';
import * as V from '../validations/creator.validation.js';
import express from 'express';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import { withdrawalRateLimiter } from '../middleware/rateLimiting.js';
import * as creatorController from '../controllers/creator.controller.js';
import { AppError } from '../shared/utils/errorHandler.js';

const router = express.Router();

const requireCreatorProfile = (req, res, next) => {
  if (!req.user?.creatorId) {
    return next(new AppError('Creator profile is required for this route.', 403));
  }
  return next();
};

router.get('/invites/:token', creatorController.getInvite);
router.post('/links/:code/click', validate(V.trackClick), creatorController.trackLinkClick);
router.post('/register', authLimiter, validate(V.register), creatorController.register);
router.post('/login', authLimiter, validate(V.login), creatorController.login);
router.get('/verify-email', creatorController.verifyEmail);
router.post('/resend-verification', authLimiter, validate(V.resendVerification), creatorController.resendVerification);

router.use(protect);
router.use(requireCreatorProfile);

router.post('/logout', creatorController.logout);
router.get('/profile', creatorController.getProfile);
router.get('/dashboard', creatorController.getDashboard);
router.post('/shop-requests/:inviteId/accept', validate(V.acceptShopRequest), creatorController.acceptShopRequest);
router.post('/shop-requests/:inviteId/deny', validate(V.denyShopRequest), creatorController.denyShopRequest);
router.get('/referral/dashboard', creatorController.getReferralDashboard);
router.post('/referral/generate-code', validate(V.generateReferralCode), creatorController.generateReferralCode);
router.post('/withdrawals', withdrawalRateLimiter, validate(V.requestWithdrawal), creatorController.requestWithdrawal);

export default router;
