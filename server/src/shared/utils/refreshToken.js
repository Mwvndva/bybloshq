import jwt from 'jsonwebtoken';

/**
 * Generate a refresh token (longer-lived, uses JWT_REFRESH_SECRET)
 * Block 4 fix: Use a separate secret for refresh tokens so that
 * a compromised access-token secret does not also compromise refresh tokens.
 * @param {string|number} id - User ID
 * @param {string} role - User role
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (id, role = 'buyer') => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (or JWT_SECRET fallback) is not defined');
  }

  return jwt.sign(
    { id, role, type: 'refresh' },
    secret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
  );
};

/**
 * Verify a refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
export const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (or JWT_SECRET fallback) is not defined');
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired. Please log in again.');
    }
    throw new Error('Invalid refresh token');
  }
};

/**
 * Generate new access token from refresh token.
 * Access tokens use JWT_SECRET (short-lived), refresh tokens use JWT_REFRESH_SECRET (long-lived).
 * @param {string} refreshToken - Refresh token
 * @returns {Object} New access token and user info
 */
export const refreshAccessToken = (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);

  // Access token always uses JWT_SECRET — separate from refresh secret
  const accessToken = jwt.sign(
    { id: decoded.id, role: decoded.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  // Rolling refresh: mint a brand-new refresh token on every refresh so a user
  // who keeps opening the app never has to log in again — the window slides
  // forward each time instead of expiring a fixed period after first login.
  const newRefreshToken = generateRefreshToken(decoded.id, decoded.role);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: decoded.id,
      role: decoded.role
    }
  };
};
