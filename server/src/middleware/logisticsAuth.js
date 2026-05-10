import { AppError } from '../shared/utils/errorHandler.js';
import { getTokenFromRequest, verifyToken } from '../shared/utils/jwt.js';
import LogisticsDashboardService from '../services/logisticsDashboard.service.js';

export const protectLogistics = async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            return next(new AppError('You are not logged in! Please log in to get access.', 401));
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
