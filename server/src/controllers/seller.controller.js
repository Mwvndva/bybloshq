import jwt from 'jsonwebtoken';
import { query, pool } from '../config/database.js';
import payoutService from '../services/payout.service.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../utils/logger.js';
import ImageService from '../services/image.service.js';
import AuthService from '../services/auth.service.js';
import { setAuthCookie } from '../utils/cookie.utils.js';

import SellerService from '../services/seller.service.js';
import * as SellerModel from '../models/seller.model.js';
import {
  findSellerById,
  findSellerByShopName,
  isShopNameAvailable,
  findSellerByEmail,
  updateSeller
} from '../models/seller.model.js';

import {
  sanitizeSeller,
  sanitizePublicSeller,
  sanitizeWithdrawalRequest
} from '../utils/sanitize.js';

// Helper to send token via cookie
const sendTokenResponse = (data, statusCode, res, message) => {
  const { user, profile, token } = data;

  setAuthCookie(res, token);

  res.status(statusCode).json({
    status: 'success',
    message,
    data: {
      seller: sanitizeSeller(profile),
      user: { email: user.email, role: user.role }
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
    // Register logic delegated to AuthService (which calls SellerService)
    await AuthService.register(req.body, 'seller');

    // Auto-login to get token and full profile structure
    const loginData = await AuthService.login(req.body.email, req.body.password, 'seller');

    sendTokenResponse(loginData, 201, res, 'Registration successful');
  } catch (error) {
    if (error.message.includes('exists')) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password, 'seller');

    if (!data) return res.status(401).json({ status: 'error', message: 'Invalid credentials' });

    sendTokenResponse(data, 200, res, 'Login successful');
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

    // Verify the user has permission to manage shop
    if (!(await req.user.can('manage-shop'))) {
      console.error('Unauthorized: User does not have manage-shop permission');
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

    // Check availability if shop name is changing
    if (req.body.shopName) {
      const currentSeller = await findSellerById(req.user.id);
      if (!currentSeller) {
        return res.status(404).json({ status: 'error', message: 'Seller not found' });
      }

      // Only check if the name is actually different
      if (req.body.shopName !== currentSeller.shopName) {
        // Validate length
        if (req.body.shopName.length < 3) {
          return res.status(400).json({ status: 'error', message: 'Shop name must be at least 3 characters' });
        }

        const available = await isShopNameAvailable(req.body.shopName);
        if (!available) {
          return res.status(400).json({
            status: 'error',
            message: 'This shop name is already taken'
          });
        }
      }
    }

    const seller = await updateSeller(req.user.id, req.body);

    if (!seller) {
      console.error('Failed to update seller:', req.seller?.id);
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

import { sendPasswordResetEmail } from '../utils/email.js'; // Might generally be handled by AuthService now
import { createPasswordResetToken } from '../models/seller.model.js'; // Deprecated in favor of User model by AuthService

/**
 * @desc    Reset password
 * @route   POST /api/sellers/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body; // Added email requirement

    if (!token || !newPassword || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Token, email, and new password are required'
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

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
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

    await AuthService.forgotPassword(email, 'seller');

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

    // Sanitize results to remove sensitive info
    // searchSellersInDB returns raw rows, so we map them to sanitized public objects
    const sanitizedSellers = sellers.map(s => sanitizePublicSeller(s));

    res.status(200).json({
      status: 'success',
      data: sanitizedSellers
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
      whatsapp_number AS "whatsappNumber", 
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

    // Check if the requesting user is the owner of this profile
    const isOwner = await req.user.can('manage-shop', seller, 'product', 'manage');

    // If owner, return full (but sanitized) details. If not, return public details only.
    const responseData = isOwner ? sanitizeSeller(seller) : sanitizePublicSeller(seller);

    res.status(200).json({
      status: 'success',
      data: responseData
    });
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
// @desc    Initiate debt payment (STK Push)
// @route   POST /api/sellers/debts/:debtId/pay
// @access  Private
export const initiateDebtPayment = async (req, res) => {
  const sellerId = req.user?.id;
  const { debtId } = req.params;

  try {
    if (!sellerId) return res.status(401).json({ status: 'error', message: 'Authentication required' });

    // 1. Fetch Debt & Client Details
    const { rows: debts } = await pool.query(
      `SELECT cd.*, c.phone as client_phone, c.full_name as client_name, p.name as product_name, p.id as product_id, p.price
       FROM client_debts cd
       JOIN clients c ON cd.client_id = c.id
       JOIN products p ON cd.product_id = p.id
       WHERE cd.id = $1 AND cd.seller_id = $2 AND cd.is_paid = false`,
      [debtId, sellerId]
    );

    const debt = debts[0];
    if (!debt) return res.status(404).json({ status: 'error', message: 'Debt record not found or already paid' });
    if (!debt.client_phone) return res.status(400).json({ status: 'error', message: 'Client has no phone number associated' });

    // 2. Create Client Order (reuse existing logic)
    const { default: OrderService } = await import('../services/order.service.js');

    const orderData = {
      clientName: debt.client_name,
      clientPhone: debt.client_phone,
      paymentType: 'stk', // STK Push
      items: [{
        productId: debt.product_id.toString(),
        name: debt.product_name,
        quantity: parseInt(debt.quantity, 10),
        price: parseFloat(debt.price) // Parse as number for validation
      }],
      skipInventoryDecrement: true, // Inventory already decremented when debt was created
      debtId: parseInt(debtId, 10) // Link order to debt
    };

    const result = await OrderService.createClientOrder(sellerId, orderData);

    res.status(200).json({
      status: 'success',
      message: 'STK Push initiated successfully',
      data: result
    });

  } catch (error) {
    logger.error(`Debt Payment Initiation Failed for debt ${debtId}:`, error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to initiate payment'
    });
  }
};
