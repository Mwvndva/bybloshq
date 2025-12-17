import jwt from 'jsonwebtoken';

/**
 * Generate a refresh token (longer-lived)
 * @param {string|number} id - User ID
 * @param {string} role - User role
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (id, role = 'buyer') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign(
    { id, role, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // 24 hours for refresh token
  );
};

/**
 * Verify a refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
export const verifyRefreshToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ensure this is a refresh token
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
 * Generate new access token from refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} New access token and user info
 */
export const refreshAccessToken = (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  
  // Generate new access token
  const accessToken = jwt.sign(
    { id: decoded.id, role: decoded.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return {
    accessToken,
    user: {
      id: decoded.id,
      role: decoded.role
    }
  };
};
