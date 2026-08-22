import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import logger from './logger.js';

/**
 * Sign a JWT token with user ID and role
 * @param {string|number} id - User ID
 * @param {string} role - User role (buyer, seller, organizer, admin)
 * @returns {string} JWT token
 */
const VALID_ROLES = ['buyer', 'seller', 'creator', 'admin', 'marketing', 'logistics'];
const JWT_ISSUER = 'byblos-auth-api';
const JWT_AUDIENCE = 'byblos-clients';

export const signToken = (id, role = 'buyer', extraClaims = {}) => {
  if (!id) {
    throw new Error('User ID is required to sign a token');
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  let payload = { id, role };
  if (typeof extraClaims === 'string') {
    payload.email = extraClaims;
  } else if (typeof extraClaims === 'object' && extraClaims !== null) {
    payload = { ...payload, ...extraClaims };
  }

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  );
};

/**
 * Sign a short-lived auto-login token for post-payment authentication
 * @param {string|number} id - User ID
 * @param {string} role - User role (buyer, seller, organizer, admin)
 * @param {string} purpose - Token purpose (e.g., 'payment_success')
 * @returns {string} Short-lived JWT token
 */
export const signAutoLoginToken = (id, role = 'buyer', purpose = 'payment_success') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(
    { id, role, purpose, autoLogin: true },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: '5m'
    }
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });

    if (decoded.iss && decoded.iss !== JWT_ISSUER) {
      const err = new AppError('Token issuer mismatch', 401);
      err.code = 'INVALID_TOKEN_ISSUER';
      throw err;
    }
    if (decoded.aud && decoded.aud !== JWT_AUDIENCE) {
      const err = new AppError('Token audience mismatch', 401);
      err.code = 'INVALID_TOKEN_AUDIENCE';
      throw err;
    }

    // Handle both 'role' and 'type' fields for backward compatibility
    if (decoded.type && !decoded.role) {
      decoded.role = decoded.type;
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === 'TokenExpiredError') {
      const err = new AppError('Your token has expired! Please log in again.', 401);
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    logger.error('JWT Verification Error:', error.message);
    const err = new AppError('Invalid token. Please log in again!', 401);
    err.code = 'INVALID_TOKEN';
    throw err;
  }
};

/**
 * Get token from request headers or cookies
 * @param {Object} req - Express request object
 * @returns {string} Token string or null if not found
 */
export const getTokenFromRequest = (req) => {
  // 1. Authorization header takes highest priority (explicit, programmatic)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // 2. x-access-token header (used by Capacitor/Ionic mobile webviews)
  const customHeader = req.headers['x-access-token'] || req.headers['X-Access-Token'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader.trim();
  }

  // 3. 'jwt' cookie — used by all authenticated web/mobile requests
  if (req.cookies?.jwt) {
    return req.cookies.jwt;
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
