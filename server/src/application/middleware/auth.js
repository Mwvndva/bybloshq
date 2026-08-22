import { AppError } from '../../shared/utils/errorHandler.js';
import { verifyToken, getTokenFromRequest, changedPasswordAfter } from '../../shared/utils/jwt.js';
import AuthorizationService from '../../domains/identity/auth/authorization.service.js';
import ProductPolicy from './policies/ProductPolicy.js';
import OrderPolicy from './policies/OrderPolicy.js';
import CacheService from '../../shared/utils/cache.service.js';
import logger from '../../shared/utils/logger.js';
import TokenBlacklistService from '../../domains/identity/tokens/tokenBlacklist.service.js';
import * as userRepository from '../../domains/identity/users/user.repository.js';


// Maps for easy lookup in req.user.can
const policies = {
  product: ProductPolicy,
  order: OrderPolicy
};

// Short-lived in-memory cache for auth results to reduce DB load under concurrent requests.
// Key: JWT token, Value: { user, expiresAt }
// 5 seconds is used to mitigate risk of stale cache in multi-instance environments.
const _authCache = new Map();
const AUTH_CACHE_TTL_MS = 5 * 1000;
const MAX_AUTH_CACHE_SIZE = 200; // FIXED BUG-AUTH-06: reduced from 500 to limit memory

// FIXED BUG-AUTH-06: cleanup every 15s to match 5s TTL, prevent stale entry buildup
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _authCache.entries()) {
    if (val.expiresAt < now) _authCache.delete(key);
  }
}, 15 * 1000).unref();

/**
 * Middleware to restrict access based on permissions
 * @param  {...string} permissions 
 */
