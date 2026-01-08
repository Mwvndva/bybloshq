import jwt from 'jsonwebtoken';
import { query, pool } from '../config/database.js';
import payoutService from '../services/payout.service.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../utils/logger.js';

import {
  createSeller,
  findSellerByEmail,
  findSellerById,
  findSellerByShopName,
  updateSeller,
  generateAuthToken,
  verifyPassword,
  verifyPasswordResetToken,
  updatePassword,

  isShopNameAvailable
} from '../models/seller.model.js';
import {
  sanitizeSeller,
  sanitizePublicSeller,
  sanitizeWithdrawalRequest
} from '../utils/sanitize.js';

// Helper to send token via cookie
const sendTokenResponse = (seller, statusCode, res, message) => {
  const token = generateAuthToken(seller);

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
  const { fullName, shopName, email, phone, password, city, location } = req.body;

  // Check if shop name is available (still needed as business logic check)
  const isShopAvailable = await isShopNameAvailable(shopName);
  if (!isShopAvailable) {
    return res.status(400).json({
      status: 'error',
      message: 'Shop name is already taken'
    });
  }

  try {
    const seller = await createSeller({ fullName, shopName, email, phone, password, city, location });
    sendTokenResponse(seller, 201, res, 'Registration successful');
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // 1) Check if seller exists and password is valid
    const seller = await findSellerByEmail(email);
    const isPasswordValid = seller ? await verifyPassword(password, seller.password) : false;

    if (!seller || !isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // 2) If everything is ok, send token to client
    sendTokenResponse(seller, 200, res, 'Login successful');
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

    const { bannerImage } = req.body;

    // Allow empty string to remove banner
    if (bannerImage === undefined || bannerImage === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Banner image is required'
      });
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
  const client = await pool.connect();
  const sellerId = req.user?.id;
  const { amount, mpesaName } = req.body;
  let { mpesaNumber } = req.body;

  try {
    if (!sellerId) return res.status(401).json({ status: 'error', message: 'Authentication required' });
    if (!amount || !mpesaNumber || !mpesaName) return res.status(400).json({ status: 'error', message: 'Missing required fields' });

    // Ensure mpesaNumber starts with 254
    mpesaNumber = mpesaNumber.toString();
    if (mpesaNumber.startsWith('0')) {
      mpesaNumber = `254${mpesaNumber.substring(1)}`;
    } else if (mpesaNumber.startsWith('+254')) {
      mpesaNumber = mpesaNumber.substring(1);
    } else if (!mpesaNumber.startsWith('254')) {
      // Assume it needs prefix if strictly 9 digits, otherwise might be invalid but let it pass to API or strict check
      if (mpesaNumber.length === 9) mpesaNumber = `254${mpesaNumber}`;
    }

    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) return res.status(400).json({ status: 'error', message: 'Invalid amount' });

    await client.query('BEGIN');

    // 1. Lock & Check Balance
    logger.info(`Withdrawal: Checking balance for seller ${sellerId}, amount: ${withdrawalAmount}`);

    const { rows: [seller] } = await client.query(
      'SELECT balance, full_name, email FROM sellers WHERE id = $1 FOR UPDATE',
      [sellerId]
    );

    if (!seller) {
      await client.query('ROLLBACK');
      logger.warn(`Withdrawal: Seller not found ${sellerId}`);
      return res.status(404).json({ status: 'error', message: 'Seller not found' });
    }

    const currentBalance = parseFloat(seller.balance || 0);
    if (withdrawalAmount > currentBalance) {
      await client.query('ROLLBACK');
      logger.warn(`Withdrawal: Insufficient funds. Seller ${sellerId} has ${currentBalance}, requested ${withdrawalAmount}`);
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    // 2. Deduct Balance & Create Request
    await client.query('UPDATE sellers SET balance = balance - $1 WHERE id = $2', [withdrawalAmount, sellerId]);

    const { rows: [request] } = await client.query(
      `INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, created_at)
       VALUES ($1, $2, $3, $4, 'processing', NOW())
       RETURNING id, amount, mpesa_number, status, created_at`,
      [sellerId, withdrawalAmount, mpesaNumber, mpesaName]
    );

    // 3. Generate Reference & Update
    const reference = `WR-${request.id}-${Date.now()}`;
    await client.query('UPDATE withdrawal_requests SET provider_reference = $1 WHERE id = $2', [reference, request.id]);

    await client.query('COMMIT'); // Commit early so DB state is consistent
    logger.info(`Withdrawal: DB transaction committed. Created request ID ${request.id} with ref ${reference}`);

    // 4. Initiate Payout (External API)
    try {
      logger.info(`Withdrawal: Initiating Payd API call for ReqID ${request.id} to ${mpesaNumber}`);

      const payoutResponse = await payoutService.initiateMobilePayout({
        amount: withdrawalAmount,
        phone_number: mpesaNumber,
        narration: `Withdrawal for ${seller.full_name}`,
        account_name: mpesaName
        // Removed: reference field (not in PayD v3 spec)
      });

      logger.info(`Withdrawal: Payd API accepted request for ReqID ${request.id}. HTTP Status: 202, Response Status: ${payoutResponse.status}`);

      // Update request with raw response and provider reference
      // CRITICAL: Keep status as 'processing' - only the callback should mark as completed/failed
      const paydId = payoutResponse.correlator_id || payoutResponse.transaction_id;

      if (paydId) {
        await pool.query('UPDATE withdrawal_requests SET raw_response = $1, provider_reference = $2 WHERE id = $3',
          [JSON.stringify(payoutResponse), paydId, request.id]
        );
        logger.info(`Withdrawal: Updated ReqID ${request.id} with ProviderRef ${paydId}. Status remains 'processing' until callback.`);
      } else {
        await pool.query('UPDATE withdrawal_requests SET raw_response = $1 WHERE id = $2',
          [JSON.stringify(payoutResponse), request.id]
        );
        logger.warn(`Withdrawal: No provider ref returned for ReqID ${request.id}. Status remains 'processing'.`);
      }

      // WhatsApp Notification - inform seller withdrawal is being processed
      if (seller.phone) {
        whatsappService.notifySellerWithdrawalUpdate(seller.phone, {
          amount: withdrawalAmount,
          status: 'processing',
          reference: paydId || reference || 'N/A',
          reason: null,
          newBalance: null
        }).catch(err => logger.error('Failed to send withdrawal WA notification:', err));
      }

      res.status(201).json({
        status: 'success',
        data: sanitizeWithdrawalRequest({
          ...request,
          status: 'processing',
          message: 'Withdrawal request submitted successfully. You will be notified once it is processed.'
        })
      });

    } catch (apiError) {
      // 5. Compensating Transaction on Failure
      logger.error(`Withdrawal: Payd API Failed for ReqID ${request.id}. Error: ${apiError.message}`);

      const refundClient = await pool.connect();
      try {
        await refundClient.query('BEGIN');
        const { rows: [updatedSeller] } = await refundClient.query('UPDATE sellers SET balance = balance + $1 WHERE id = $2 RETURNING balance', [withdrawalAmount, sellerId]);
        await refundClient.query('UPDATE withdrawal_requests SET status = $1 WHERE id = $2', ['failed', request.id]);
        await refundClient.query('COMMIT');

        logger.info(`Withdrawal: Refunded ReqID ${request.id} due to API failure. New Balance: ${updatedSeller?.balance}`);

        // WhatsApp Notification for Failure
        if (seller.phone) {
          whatsappService.notifySellerWithdrawalUpdate(seller.phone, {
            amount: withdrawalAmount,
            status: 'failed',
            reference: reference || 'N/A',
            reason: apiError.message,
            newBalance: updatedSeller?.balance
          }).catch(err => logger.error('Failed to send withdrawal failure WA notification:', err));
        }

        return res.status(502).json({
          status: 'error',
          message: 'Payout provider unavailable. Funds refunded.',
          detail: apiError.message
        });
      } catch (refundErr) {
        await refundClient.query('ROLLBACK');
        console.error('CRITICAL: Refund failed', refundErr);
        throw refundErr;
      } finally {
        refundClient.release();
      }
    }

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Withdrawal Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  } finally {
    client.release();
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
