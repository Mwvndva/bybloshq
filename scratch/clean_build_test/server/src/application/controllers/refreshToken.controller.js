import { refreshAccessToken } from '../../shared/utils/refreshToken.js';
import { AppError } from '../../shared/utils/errorHandler.js';
import { setAuthCookie } from '../../shared/utils/cookie.utils.js';

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (req, res, next) => {
  try {
    const tokenString = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!tokenString) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Generate new access token (plus a rolling refresh token)
    const { accessToken, refreshToken: newRefreshToken, user } = refreshAccessToken(tokenString);

    // Set updated HttpOnly jwt access cookie for Web browser sessions
    setAuthCookie(res, accessToken);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh-token',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      domain: process.env.COOKIE_DOMAIN || undefined
    });

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

