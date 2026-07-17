import { refreshAccessToken } from '../shared/utils/refreshToken.js';
import { AppError } from '../shared/utils/errorHandler.js';

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Generate new access token (plus a rolling refresh token)
    const { accessToken, refreshToken: newRefreshToken, user } = refreshAccessToken(refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user
      }
    });
  } catch (error) {
    next(new AppError(error.message || 'Failed to refresh token', 401));
  }
};

