// Account-switching handlers. Let a user who owns more than one profile type
// (buyer / seller / ambassador[creator]) move between those accounts without
// re-entering their password. Ownership is derived from req.user, which the
// `protect` middleware already resolves from the buyers/sellers/creators tables.
import { AppError } from '../shared/utils/errorHandler.js';
import { signToken } from '../shared/utils/jwt.js';
import { generateRefreshToken } from '../shared/utils/refreshToken.js';
import { setAuthCookie } from '../shared/utils/cookie.utils.js';

const VALID_ROLES = ['buyer', 'seller', 'creator'];

const ownedAccounts = (user) => ({
  buyer: !!user.hasBuyerProfile,
  seller: !!user.hasSellerProfile,
  creator: !!user.hasCreatorProfile,
});

/**
 * GET /api/auth/accounts
 * Report which account types the authenticated user owns so the client can
 * offer an account switcher only when there is somewhere to switch to.
 */
export const myAccounts = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      current: req.user.userType,
      accounts: ownedAccounts(req.user),
    },
  });
};

/**
 * POST /api/auth/switch  { role }
 * Issue a fresh access + refresh token for another role the SAME user already
 * owns. Only roles the user actually has a profile for are permitted, so this
 * can never be used to reach an account the caller does not own.
 */
export const switchRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};

    if (!VALID_ROLES.includes(role)) {
      return next(new AppError('Invalid account type.', 400));
    }

    if (!ownedAccounts(req.user)[role]) {
      return next(new AppError('You do not have that account.', 403));
    }

    const token = signToken(req.user.id, role, req.user.email);
    const refreshToken = generateRefreshToken(req.user.id, role);
    setAuthCookie(res, token);

    res.status(200).json({
      status: 'success',
      data: { token, refreshToken, role },
    });
  } catch (error) {
    next(error);
  }
};
