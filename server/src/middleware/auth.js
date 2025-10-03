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
    console.log('🔐 Authenticating request:', {
      url: req.originalUrl,
      method: req.method,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });
    
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
    
    console.log('Token found, length:', token ? token.length : 'invalid');

    // 2) Verify token
    console.log('Auth middleware - Verifying token:', token);
    const decoded = verifyToken(token);
    console.log('Auth middleware - Token verified. User ID:', decoded.id, 'Role:', decoded.role);

    // 3) Find user based on token role/type
    let user = null;
    const userType = decoded.role || decoded.type; // Handle both 'role' and 'type' for backward compatibility
    
    if (!userType) {
      console.error('No user type/role found in token:', decoded);
      return next(new AppError('Invalid token: missing user type/role', 401));
    }
    
    // For admin, no need to query the database
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
      try {
        let queryText;
        let queryParams = [decoded.id];
        
        // Select the appropriate query based on user type
        switch (userType) {
          case 'buyer':
            queryText = 'SELECT id, email, full_name as name FROM buyers WHERE id = $1 AND status = $2';
            queryParams.push('active');
            break;
          case 'seller':
            // Use a safer query that doesn't rely on potentially missing columns
            queryText = 'SELECT id, email FROM sellers WHERE id = $1';
            break;
          case 'organizer':
            queryText = 'SELECT id, email, full_name as name FROM organizers WHERE id = $1';
            break;
          default:
            return next(new AppError('Invalid user role', 401));
        }
        
        // Execute the query
        const result = await query(queryText, queryParams);

        if (!result.rows[0]) {
          return next(new AppError(`The ${userType} belonging to this token no longer exists.`, 401));
        }
        
        user = result.rows[0];
        user.userType = userType;

        console.log('✅ User authenticated successfully:', {
          userId: user.id,
          userType: user.userType,
          email: user.email,
          url: req.originalUrl
        });
      } catch (dbError) {
        console.error('❌ Database error during user lookup:', dbError);
        return next(new AppError('Error during authentication', 500));
      }

      if (!user) {
        console.log('❌ No user found for token');
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }

      // Add user type to the user object
      user.userType = userType;
    }


    // 4) Grant access to protected route
    req.user = user;
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
