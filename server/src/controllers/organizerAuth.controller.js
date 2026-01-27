import AuthService from '../services/auth.service.js';

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

    await AuthService.forgotPassword(email, 'organizer');

    // Always return success for security
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

/**
 * @desc    Reset password
 * @route   POST /api/organizers/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    // Validate input
    if (!token || !newPassword || !email) { // Email is required for User model verification
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email, token, and new password'
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

