import express from 'express';
import Organizer from '../models/organizer.model.js';
import { 
  register, 
  login, 
  getCurrentUser,
  updateProfile,
  updatePassword
} from '../controllers/auth.controller.js';
import { sendWithdrawalEmail } from '../controllers/organizer.controller.js';
import { forgotPassword, resetPassword } from '../controllers/organizerAuth.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
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
router.patch('/update-password', protect, updatePassword);
router.post('/send-withdrawal-email', protect, sendWithdrawalEmail);

export default router;
