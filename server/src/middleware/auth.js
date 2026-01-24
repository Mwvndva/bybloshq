import { query } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';
import { verifyToken, getTokenFromRequest } from '../utils/jwt.js';

// Import cookie-parser if not already imported
import cookieParser from 'cookie-parser';

// Role-based access control
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

export const protect = async (req, res, next) => {
  try {
    console.log('\n=== Auth Middleware ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request Method:', req.method);

    // Parse cookies if not already parsed
    if (!req.cookies) {
      cookieParser()(req, res, () => { });
    }

    // 1) Get token and check if it exists
    const token = getTokenFromRequest(req);

    if (!token) {
      console.log('No authentication token found in any location');
      console.log('Available headers:', Object.keys(req.headers));
      if (req.cookies) {
        console.log('Available cookies:', Object.keys(req.cookies));
      }
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    console.log('Token found, length:', token ? `${token.length} chars` : 'invalid');

    // 2) Verify token
    console.log('Auth middleware - Verifying token:', '[REDACTED_TOKEN]');
    const decoded = verifyToken(token);
    console.log('Auth middleware - Token verified. User ID:', decoded.id, 'Role:', decoded.role);

    // 3) Find user in unified users table
    let user = null;
    const userType = decoded.role || decoded.type; // backward compatibility

    if (!userType) {
      console.error('No user type/role found in token:', decoded);
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
      // Regular users → query unified users table first by ID only
      // (Role verification happens during profile lookup below)
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
        id: profileResult.rows[0].id, // Use profile ID for backward compatibility
        userId: baseUser.id, // Store the users table ID
        email: baseUser.email,
        userType: userType, // Use the role from the token, not the users table
        ...profileResult.rows[0] // Spread profile data
      };
    }

    // If we get here, user is authenticated
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Attach user to request and proceed
    // Ensure compatibility with code expecting generic 'role' or specific 'userType'
    user.role = user.userType;

    req.user = user;
    res.locals.user = user; // For view rendering

    // Add specific alias for legacy controllers if needed
    if (user.userType === 'organizer') req.organizer = user;

    next();

  } catch (error) {
    // Central error handling for JWT and unexpected errors
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