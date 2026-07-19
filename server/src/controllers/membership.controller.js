import Buyer from '../models/buyer.model.js';
import { AppError } from '../shared/utils/errorHandler.js';
import logger from '../shared/utils/logger.js';

// Resolve the buyers.id for the authenticated request. `protect` sets
// req.user.buyerId via the cross-role lookup; fall back to user_id for the
// admin-who-is-also-a-buyer edge case (mirrors buyer.controller.getProfile).
const resolveBuyerId = async (req) => {
  let buyerId = req.user.buyerId;
  if (!buyerId) {
    const userId = req.user.userId || req.user.id;
    if (userId) {
      const buyer = await Buyer.findByUserId(userId);
      buyerId = buyer?.id;
    }
  }
  return buyerId;
};

const toPayload = (buyer) => ({
  isMember: !!buyer.isMember,
  memberNumber: buyer.memberNumber ?? null,
  joinedAt: buyer.membershipJoinedAt ?? null,
});

// GET /api/buyers/membership — current membership status (drives the opt-in prompt).
export const getMembership = async (req, res, next) => {
  try {
    const buyerId = await resolveBuyerId(req);
    if (!buyerId) {
      return next(new AppError('No buyer profile found for this account', 404));
    }
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return next(new AppError('No buyer profile found for this account', 404));
    }
    res.status(200).json({ status: 'success', data: toPayload(buyer) });
  } catch (error) {
    next(error);
  }
};

// POST /api/buyers/membership/join — opt in and mint the membership number.
export const joinMembership = async (req, res, next) => {
  try {
    const buyerId = await resolveBuyerId(req);
    if (!buyerId) {
      return next(new AppError('No buyer profile found for this account', 404));
    }
    const result = await Buyer.joinMembership(buyerId);
    if (!result) {
      return next(new AppError('Could not activate membership. Please try again.', 500));
    }
    logger.info(`[MEMBERSHIP] Buyer ${buyerId} is now Byblos member No. ${result.memberNumber}`);
    res.status(200).json({ status: 'success', data: toPayload(result) });
  } catch (error) {
    logger.error('Error in joinMembership:', error);
    next(error);
  }
};
