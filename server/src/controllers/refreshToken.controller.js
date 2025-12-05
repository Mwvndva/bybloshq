import { refreshAccessToken } from '../utils/refreshToken.js';
import AppError from '../utils/appError.js';

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Generate new access token
    const { accessToken, user } = refreshAccessToken(refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        user
      }
    });
  } catch (error) {
    next(new AppError(error.message || 'Failed to refresh token', 401));
  }
};
