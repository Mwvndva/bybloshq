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
    // console.log('\n=== Auth Middleware ===');
    // console.log('Request URL:', req.originalUrl);

    // Parse cookies if not already parsed
    if (!req.cookies) {
      cookieParser()(req, res, () => { });
    }

    // 1) Get token and check if it exists
    const token = getTokenFromRequest(req);

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = verifyToken(token);

    // 3) Find user in unified users table
    let user = null;
    const userType = decoded.role || decoded.type; // backward compatibility

    if (!userType) {
      return next(new AppError('Invalid token: missing user type/role', 401));
    }

    // Special case: hardcoded admin (no DB lookup)
    if (userType === 'admin') {
      if (decoded.id === 'admin') {
        user = {
          id: 'admin',
          email: 'admin@byblos.com',
          userType: 'admin'
        };
      } else {
        return next(new AppError('Invalid admin credentials', 401));
      }
    } else {
      // Regular users → query unified users table 
      const userQuery = 'SELECT * FROM users WHERE id = $1';
      const userResult = await query(userQuery, [decoded.id]);

      if (!userResult.rows[0]) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }

      const baseUser = userResult.rows[0];

      // Now fetch profile data based on role
      let profileQuery;
      let profileResult;

      switch (userType) {
        case 'buyer':
          profileQuery = 'SELECT * FROM buyers WHERE user_id = $1 AND status = $2';
          profileResult = await query(profileQuery, [baseUser.id, 'active']);
          break;
        case 'seller':
          profileQuery = 'SELECT * FROM sellers WHERE user_id = $1';
          profileResult = await query(profileQuery, [baseUser.id]);
          break;
        case 'organizer':
          profileQuery = 'SELECT * FROM organizers WHERE user_id = $1';
          profileResult = await query(profileQuery, [baseUser.id]);
          break;
        default:
          return next(new AppError('Invalid user role', 401));
      }

      if (!profileResult.rows[0]) {
        return next(new AppError(`Profile for ${userType} not found.`, 401));
      }

      // Merge user and profile data
      user = {
        id: profileResult.rows[0].id,
        userId: baseUser.id,
        email: baseUser.email,
        userType: userType,
        ...profileResult.rows[0]
      };
    }

    // 4) Fetch permissions and attach to user
    user.permissions = await AuthorizationService.getUserPermissions(user.userId || user.id);

    // 5) Attach helper method for easier checks in controllers
    // Usage: if (await req.user.can('manage-products', product, 'product', 'manage'))
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
