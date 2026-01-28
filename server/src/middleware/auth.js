import { query } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';
import { verifyToken, getTokenFromRequest } from '../utils/jwt.js';
import AuthorizationService from '../services/authorization.service.js';
import ProductPolicy from '../policies/ProductPolicy.js';
import OrderPolicy from '../policies/OrderPolicy.js';
import EventPolicy from '../policies/EventPolicy.js';

// Import cookie-parser if not already imported
import cookieParser from 'cookie-parser';

// Maps for easy lookup in req.user.can
const policies = {
  product: ProductPolicy,
  order: OrderPolicy,
  event: EventPolicy
};

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

export const protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    const token = getTokenFromRequest(req);
    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = verifyToken(token);
    const userType = decoded.role || decoded.type; // backward compatibility

    if (!userType) {
      return next(new AppError('Invalid token: missing user type/role', 401));
    }

    // 3) Unified Query: Fetch User + Profile in one go
    let user = null;

    // Special case: hardcoded admin
    if (userType === 'admin') {
      if (decoded.id === 'admin') {
        user = { id: 'admin', email: 'admin@byblos.com', userType: 'admin', permissions: [] };
        req.user = user;
        return next();
      } else {
        return next(new AppError('Invalid admin credentials', 401));
      }
    }

    // Construct JOIN query based on role
    let queryText = '';
    let queryParams = [decoded.id];

    switch (userType) {
      case 'buyer':
        queryText = `
          SELECT u.id as user_id_main, u.email, u.is_verified, u.role,
                 b.*
          FROM users u
          JOIN buyers b ON u.id = b.user_id
          WHERE u.id = $1 AND b.status = 'active'
        `;
        break;
      case 'seller':
        queryText = `
          SELECT u.id as user_id_main, u.email, u.is_verified, u.role,
                 s.*
          FROM users u
          JOIN sellers s ON u.id = s.user_id
          WHERE u.id = $1
        `;
        break;
      case 'organizer':
        queryText = `
          SELECT u.id as user_id_main, u.email, u.is_verified, u.role,
                 o.*
          FROM users u
          JOIN organizers o ON u.id = o.user_id
          WHERE u.id = $1
        `;
        break;
      default:
        return next(new AppError('Invalid user role', 401));
    }

    const { rows } = await query(queryText, queryParams);

    if (rows.length === 0) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    const userData = rows[0];

    // Normalize user object
    user = {
      ...userData,
      id: userData.id, // Profile ID (e.g., seller.id)
      userId: userData.user_id_main || userData.user_id, // Main User ID
      email: userData.email,
      userType: userType
    };

    // 4) Fetch permissions (optimized check if needed, or keeping existing service call)
    // Minimizing DB calls: If permissions are complex, maybe keep separate service call.
    // For now, assume AuthorizationService caches or is fast enough.
    // If permissions table is linked, we could triple-JOIN, but that gets complex.
    user.permissions = await AuthorizationService.getUserPermissions(user.userId);

    // 5) Attach helper
    user.can = async (permission, resource = null, policyKey = null, action = null) => {
      const policy = policyKey ? policies[policyKey] : null;
      return await AuthorizationService.can(user, permission, policy, action, resource);
    };

    req.user = user;
    res.locals.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    console.error('Authentication error:', error);
    return next(new AppError('Authentication failed', 500));
  }
};
