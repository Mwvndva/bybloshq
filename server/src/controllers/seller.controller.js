import jwt from 'jsonwebtoken';
import { query, pool } from '../config/database.js';
import payoutService from '../services/payout.service.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../utils/logger.js';
import ImageService from '../services/image.service.js';

import SellerService from '../services/seller.service.js';
import * as SellerModel from '../models/seller.model.js';
import {
  findSellerById,
  findSellerByShopName,
  isShopNameAvailable,
  findSellerByEmail,
  updateSeller
} from '../models/seller.model.js';
// Wait, I removed isShopNameAvailable from Model default exports, so I need to check how it was exported.
// It was `export const isShopNameAvailable`. I replaced it with `static async isShopNameAvailable`. 
// So it is likely NOT exported as const anymore if I made it class? 
// No, I edited `seller.model.js` via string replace. 
// I replaced `export const isShopNameAvailable` with `static async ...`. 
// That implies I broke the module export structure if it wasn't a class file.
// `seller.model.js` was a functional module. 
// "Static async" only makes sense inside a `class`. 
// ERROR: I injected `static async` into a functional module.
// I must fix `seller.model.js` structure first or adjust my import.
// I will assume I need to fix `seller.model.js` to be valid js first. 
// Actually, let's fix the Controller to use what I *intended* the Service to use.
// The Service uses `SellerModel.createSeller`.
// Refactor: the Controller should mostly use `SellerService`.

import {
  sanitizeSeller,
  sanitizePublicSeller,
  sanitizeWithdrawalRequest
} from '../utils/sanitize.js';

