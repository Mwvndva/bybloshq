// Session revocation helpers shared by every role's logout handler.
//
// AUTH FIX: logout previously blacklisted ONLY the 24h access token, leaving the
// 90-day refresh token fully valid — and the refresh flow never consulted the
// blacklist. A logged-out (or stolen post-logout) refresh token could therefore
// mint fresh access tokens for up to 90 days. Revoking BOTH tokens on logout,
// combined with the blacklist check added to refreshAccessToken(), makes logout
// actually terminate the session.
import tokenBlacklist from '../../domains/identity/tokens/tokenBlacklist.service.js';
import { getTokenFromRequest, verifyToken } from './jwt.js';
import { verifyRefreshToken } from './refreshToken.js';
import logger from './logger.js';

/**
 * Blacklist both the access token and the refresh token attached to a request.
 * Each token is decoded with its own secret to derive the correct TTL; failures
 * (expired/invalid/malformed) are non-fatal — logout must always succeed.
 * @param {import('express').Request} req
 */
export async function revokeSessionTokens(req) {
  // 1) Access token — Authorization header, x-access-token, or jwt cookie.
  const accessToken = getTokenFromRequest(req);
  if (accessToken) {
    try {
      const decoded = verifyToken(accessToken);
      await tokenBlacklist.addToken(accessToken, decoded.exp);
    } catch (err) {
      logger.debug('[LOGOUT] Could not blacklist access token:', err.message);
    }
  }

  // 2) Refresh token — cookie or body; signed with the separate refresh secret.
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken && typeof refreshToken === 'string') {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await tokenBlacklist.addToken(refreshToken, decoded.exp);
    } catch (err) {
      logger.debug('[LOGOUT] Could not blacklist refresh token:', err.message);
    }
  }
}

/**
 * Clear all auth cookies (access jwt/token + refresh) so the browser session ends.
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
  };
  res.cookie('jwt', '', { ...base, path: '/' });
  res.cookie('token', '', { ...base, path: '/' });
  // Refresh cookie is scoped to the refresh route — clear it on the same path.
  res.cookie('refreshToken', '', { ...base, path: '/api/auth/refresh-token' });
}

export default { revokeSessionTokens, clearAuthCookies };
