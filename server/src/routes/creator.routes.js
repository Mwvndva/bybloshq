import express from 'express';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import * as creatorController from '../controllers/creator.controller.js';

const router = express.Router();

router.get('/invites/:token', creatorController.getInvite);
router.post('/links/:code/click', creatorController.trackLinkClick);
router.post('/register', authLimiter, creatorController.register);
router.post('/login', authLimiter, creatorController.login);
router.get('/verify-email', creatorController.verifyEmail);
router.post('/resend-verification', authLimiter, creatorController.resendVerification);

router.use(protect);

router.post('/logout', creatorController.logout);
router.get('/profile', creatorController.getProfile);
router.get('/dashboard', creatorController.getDashboard);
router.post('/shop-requests/:inviteId/accept', creatorController.acceptShopRequest);
router.post('/shop-requests/:inviteId/deny', creatorController.denyShopRequest);
router.get('/referral/dashboard', creatorController.getReferralDashboard);
router.post('/referral/generate-code', creatorController.generateReferralCode);
router.post('/withdrawals', creatorController.requestWithdrawal);

export default router;
