import express from 'express';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import * as creatorController from '../controllers/creator.controller.js';

const router = express.Router();

router.get('/invites/:token', creatorController.getInvite);
router.post('/register', authLimiter, creatorController.register);
router.post('/login', authLimiter, creatorController.login);
router.get('/verify-email', creatorController.verifyEmail);
router.post('/resend-verification', authLimiter, creatorController.resendVerification);

router.use(protect);

router.get('/profile', creatorController.getProfile);
router.get('/dashboard', creatorController.getDashboard);
router.get('/referral/dashboard', creatorController.getReferralDashboard);
router.post('/referral/generate-code', creatorController.generateReferralCode);

export default router;