// Helper to send token via cookie
const sendTokenResponse = (seller, statusCode, res, message) => {
  const token = SellerService.generateToken(seller);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours default
    path: '/'
  };

  if (process.env.NODE_ENV === 'development') {
    delete cookieOptions.domain;
  }

  res.cookie('jwt', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    // token, // SILENCED
    data: {
      seller: sanitizeSeller(seller)
    }
  });
};

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
  try {
    const seller = await SellerService.register(req.body);
    const token = SellerService.generateToken(seller);
    // sendTokenResponse helper uses token... 
    // I should update sendTokenResponse to take token or generate it using Service.
    // Let's refactor sendTokenResponse to use Service.generateToken.
    sendTokenResponse(seller, 201, res, 'Registration successful');
  } catch (error) {
    // ... error handling
    console.error('Registration error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await SellerService.login(email, password);
    if (!seller) return res.status(401).json({ status: 'error', message: 'Invalid credentials' });

    sendTokenResponse(seller, 200, res, 'Login successful');
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: 'error', message: 'Login failed' });
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

    // console.log('Found seller:', { ... });

    res.status(200).json({
      status: 'success',
      data: {
        seller: sanitizePublicSeller(seller)
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

    // Sanitize seller object - this returns ONLY safe fields
    const sanitizedSeller = sanitizeSeller(seller);

    res.status(200).json({
      status: 'success',
      data: {
        seller: sanitizedSeller  // Return ONLY sanitized data
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

    // Verify the user is a seller
    if (!req.user || req.user.userType !== 'seller') {
      console.error('Unauthorized: User is not a seller');
      return res.status(403).json({
        status: 'error',
        message: 'Only sellers can update seller profiles'
      });
    }

    if (!req.user.id) {
      console.error('No user ID in request');
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }

    const seller = await updateSeller(req.user.id, req.body);

    if (!seller) {
      console.error('Failed to update seller:', req.seller.id);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update profile: no seller returned'
      });
    }


    res.status(200).json({
      status: 'success',
      data: {
        seller: sanitizeSeller(seller)
      }
    });
  } catch (error) {
    console.error('Error updating profile:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.detail || 'No additional details'
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// @desc    Search sellers by city and location
// @route   GET /api/sellers/search
// @access  Public
export const searchSellers = async (req, res) => {
  try {
    const { city, location } = req.query;

    if (!city) {
      return res.status(400).json({
        status: 'error',
        message: 'City is required for search'
      });
    }

    const sellers = await searchSellersInDB(city, location || null);

    res.status(200).json({
      status: 'success',
      data: sellers
    });

  } catch (error) {
    console.error('Error searching for sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Internal function to search sellers in database
async function searchSellersInDB(city, location = null) {
  let queryText = `
    SELECT 
      id, 
      full_name AS "fullName", 
      shop_name AS "shopName", 
      email, 
      phone, 
      city, 
      location,
      created_at AS "createdAt"
    FROM sellers 
    WHERE LOWER(city) = LOWER($1)
  `;

  const queryParams = [city];

  if (location) {
    queryText += ' AND LOWER(location) LIKE LOWER($2)';
    queryParams.push(`%${location}%`);
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query(queryText, queryParams);
  return result.rows;
}

// @desc    Get products for a specific seller
// @route   GET /api/sellers/:sellerId/products
// @access  Public
export const getSellerProducts = async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!sellerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Seller ID is required'
      });
    }

    const products = await getSellerProductsFromDB(sellerId);

    res.status(200).json({
      status: 'success',
      data: products
    });

  } catch (error) {
    console.error('Error fetching seller products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Internal function to get products for a specific seller
async function getSellerProductsFromDB(sellerId) {
  const result = await query(
    `SELECT 
      p.id,
      p.name,
      p.description,
      p.price,
      p.image_url AS "imageUrl",
      p.aesthetic,
      p.seller_id AS "sellerId",
      p.status = 'sold' AS "isSold",
      p.status,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt",
      p.is_digital AS "isDigital",
      p.product_type AS "productType",
      p.service_locations AS "serviceLocations",
      p.service_options AS "serviceOptions",
      s.shop_name AS "sellerName"
    FROM products p
    JOIN sellers s ON p.seller_id = s.id
    WHERE p.seller_id = $1 AND p.status = 'available'`,
    [sellerId]
  );
  return result.rows;
}

// @desc    Upload a banner image for the seller
// @route   POST /api/sellers/upload-banner
// @access  Private
export const uploadBanner = async (req, res) => {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    let { bannerImage } = req.body;

    // Allow empty string to remove banner
    if (bannerImage === undefined || bannerImage === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Banner image is required'
      });
    }

    // Convert base64 to file if present
    if (bannerImage && ImageService.isBase64Image(bannerImage)) {
      bannerImage = await ImageService.base64ToFile(bannerImage, 'seller_banner');
    }

    // Convert empty string to NULL for database (to remove the banner)
    const bannerValue = bannerImage === '' ? null : bannerImage;

    // Update the seller's banner image (null removes it)
    const result = await query(
      `UPDATE sellers 
       SET banner_image = $1 
       WHERE id = $2 
       RETURNING id, banner_image AS "bannerImage"`,
      [bannerValue, sellerId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        bannerUrl: result.rows[0].bannerImage || ''
      }
    });
  } catch (error) {
    console.error('Error uploading banner:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload banner',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update seller theme
// @route   PATCH /api/sellers/theme
// @access  Private
export const updateTheme = async (req, res) => {
  try {
    const { theme } = req.body;
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!theme) {
      return res.status(400).json({
        status: 'error',
        message: 'Theme is required'
      });
    }

    // Update the seller's theme
    const result = await query(
      'UPDATE sellers SET theme = $1 WHERE id = $2 RETURNING theme',
      [theme, sellerId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        theme: result.rows[0].theme
      }
    });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update theme',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    /* console.log('Found seller:', {
      id: seller.id,
      shopName: seller.shop_name,
      // email: seller.email ? '[REDACTED]' : 'missing',
      // phone: seller.phone ? '[REDACTED]' : 'missing',
      isActive: seller.is_active
    }); */

    // Format the response to match the expected frontend format
    const sellerData = {
      id: seller.id,
      fullName: seller.full_name || seller.fullName,
      email: seller.email,
      phone: seller.phone,
      location: seller.location || null,
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

// @desc    Create withdrawal request
// @route   POST /api/sellers/withdrawal-request
// @access  Private
// @desc    Create withdrawal request
// @route   POST /api/sellers/withdrawal-request
// @access  Private
// @desc    Create withdrawal request
// @route   POST /api/sellers/withdrawal-request
// @access  Private
export const createWithdrawalRequest = async (req, res) => {
  const sellerId = req.user?.id;
  const { amount, mpesaNumber, mpesaName } = req.body;

  try {
    if (!sellerId) return res.status(401).json({ status: 'error', message: 'Authentication required' });
    if (!amount || !mpesaNumber || !mpesaName) return res.status(400).json({ status: 'error', message: 'Missing required fields' });

    // Delegate to SellerService which now uses the centralized WithdrawalService
    const request = await SellerService.createWithdrawalRequest(sellerId, amount, mpesaNumber, mpesaName);

    res.status(201).json({
      status: 'success',
      data: sanitizeWithdrawalRequest({
        ...request,
        status: 'processing',
        message: 'Withdrawal request submitted successfully. You will be notified once it is processed.'
      })
    });
  } catch (serviceError) {
    logger.error(`Withdrawal: SellerService failed for seller ${sellerId}: ${serviceError.message}`);

    // Map service errors to appropriate responses
    const status = serviceError.message.includes('Insufficient') ? 400 :
      serviceError.message.includes('not found') ? 404 :
        serviceError.message.includes('Minimum') || serviceError.message.includes('Maximum') ? 400 : 500;

    res.status(status).json({
      status: 'error',
      message: serviceError.message
    });
  }
};

// @desc    Get seller's withdrawal requests
// @route   GET /api/sellers/withdrawal-requests
// @access  Private
export const getWithdrawalRequests = async (req, res) => {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Get withdrawal requests for the seller
    const result = await query(
      `SELECT wr.id, wr.amount, wr.mpesa_number, wr.mpesa_name, wr.status,
              wr.created_at, wr.processed_at, wr.processed_by, wr.metadata,
              s.full_name as seller_name, s.email as seller_email
       FROM withdrawal_requests wr
       JOIN sellers s ON wr.seller_id = s.id
       WHERE wr.seller_id = $1
       ORDER BY wr.created_at DESC`,
      [sellerId]
    );

    const withdrawalRequests = result.rows.map(row => ({
      id: row.id,
      amount: row.amount,
      mpesaNumber: row.mpesa_number,
      mpesaName: row.mpesa_name,
      status: row.status,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      processedBy: row.processed_by,
      sellerName: row.seller_name,
      sellerEmail: row.email,
      failureReason: row.status === 'failed' && row.metadata ? (row.metadata.failure_reason || row.metadata.message || row.metadata.status_description || 'Unknown error') : null
    }));

    res.status(200).json({
      status: 'success',
      data: withdrawalRequests
    });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch withdrawal requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
