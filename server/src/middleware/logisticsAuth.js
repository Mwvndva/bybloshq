import { AppError } from '../shared/utils/errorHandler.js';
import { getTokenFromRequest, verifyToken } from '../shared/utils/jwt.js';
import LogisticsDashboardService from '../services/logisticsDashboard.service.js';
import TokenBlacklistService from '../services/tokenBlacklist.service.js';
import logger from '../shared/utils/logger.js';

export const protectLogistics = async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            return next(new AppError('You are not logged in! Please log in to get access.', 401));
        }

        // Check token Blacklist BEFORE verifying (fast path — Redis lookup)
        try {
            const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);
            if (isBlacklisted) {
                return next(new AppError('Your session has been invalidated. Please log in again.', 401));
            }
        } catch (blacklistErr) {
            // Redis unavailable — fall through (fail open, log the issue)
            logger.warn(`[AUTH][LOGISTICS][Request ID: ${req.id || 'N/A'}] Token blacklist check failed (Redis unavailable):`, blacklistErr.message);
        }

        const decoded = verifyToken(token);
        if (decoded.role !== 'logistics') {
            return next(new AppError('This route is only available to logistics partners.', 403));
        }

        const partner = await LogisticsDashboardService.getPartnerByTokenPayload(decoded);
        req.logisticsPartner = partner;
        res.locals.logisticsPartner = partner;
        return next();
    } catch (error) {
        return next(error);
    }
};

