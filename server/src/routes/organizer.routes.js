import express from 'express';
import Organizer from '../models/organizer.model.js';
import {
  register,
  login,
  getCurrentUser,
  updateProfile,
  updatePassword
} from '../controllers/auth.controller.js';
import { sendWithdrawalEmail, createWithdrawalRequest, getEventWithdrawals } from '../controllers/organizer.controller.js';
import { forgotPassword, resetPassword } from '../controllers/organizerAuth.controller.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import { validateOrganizerRegistration, validateOrganizerLogin, validatePasswordUpdate } from '../middleware/organizerValidation.js';
import { requestPayout, getPayoutHistory } from '../controllers/payout.controller.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', authLimiter, validateOrganizerRegistration, register);
router.post('/login', authLimiter, validateOrganizerLogin, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and email are required'
      });
    }

    const organizer = await Organizer.findByEmail(email);

    if (!organizer) {
      return res.status(404).json({
        status: 'error',
        message: 'No account found with this email'
      });
    }

    const isTokenValid = await Organizer.verifyPasswordResetToken(email, token);

    if (!isTokenValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Token is valid'
    });

  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while verifying the token'
    });
  }
});


// Protected routes (authentication required)
router.get('/me', protect, getCurrentUser);
router.patch('/update-profile', protect, updateProfile);
router.patch('/update-password', protect, validatePasswordUpdate, updatePassword);
router.post('/send-withdrawal-email', protect, sendWithdrawalEmail);
router.post('/withdrawal-request', protect, createWithdrawalRequest);
router.get('/events/:eventId/withdrawals', protect, getEventWithdrawals);

// Payout routes (merged from protectedOrganizer.routes.js)
router.post('/request-payout', protect, requestPayout);
router.get('/payouts', protect, getPayoutHistory);

router.post('/logout', protect, (req, res) => {
  // Clear the HTTP-only cookie
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Immediately expire
    path: '/',
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

export default router;
