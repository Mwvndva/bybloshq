import jwt from 'jsonwebtoken';
import { createSeller, findSellerByEmail, findSellerById, findSellerByShopName, updateSeller, generateAuthToken, verifyPassword, verifyPasswordResetToken, updatePassword, isShopNameAvailable } from '../models/seller.model.js';

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const checkShopNameAvailability = async (req, res) => {
  try {
    const { shopName } = req.query;
    
    if (!shopName) {
      return res.status(400).json({
        status: 'error',
        message: 'Shop name is required'
      });
    }
    
    const isAvailable = await isShopNameAvailable(shopName);
    
    res.status(200).json({
      status: 'success',
      data: {
        available: isAvailable
      }
    });
  } catch (error) {
    console.error('Error checking shop name availability:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const register = async (req, res) => {
  const { fullName, shopName, email, phone, password, confirmPassword } = req.body;

  // Validate required fields
  if (!fullName || !shopName || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'All fields are required'
    });
  }

  // Validate shop name format (alphanumeric, dashes, underscores, 3-30 chars)
  const shopNameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  if (!shopNameRegex.test(shopName)) {
    return res.status(400).json({
      status: 'error',
      message: 'Shop name must be 3-30 characters long and can only contain letters, numbers, dashes, and underscores'
    });
  }
  
  // Check if shop name is available
  const isShopAvailable = await isShopNameAvailable(shopName);
  if (!isShopAvailable) {
    return res.status(400).json({
      status: 'error',
      message: 'Shop name is already taken'
    });
  }
  
  // Validate email format
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide a valid email address'
    });
  }

  // Validate password length
  if (password.length < 8) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 8 characters long'
    });
  }

  // Validate password confirmation
  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'Passwords do not match'
    });
  }

  try {
    const seller = await createSeller({ fullName, shopName, email, phone, password });
    const token = generateAuthToken(seller);
    
    res.status(201).json({
      status: 'success',
      data: {
        seller,
        token
      }
    });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'sellers_email_key') {
        return res.status(400).json({
          status: 'error',
          message: 'Email already in use'
        });
      } else if (error.constraint === 'sellers_shop_name_key' || error.constraint === 'sellers_slug_key') {
        return res.status(400).json({
          status: 'error',
          message: 'Shop name is already taken'
        });
      }
    }
    
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const login = async (req, res) => {
  try {
    console.log('Login attempt with data:', { email: req.body.email });
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Login failed: Missing email or password');
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }
    
    // 1) Check if seller exists
    console.log('Looking up seller with email:', email);
    const seller = await findSellerByEmail(email);
    
    if (!seller) {
      console.log('No seller found with email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }
    
    console.log('Seller found, verifying password...');
    const isPasswordValid = await verifyPassword(password, seller.password);
    
    if (!isPasswordValid) {
      console.log('Invalid password for email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }
    
    // 2) If everything is ok, send token to client
    console.log('Password valid, generating token...');
    const token = generateAuthToken(seller);
    
    // Remove password from output
    const sellerWithoutPassword = { ...seller };
    delete sellerWithoutPassword.password;
    
    console.log('Login successful for email:', email);
    res.status(200).json({
      status: 'success',
      data: {
        seller: sellerWithoutPassword,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getSellerByShopName = async (req, res) => {
  try {
    const { shopName } = req.params;
    const seller = await findSellerByShopName(shopName);
    
    if (!seller) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (error) {
    console.error('Get seller by shop name error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const seller = await findSellerById(req.user.id);
    
    if (!seller) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    // Remove password field if it's included in the request body
    if (req.body.password) {
      delete req.body.password;
    }
    
    const seller = await updateSeller(req.seller.id, req.body);
    
    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile'
    });
  }
};

import { sendPasswordResetEmail } from '../utils/email.js';
import { createPasswordResetToken } from '../models/seller.model.js';

/**
 * @desc    Reset password
 * @route   POST /api/sellers/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and new password are required'
      });
    }

    // Verify the token and get the email
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid token'
      });
    }

    // Verify the token against the database
    const isValidToken = await verifyPasswordResetToken(email, token);
    
    if (!isValidToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired token. Please request a new password reset.'
      });
    }

    // Update the password
    await updatePassword(email, newPassword);

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        status: 'error',
        message: 'Token has expired. Please request a new password reset.'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while resetting your password.'
    });
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/sellers/forgot-password
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

    // Find seller by email
    const seller = await findSellerByEmail(email);
    
    if (!seller) {
      // For security, don't reveal if the email exists or not
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    try {
      // 1. Create a password reset token
      const resetToken = await createPasswordResetToken(email);
      
      // 2. Send the password reset email
      await sendPasswordResetEmail(email, resetToken);
      
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

export const getSellerById = async (req, res) => {
  try {
    const seller = await findSellerById(req.params.id);
    
    if (!seller) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }
    
    // Format the response to match the expected frontend format
    const sellerData = {
      id: seller.id,
      fullName: seller.full_name || seller.fullName,
      email: seller.email,
      phone: seller.phone,
      createdAt: seller.created_at || seller.createdAt,
      updatedAt: seller.updated_at || seller.updatedAt
    };
    
    res.status(200).json(sellerData);
  } catch (error) {
    console.error('Error fetching seller:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch seller information'
    });
  }
};
