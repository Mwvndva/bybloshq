import { query, pool } from '../config/database.js';
import { invalidateAuthCache } from '../middleware/auth.js';
import payoutService from '../services/payout.service.js';
import whatsappService from '../services/whatsapp.service.js';
import logger from '../utils/logger.js';
import ImageService from '../services/image.service.js';
import AuthService from '../services/auth.service.js';
import { setAuthCookie } from '../utils/cookie.utils.js';

import SellerService from '../services/seller.service.js';
import ReferralService from '../services/referral.service.js';
import * as SellerModel from '../models/seller.model.js';
import { getTokenFromRequest, verifyToken } from '../utils/jwt.js';
import {
  findSellerById,
  findSellerByUserId,
  findSellerByShopName,
  isShopNameAvailable,
  findSellerByEmail,
  updateSeller,
  becomeClient,
  removeClient
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

  const registrationMessage = statusCode === 201
    ? 'Account created! Please verify your email before listing products.'
    : message;

  res.status(statusCode).json({
    status: 'success',
    message: registrationMessage,
    data: {
      seller: sanitizeSeller(profile),
      user: { email: user.email, role: user.role },
      emailVerificationRequired: statusCode === 201,
      emailVerificationSent: statusCode === 201
    }
  });
};

export const logout = async (req, res) => {
  // Blacklist the current token so it can't be reused
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      const decoded = verifyToken(token);
      const tokenBlacklist = (await import('../services/tokenBlacklist.service.js')).default;
      await tokenBlacklist.addToken(token, decoded.exp);
    } catch (err) {
      // Token may be invalid/expired — that's fine, just clear cookies
      logger.debug('[LOGOUT] Could not blacklist token:', err.message);
    }
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: new Date(0),
    path: '/'
  };
  res.cookie('jwt', '', cookieOptions);
  res.cookie('token', '', cookieOptions);
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
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

    // Validation format rules (must match Zod schema in sellerValidation.js)
    const shopNameRegex = /^[a-zA-Z0-9._-]+$/;
    const isAllowedFormat = shopNameRegex.test(shopName) && shopName.length >= 3 && shopName.length <= 30;

    if (!isAllowedFormat) {
      let formatMessage = 'Invalid format';
      if (shopName.length < 3) formatMessage = 'Shop name must be at least 3 characters';
      if (shopName.length > 30) formatMessage = 'Shop name must be at most 30 characters';
      if (!shopNameRegex.test(shopName)) formatMessage = 'Shop name can only contain letters, numbers, dots, dashes, and underscores';

      return res.status(200).json({
        status: 'success',
        data: {
          available: false,
          allowed: false,
          message: formatMessage
        }
      });
    }

    const isAvailable = await isShopNameAvailable(shopName);

    res.status(200).json({
      status: 'success',
      data: {
        available: isAvailable,
        allowed: true,
        message: isAvailable ? 'Shop name is available' : 'Shop name is already taken'
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
    // Register logic delegated to AuthService
    const result = await AuthService.register(req.body, 'seller');

    // If verification is required, don't login or issue token
    if (result.status === 'pending_verification') {
      return res.status(200).json({
        status: 'success',
        message: 'Registration received! Please check your email to verify your account before logging in.',
        data: {
          email: result.email,
          emailVerificationRequired: true,
          emailVerificationSent: true
        }
      });
    }

    // Auto-login for existing users added to seller role
    const loginData = await AuthService.login(req.body.email, req.body.password, 'seller');

    sendTokenResponse(loginData, 201, res, 'Registration successful');

    // ── Referral hook (post-response, non-blocking) ──
    const refCode = req.body.referralCode || req.query.ref;
    if (refCode) {
      const newSellerId = loginData?.profile?.id;
      if (newSellerId) {
        ReferralService.applyReferral(newSellerId, refCode).catch((err) =>
          logger.warn(`[REFERRAL] applyReferral failed: ${err.message}`)
        );
      }
    }
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

    if (!data) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    sendTokenResponse(data, 200, res, 'Login successful');
  } catch (e) {
    // Role mismatch — give clear, actionable message
    if (e.isRoleMismatch) {
      return res.status(401).json({
        status: 'error',
        message: e.message, // "Wrong portal. This account is registered as a buyer."
        code: 'WRONG_PORTAL'
      });
    }
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({
        status: 'error',
        message: e.message,
        code: 'EMAIL_NOT_VERIFIED',
        email: e.email,
        userType: e.userType
      });
    }
    console.error('Seller login error:', e);
    res.status(500).json({ status: 'error', message: 'Login failed. Please try again.' });
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
    // Find by users.id (user_id FK in sellers table)
    let seller = await findSellerByUserId(req.user.userId || req.user.id);

    // Fallback: find by sellers.id directly (for admin or cross-role access)
    if (!seller && req.user.sellerId) {
      seller = await findSellerById(req.user.sellerId);
    }

    if (!seller) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller profile not found for this account.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: { seller: sanitizeSeller(seller) }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    // Use sellerId from auth middleware (populated by crossRoles query)
    const sellerId = req.user.sellerId;
    if (!sellerId) {
      return res.status(400).json({ status: 'error', message: 'No seller profile found' });
    }

    if (req.body.password) delete req.body.password;

    if (!(await req.user.can('manage-shop'))) {
      return res.status(403).json({ status: 'error', message: 'Only sellers can update seller profiles' });
    }

    if (req.body.shopName) {
      const shopNameRegex = /^[a-zA-Z0-9._-]+$/;
      const shopName = req.body.shopName;

      if (shopName.length < 3) {
        return res.status(400).json({ status: 'error', message: 'Shop name must be at least 3 characters' });
      }
      if (shopName.length > 30) {
        return res.status(400).json({ status: 'error', message: 'Shop name must be at most 30 characters' });
      }
      if (!shopNameRegex.test(shopName)) {
        return res.status(400).json({ status: 'error', message: 'Shop name can only contain letters, numbers, dots, dashes, and underscores' });
      }

      const currentSeller = await findSellerById(sellerId);
      if (!currentSeller) {
        return res.status(404).json({ status: 'error', message: 'Seller not found' });
      }
      if (shopName !== currentSeller.shopName && shopName !== currentSeller.shop_name) {
        const available = await isShopNameAvailable(shopName);
        if (!available) {
          return res.status(400).json({ status: 'error', message: 'This shop name is already taken' });
        }
      }
    }

    const seller = await updateSeller(sellerId, req.body);
    if (!seller) {
      return res.status(500).json({ status: 'error', message: 'Failed to update profile' });
    }

    // Invalidate auth cache so next request gets fresh seller data
    const currentToken = getTokenFromRequest(req);
    invalidateAuthCache(currentToken);

    res.status(200).json({ status: 'success', data: { seller: sanitizeSeller(seller) } });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update profile' });
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

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query

    if (!token || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and email are required'
      })
    }

    const result = await AuthService.verifyEmail(email, token)

    return res.status(200).json({
      status: 'success',
      message: result.alreadyVerified
        ? 'Your email is already verified. You can log in.'
        : 'Email verified successfully! You can now log in.',
      data: {
        alreadyVerified: result.alreadyVerified,
        email: result.user.email
      }
    })
  } catch (error) {
    logger.error('Email verification failed:', error.message)
    return res.status(400).json({
      status: 'error',
      message: error.message
    })
  }
}

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email is required' })
    }
    await AuthService.resendVerificationEmail(email.toLowerCase().trim(), 'seller')
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    })
  } catch (error) {
    logger.error('Seller resend verification failed:', error.message)
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email and is unverified, a new verification link has been sent.'
    })
  }
}

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

    const sellers = await searchSellersInDB(city, location);

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
      city, 
      location,
      theme,
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
      p.images,
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
      [bannerValue, req.user.sellerId]
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
      [theme, req.user.sellerId]
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

