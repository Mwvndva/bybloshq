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
      cookieParser()(req, res, () => {});
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

    // 3) Find user based on token role/type
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
      // Regular users → query database
      let queryText;
      let queryParams = [decoded.id];

      switch (userType) {
        case 'buyer':
          queryText = 'SELECT id, email, full_name as name FROM buyers WHERE id = $1 AND status = $2';
          queryParams.push('active');
          break;
        case 'seller':
          queryText = 'SELECT id, email FROM sellers WHERE id = $1';
          break;
        case 'organizer':
          queryText = 'SELECT id, email, full_name as name FROM organizers WHERE id = $1';
          break;
        default:
          return next(new AppError('Invalid user role', 401));
      }

      // Execute query
      const result = await query(queryText, queryParams);

      if (!result.rows[0]) {
        return next(new AppError(`The ${userType} belonging to this token no longer exists.`, 401));
      }

      user = {
        id: result.rows[0].id,
        userType: userType
      };

      // Add name for buyer/organizer
      if (userType === 'buyer' || userType === 'organizer') {
        user.name = result.rows[0].name;
      }
      // Seller gets only id + userType (no email, as requested)
    }

    // If we get here, user is authenticated
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Attach user to request and proceed
    req.user = user;
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