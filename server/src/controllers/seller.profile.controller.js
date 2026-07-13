// Seller profile/settings handlers (profile read/update, theme, image uploads).
// Split from seller.controller.js in Phase 15.7b; re-exported via that barrel.
import { query } from '../shared/db/database.js';
import { invalidateAuthCache } from '../middleware/auth.js';
import logger from '../shared/utils/logger.js';
import ImageService from '../services/image.service.js';
import { getTokenFromRequest } from '../shared/utils/jwt.js';
import { findSellerByUserId, findSellerById, isShopNameAvailable, updateSeller } from '../models/seller.model.js';
import { sanitizeSeller } from '../shared/utils/sanitize.js';

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

    // Add verification status from req.user (Task 10 fix)
    seller.is_verified = req.user.is_verified;

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

    if (req.body.bio !== undefined) {
      const bio = String(req.body.bio || '').trim();
      if (bio.length > 500) {
        return res.status(400).json({ status: 'error', message: 'Bio must be at most 500 characters' });
      }
      req.body.bio = bio;
    }

    if (req.body.avatarUrl !== undefined || req.body.avatar_url !== undefined) {
      const avatarUrl = String(req.body.avatarUrl ?? req.body.avatar_url ?? '').trim();
      const isAllowedAvatar =
        avatarUrl === '' ||
        avatarUrl.startsWith('/') ||
        /^https?:\/\//i.test(avatarUrl);

      if (!isAllowedAvatar) {
        return res.status(400).json({ status: 'error', message: 'Business photo must be a valid image URL' });
      }

      req.body.avatarUrl = avatarUrl || null;
      delete req.body.avatar_url;
    }

    if (req.body.creatorCommissionRate !== undefined || req.body.creator_commission_rate !== undefined) {
      const rawRate = req.body.creatorCommissionRate ?? req.body.creator_commission_rate;
      const normalizedRate = Number(rawRate);

      if (!Number.isFinite(normalizedRate) || normalizedRate < 0.01 || normalizedRate > 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Creator commission must be between 1% and 100%'
        });
      }

      req.body.creatorCommissionRate = normalizedRate;
      delete req.body.creator_commission_rate;
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

    if (req.body.creatorCommissionRate !== undefined) {
      await query(
        `UPDATE seller_creator_links
         SET commission_rate = $1,
             updated_at = NOW()
         WHERE seller_id = $2
           AND status = 'active'`,
        [req.body.creatorCommissionRate, sellerId]
      );
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

// @desc    Upload a banner image for the seller
// @route   POST /api/sellers/upload-banner
// @access  Private
export const uploadBanner = async (req, res) => {
  try {
    const sellerId = req.user?.sellerId;

    if (!sellerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Seller profile required'
      });
    }

    let { bannerImage } = req.body;

    // 1. Handle Multipart Upload (req.file)
    if (req.file) {
      const base64String = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      bannerImage = await ImageService.base64ToFile(base64String, 'seller_banner');
    }
    // 2. Fallback to Legacy Base64 (req.body.bannerImage)
    else if (bannerImage && ImageService.isBase64Image(bannerImage)) {
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
    if (error.isOperational) {
      logger.warn(`Banner upload validation failed: ${error.message} for seller ${req.user?.sellerId}`);
      return res.status(error.statusCode || 400).json({
        status: 'error',
        message: error.message
      });
    }
    logger.error('Error uploading banner:', {
      error: error.message,
      stack: error.stack,
      sellerId: req.user?.sellerId
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload banner',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Upload a business photo for the seller
// @route   POST /api/sellers/upload-business-photo
// @access  Private
export const uploadBusinessPhoto = async (req, res) => {
  try {
    const sellerId = req.user?.sellerId;

    if (!sellerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Seller profile required'
      });
    }

    let { businessPhoto } = req.body;

    if (req.file) {
      const base64String = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      businessPhoto = await ImageService.base64ToFile(base64String, 'seller_business_photo');
    } else if (businessPhoto && ImageService.isBase64Image(businessPhoto)) {
      businessPhoto = await ImageService.base64ToFile(businessPhoto, 'seller_business_photo');
    }

    const businessPhotoValue = businessPhoto === '' ? null : businessPhoto;

    const result = await query(
      `UPDATE sellers
       SET avatar_url = $1
       WHERE id = $2
       RETURNING id, avatar_url AS "avatarUrl"`,
      [businessPhotoValue, sellerId]
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
        businessPhotoUrl: result.rows[0].avatarUrl || '',
        avatarUrl: result.rows[0].avatarUrl || ''
      }
    });
  } catch (error) {
    if (error.isOperational) {
      logger.warn(`Business photo upload validation failed: ${error.message} for seller ${req.user?.sellerId}`);
      return res.status(error.statusCode || 400).json({
        status: 'error',
        message: error.message
      });
    }
    logger.error('Error uploading business photo:', {
      error: error.message,
      stack: error.stack,
      sellerId: req.user?.sellerId
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload business photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
