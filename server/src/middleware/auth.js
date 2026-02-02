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
      // Regular users → query unified users table with JOIN to role-specific table
      let userQuery;
      let queryParams = [decoded.id];

      switch (userType) {
        case 'buyer':
          userQuery = `
            SELECT u.*, b.* 
            FROM users u 
            LEFT JOIN buyers b ON u.id = b.user_id 
            WHERE u.id = $1 AND b.status = $2
          `;
          queryParams.push('active');
          break;
        case 'seller':
          userQuery = `
            SELECT u.*, s.* 
            FROM users u 
            LEFT JOIN sellers s ON u.id = s.user_id 
            WHERE u.id = $1
          `;
          break;
        case 'organizer':
          userQuery = `
            SELECT u.*, o.* 
            FROM users u 
            LEFT JOIN organizers o ON u.id = o.user_id 
            WHERE u.id = $1
          `;
          break;
        default:
          return next(new AppError('Invalid user role', 401));
      }

      const userResult = await query(userQuery, queryParams);

      if (!userResult.rows[0]) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }

      const userData = userResult.rows[0];

      // CROSS-ROLE SUPPORT: Check if user has other role profiles
      // This allows sellers who make purchases to access buyer endpoints
      const crossRoleQuery = `
        SELECT 
          (SELECT COUNT(*) FROM buyers WHERE user_id = $1 AND status = 'active') as has_buyer,
          (SELECT COUNT(*) FROM sellers WHERE user_id = $1) as has_seller,
          (SELECT COUNT(*) FROM organizers WHERE user_id = $1) as has_organizer
      `;
      const crossRoleResult = await query(crossRoleQuery, [decoded.id]);
      const crossRoles = crossRoleResult.rows[0];

      // Merge user and profile data
      user = {
        id: userData.id, // Profile ID from role-specific table
        userId: decoded.id, // User ID from users table
        email: userData.email,
        userType: userType,
        hasBuyerProfile: crossRoles.has_buyer > 0,
        hasSellerProfile: crossRoles.has_seller > 0,
        hasOrganizerProfile: crossRoles.has_organizer > 0,
        ...userData
      };

      console.log(`[AUTH] Cross-role check for ${user.email}: buyer=${user.hasBuyerProfile}, seller=${user.hasSellerProfile}, organizer=${user.hasOrganizerProfile}`);
    }

    // 4) Fetch permissions and attach to user
    const lookupId = user.userId || user.id;
    user.permissions = await AuthorizationService.getUserPermissions(lookupId);

    // DEBUG: Log permissions and IDs
    console.log(`[AUTH] User ${user.email} (type: ${userType}) IDs: userId=${user.userId}, id=${user.id}, lookupId=${lookupId}`);
    console.log(`[AUTH] Permissions for ${user.email}:`, Array.from(user.permissions));

    // 5) Attach helper method for easier checks in controllers
    user.can = async (permission, resource = null, policyKey = null, action = null) => {
      const policy = policyKey ? policies[policyKey] : null;
      const result = await AuthorizationService.can(user, permission, policy, action, resource);
      console.log(`[AUTH] Permission check: ${user.email} can '${permission}'? ${result}`);
      return result;
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
