import Buyer from '../models/buyer.model.js';
import AppError from '../utils/appError.js';
import { signToken } from '../utils/jwt.js';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../utils/email.js';
import { pool } from '../config/database.js';

export const register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, confirmPassword, city, location } = req.body;

    // Debug log to verify payload during integration
    // Remove or lower log level in production if too noisy
    console.log('Buyer register payload:', {
      fullName,
      email,
      phone,
      city,
      location
    });

    // 1) Check if passwords match
    if (password !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    // 2) Validate required location fields
    if (!city || !location) {
      return next(new AppError('City and location are required', 400));
    }

    // 3) Check if user already exists
    const existingBuyer = await Buyer.findByEmail(email);
    if (existingBuyer) {
      return next(new AppError('Email already in use', 400));
    }

    // 4) Create new buyer (no email verification required)
    const newBuyer = await Buyer.create({
      fullName,
      email,
      phone,
      password,
      city,
      location,
    });

    // 5) Generate JWT token with buyer role
    const token = signToken(newBuyer.id, 'buyer');

    // 6) Remove sensitive data from output
    delete newBuyer.password;
    delete newBuyer.resetPasswordToken;
    delete newBuyer.resetPasswordExpires;

    res.status(201).json({
      status: 'success',
      message: 'Registration successful! You can now log in.',
      token,
      data: {
        buyer: newBuyer,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2) Check if buyer exists and password is correct
    const buyer = await Buyer.findByEmail(email);
    
    if (!buyer || !(await Buyer.validatePassword(password, buyer.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Update last login
    await Buyer.update(buyer.id, { last_login: new Date() });

    // 4) If everything ok, send token to client
    const token = signToken(buyer.id, 'buyer');

    // 5) Remove sensitive data from output
    delete buyer.password;
    delete buyer.resetPasswordToken;
    delete buyer.resetPasswordExpires;

    res.status(200).json({
      status: 'success',
      token,
      data: {
        buyer,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an email address'
      });
    }

    // Find buyer by email
    const buyer = await Buyer.findByEmail(email);
    
    if (!buyer) {
      // For security, don't reveal if the email exists or not
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    try {
      // 1. Generate the random reset token and save it
      const { resetToken } = await Buyer.setPasswordResetToken(email);
      
      // 2. Send the password reset email
      await sendPasswordResetEmail(email, resetToken, 'buyer');
      
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

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // 1) Validate input
    if (!token || !newPassword) {
      return next(new AppError('Token and new password are required', 400));
    }

    // 2) Reset password using the token
    const buyer = await Buyer.resetPassword(token, newPassword);

    // 3) Log the buyer in, send JWT
    const authToken = signToken(buyer.id, 'buyer');

    // 4) Remove sensitive data from output
    delete buyer.password;
    delete buyer.resetPasswordToken;
    delete buyer.resetPasswordExpires;

    res.status(200).json({
      status: 'success',
      token: authToken,
      data: {
        buyer,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Order fetching functionality has been removed

export const getProfile = async (req, res, next) => {
  try {
    const buyer = await Buyer.findById(req.user.id);
    
    if (!buyer) {
      return next(new AppError('No buyer found with that ID', 404));
    }

    // Remove sensitive data
    delete buyer.password;
    delete buyer.resetPasswordToken;
    delete buyer.resetPasswordExpires;

    res.status(200).json({
      status: 'success',
      data: {
        buyer,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    console.log('Updating profile for user:', req.user.id);
    console.log('Update data:', req.body);
    
    // 1) Filter out unwanted fields that are not allowed to be updated
    const { password, passwordConfirm, ...updateData } = req.body;

    // 2) If password is being updated, handle it separately
    if (password) {
      if (password !== passwordConfirm) {
        return next(new AppError('Passwords do not match', 400));
      }
      await Buyer.updatePassword(req.user.id, password);
    }

    // 3) If there's nothing else to update, return early
    if (Object.keys(updateData).length === 0) {
      const currentUser = await Buyer.findById(req.user.id);
      delete currentUser.password;
      delete currentUser.resetPasswordToken;
      delete currentUser.resetPasswordExpires;
      
      return res.status(200).json({
        status: 'success',
        message: 'No profile updates provided',
        data: {
          buyer: currentUser
        }
      });
    }

    // 4) Update other buyer data
    const updatedBuyer = await Buyer.update(req.user.id, updateData);
    console.log('Updated buyer data:', updatedBuyer);

    if (!updatedBuyer) {
      console.error('Failed to update buyer profile');
      return next(new AppError('Error updating profile', 500));
    }

    // 5) Remove sensitive data from output
    delete updatedBuyer.password;
    delete updatedBuyer.resetPasswordToken;
    delete updatedBuyer.resetPasswordExpires;

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        buyer: updatedBuyer,
      },
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    next(error);
  }
};



