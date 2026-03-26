import { query } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';
import { verifyToken, getTokenFromRequest, changedPasswordAfter } from '../utils/jwt.js';
import AuthorizationService from '../services/authorization.service.js';
import ProductPolicy from '../policies/ProductPolicy.js';
import OrderPolicy from '../policies/OrderPolicy.js';


// Maps for easy lookup in req.user.can
const policies = {
  product: ProductPolicy,
  order: OrderPolicy
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

    // Admin users authenticate via database (no special hardcoded bypass)
    // Regular users → query unified users table with JOIN to role-specific table
    let userQuery;
    let queryParams = [decoded.id];

    switch (userType) {
      case 'admin':
        // Admin users are in the users table with role='admin'
        userQuery = `
          SELECT u.*, u.id as profile_id
          FROM users u 
          WHERE u.id = $1 AND u.role = 'admin'
        `;
        break;
      case 'buyer':
        userQuery = `
          SELECT
            u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active,
            b.id as profile_id, b.full_name, b.whatsapp_number,
            COALESCE(b.status, 'active') as status
          FROM users u
          LEFT JOIN buyers b ON u.id = b.user_id
          WHERE u.id = $1
            AND (b.status = 'active' OR b.status IS NULL OR b.id IS NULL)
        `;
        break;
      case 'seller':
        userQuery = `
            SELECT 
                u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active,
                s.id as profile_id, s.full_name, s.shop_name, s.whatsapp_number, s.city, s.location, s.balance, s.total_sales, s.client_count, s.status, s.referral_code, s.total_referral_earnings
            FROM users u 
            LEFT JOIN sellers s ON u.id = s.user_id 
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

    // 4) Check if password was changed after the token was issued
    if (userData.password_changed_at && changedPasswordAfter(userData.password_changed_at, decoded.iat)) {
      return next(new AppError('Your password was recently changed. Please log in again.', 401));
    }

    // 5) CROSS-ROLE SUPPORT: Check if user has other role profiles
    // This allows sellers who make purchases to access buyer endpoints
    // Skip for admin users
    let crossRoles = { buyer_id: null, seller_id: null, organizer_id: null };

    if (userType !== 'admin') {
      const crossRoleQuery = `
        SELECT 
          (SELECT id FROM buyers WHERE user_id = $1 AND status = 'active' LIMIT 1) as buyer_id,
          (SELECT id FROM sellers WHERE user_id = $1 LIMIT 1) as seller_id
      `;
      const crossRoleResult = await query(crossRoleQuery, [decoded.id]);
      crossRoles = crossRoleResult.rows[0];
    }

    // Standardize user identity to prevent overlap between roles
    user = {
      id: userData.user_table_id || decoded.id, // PRIMARY ID: Users Table ID (global)
      userId: userData.user_table_id || decoded.id, // Alias for clarity
      email: userData.email,
      userType: userType,
      role: userData.role,

      // Profile IDs for current and cross-roles
      profileId: userData.profile_id, // The ID of the profile used for this login
      buyerId: crossRoles.buyer_id,
      sellerId: crossRoles.seller_id,

      // Boolean flags
      hasBuyerProfile: !!crossRoles.buyer_id,
      hasSellerProfile: !!crossRoles.seller_id,

      ...userData
    };

    // Add explicit aliases so any code referencing the old non-existent names works
    user.sellerProfileId = user.sellerId;
    user.buyerProfileId = user.buyerId;

    if (userType !== 'admin') {
      console.log(`[AUTH] Identity verified for ${user.email}: UserID=${user.id}, ProfileID=${user.profileId}, Roles: [${user.hasBuyerProfile ? 'buyer' : ''}${user.hasSellerProfile ? ', seller' : ''}]`);
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