// --- Withdrawal functions removed (centralized in withdrawal.controller.js) ---

// @desc    Initiate debt payment (STK Push)
// @route   POST /api/sellers/debts/:debtId/pay
// @access  Private
export const initiateDebtPayment = async (req, res) => {
  const sellerId = req.user.sellerId;
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

// @desc    Become a client of a seller
// @route   POST /api/buyers/sellers/:sellerId/become-client
// @access  Private (Buyer)
export const handleBecomeClient = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sellerId } = req.params;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!sellerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Seller ID is required'
      });
    }

    const result = await becomeClient(sellerId, userId);

    res.status(200).json({
      status: 'success',
      success: true,
      message: result.alreadyClient ? 'You are already following this shop' : 'You are now following this shop',
      data: {
        clientCount: result.clientCount,
        alreadyClient: result.alreadyClient
      }
    });

  } catch (error) {
    console.error('Error becoming client:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to follow shop',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const handleLeaveClient = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sellerId } = req.params;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!sellerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Seller ID is required'
      });
    }

    const result = await removeClient(sellerId, userId);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'You have unfollowed this shop',
      data: {
        clientCount: result.clientCount,
        wasClient: result.wasClient
      }
    });

  } catch (error) {
    console.error('Error leaving clientele:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to unfollow shop',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getBuyerShops = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const sellers = await SellerModel.findSellersByUserId(userId);

    res.status(200).json({
      status: 'success',
      success: true,
      data: sellers.map(s => sanitizePublicSeller(s))
    });

  } catch (error) {
    console.error('Error fetching buyer shops:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch shops',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
