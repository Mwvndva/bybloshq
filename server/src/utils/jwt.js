import jwt from 'jsonwebtoken';
import AppError from './appError.js';

/**
 * Sign a JWT token with user ID and role
 * @param {string|number} id - User ID
 * @param {string} role - User role (buyer, seller, organizer, admin)
 * @returns {string} JWT token
 */
export const signToken = (id, role = 'buyer') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle both 'role' and 'type' fields for backward compatibility
    if (decoded.type && !decoded.role) {
      decoded.role = decoded.type;
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Your token has expired! Please log in again.', 401);
    }
    console.error('JWT Verification Error:', error.message);
    throw new AppError('Invalid token. Please log in again!', 401);
  }
};

/**
 * Get token from request headers or cookies
 * @param {Object} req - Express request object
 * @returns {string} Token string or null if not found
 */
export const getTokenFromRequest = (req) => {
  // 1) Check Authorization header (case-insensitive check)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // 2) Check cookies
  if (req.cookies?.jwt) {
    return req.cookies.jwt;
  }

  // 3) Check query parameters (for testing only, not recommended for production)
  if (req.query?.token) {
    return req.query.token;
  }

  return null;
};

/**
 * Middleware to check if the user has changed their password after the token was issued
 * @param {Date} passwordChangedAt - When the password was last changed
 * @param {number} iat - Token issued at timestamp
 * @returns {boolean} True if password was changed after token was issued
 */
export const changedPasswordAfter = (passwordChangedAt, iat) => {
  if (passwordChangedAt) {
    const changedTimestamp = Math.floor(passwordChangedAt.getTime() / 1000);
    return iat < changedTimestamp;
  }
  return false;
};