export const hasPermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      for (const permission of permissions) {
        const hasPerm = await AuthorizationService.hasPermission(req.user, permission);
        if (hasPerm) return next();
      }

      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to restrict access based on user roles
 * @param {...string} roles - Permitted roles (e.g. 'marketing', 'admin', 'logistics')
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || req.user?.userType;
    if (!userRole || !roles.includes(userRole)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

export const protect = async (req, res, next) => {
  try {
    // console.log('\n=== Auth Middleware ===');
    // console.log('Request URL:', req.originalUrl);

    // 1) Get token and check if it exists
    const token = getTokenFromRequest(req);

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // Check token Blacklist BEFORE verifying (fast path — Redis lookup)
    try {
      const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);
      if (isBlacklisted) {
        return next(new AppError('Your session has been invalidated. Please log in again.', 401));
      }
    } catch (blacklistErr) {
      // Redis unavailable — fall through (fail open, log the issue)
      logger.warn(`[AUTH][Request ID: ${req.id || 'N/A'}] Token blacklist check failed (Redis unavailable):`, blacklistErr.message);
    }

    // 2) Verify token
    const decoded = verifyToken(token);

    // 3) Find user in unified users table
    let user = null;
    const userType = decoded.role || decoded.type; // backward compatibility

    if (!userType) {
      return next(new AppError('Invalid token: missing user type/role', 401));
    }

    // Cache lookup (skip for admin — always verify fresh)
    if (userType !== 'admin') {
      const cached = _authCache.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        // SECURITY FIX (FIX-11): Even on cache hit, check if user was suspended/deactivated
        if (cached.user.is_active === false || (cached.user.status && cached.user.status === 'suspended')) {
          _authCache.delete(token); // Clear bad entry
          return next(new AppError('Your account has been deactivated or suspended.', 401));
        }
        req.user = cached.user;
        res.locals.user = cached.user;
        return next();
      }
    }
    // Admin users authenticate via database (no special hardcoded bypass)
    // Regular users → query unified users table via user.repository
    let userData = null;

    switch (userType) {
      case 'admin':
        userData = await userRepository.findAdminAuthProfile(decoded.id);
        break;
      case 'buyer':
        userData = await userRepository.findBuyerAuthProfile(decoded.id);
        break;
      case 'seller':
        userData = await userRepository.findSellerAuthProfile(decoded.id);
        break;
      case 'creator':
        userData = await userRepository.findCreatorAuthProfile(decoded.id);
        break;
      case 'marketing':
        userData = await userRepository.findMarketingAuthProfile(decoded.id);
        break;
      case 'logistics':
        userData = await userRepository.findLogisticsAuthProfile(decoded.id);
        break;
      default:
        return next(new AppError('Invalid user role', 401));
    }

    if (!userData) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Check if password was changed after the token was issued
    if (userData.password_changed_at && changedPasswordAfter(userData.password_changed_at, decoded.iat)) {
      return next(new AppError('Your password was recently changed. Please log in again.', 401));
    }

    // 5) CROSS-ROLE SUPPORT: Check if user has other role profiles
    // This allows sellers who make purchases to access buyer endpoints
    // Skip for admin, marketing, and logistics users
    let crossRoles = { buyer_id: null, seller_id: null, creator_id: null };

    if (userType !== 'admin' && userType !== 'marketing' && userType !== 'logistics') {
      const cacheKey = `user:${decoded.id}:cross-roles`;
      const cachedRoles = await CacheService.get(cacheKey);

      if (cachedRoles) {
        crossRoles = cachedRoles;
      } else {
        crossRoles = await userRepository.findCrossRolesByUserId(decoded.id);

        // Keep cross-role cache aligned with the auth cache so profile suspensions take effect quickly.
        await CacheService.set(cacheKey, crossRoles, Math.ceil(AUTH_CACHE_TTL_MS / 1000));
      }
    }

    if (userType !== 'admin' && userType !== 'marketing' && userType !== 'logistics' && !userData.is_verified) {
      const error = new AppError('Please verify your email address to access this feature.', 403);
      error.code = 'EMAIL_NOT_VERIFIED';
      error.email = userData.email;
      return next(error);
    }

    // Standardize user identity to prevent overlap between roles
    user = {
      id: userData.user_table_id || decoded.id, // PRIMARY ID: Users Table ID (global)
      userId: userData.user_table_id || decoded.id, // Alias for clarity
      email: userData.email,
      userType: userType,
      role: userData.role,
      is_verified: userData.is_verified,

      // Profile IDs for current and cross-roles
      profileId: userData.profile_id, // The ID of the profile used for this login
      buyerId: crossRoles.buyer_id,
      sellerId: crossRoles.seller_id,
      creatorId: crossRoles.creator_id,

      // Boolean flags
      hasBuyerProfile: !!crossRoles.buyer_id,
      hasSellerProfile: !!crossRoles.seller_id,
      hasCreatorProfile: !!crossRoles.creator_id,

      ...userData
    };

    // Add explicit aliases so any code referencing the old non-existent names works
    user.sellerProfileId = user.sellerId;
    user.buyerProfileId = user.buyerId;
    user.creatorProfileId = user.creatorId;

    if (userType === 'logistics' && userData.profile_id) {
      req.logisticsPartner = {
        id: userData.profile_id,
        name: userData.partner_name,
        slug: userData.partner_slug,
        userId: userData.user_table_id || decoded.id,
        email: userData.email
      };
      res.locals.logisticsPartner = req.logisticsPartner;
    }

    if (userType !== 'admin') {
      logger.debug(`[AUTH] Identity verified`, { userId: user.id, userType: user.userType });
    }

    // 4) Fetch permissions and attach to user
    const lookupId = user.userId || user.id;
    user.permissions = await AuthorizationService.getUserPermissions(lookupId);

    // DEBUG: Log IDs
    logger.debug(`[AUTH] User IDs: userId=${user.userId}, id=${user.id}, lookupId=${lookupId}`);


    // 5) Attach helper method for easier checks in controllers
    user.can = async (permission, resource = null, policyKey = null, action = null) => {
      const policy = policyKey ? policies[policyKey] : null;
      const result = await AuthorizationService.can(user, permission, policy, action, resource);
      logger.debug(`[AUTH] Permission check: ${permission}? ${result}`, { userId: user.id });
      return result;
    };

    req.user = user;
    res.locals.user = user;

    // Cache the auth result (not for admin)
    if (userType !== 'admin') {
      // Limit cache size to prevent OOM
      if (_authCache.size >= MAX_AUTH_CACHE_SIZE) {
        const firstKey = _authCache.keys().next().value;
        _authCache.delete(firstKey);
      }

      _authCache.set(token, {
        user,
        expiresAt: Date.now() + AUTH_CACHE_TTL_MS
      });
    }

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.message?.includes('Invalid token')) {
      logger.warn('[SECURITY-ALERT] Invalid JWT attempt', {
        error: error.message,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        url: req.originalUrl
      });
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (error.name === 'TokenExpiredError' || error.message?.includes('expired')) {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }

    logger.error(`[AUTH-ERROR][Request ID: ${req.id || 'N/A'}] Authentication failed:`, error);
    return next(new AppError(error.message || 'Authentication failed', 401));
  }
};

/**
 * Invalidate auth cache for a specific token.
 * Call this after profile updates.
 */
export const invalidateAuthCache = (token) => {
  if (token && typeof token === 'string') {
    _authCache.delete(token.trim());
  }
};



