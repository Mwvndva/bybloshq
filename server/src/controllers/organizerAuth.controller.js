import Organizer from '../models/organizer.model.js';
import { sendPasswordResetEmail } from '../utils/email.js';

/**
 * @desc    Forgot password
 * @route   POST /api/organizers/forgot-password
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

    // Find organizer by email
    const organizer = await Organizer.findByEmail(email);
    
    if (!organizer) {
      // For security, don't reveal if the email exists or not
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    try {
      // 1. Create a password reset token
      const resetToken = await Organizer.createPasswordResetToken(email);
      
      // 2. Send the password reset email
      await sendPasswordResetEmail(email, resetToken, 'organizer');
      
      console.log(`Password reset email sent to ${email}`);
      
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Still return success to the client for security
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while processing your request'
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/organizers/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    // Validate input
    if (!email || !token || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email, token, and new password'
      });
    }

    // Verify the token
    const isTokenValid = await Organizer.verifyPasswordResetToken(email, token);
    
    if (!isTokenValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired token. Please request a new password reset.'
      });
    }

    // Update the password
    await Organizer.updatePassword(email, newPassword);
    
    return res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while resetting your password. Please try again.'
    });
  }
};
