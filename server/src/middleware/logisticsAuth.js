import { protect, restrictTo } from './auth.js';
import LogisticsDashboardService from '../services/logisticsDashboard.service.js';

export const protectLogistics = [
    protect,
    restrictTo('logistics'),
    async (req, res, next) => {
        try {
            if (!req.logisticsPartner && req.user) {
                const partner = await LogisticsDashboardService.getPartnerByTokenPayload(req.user);
                req.logisticsPartner = partner;
                res.locals.logisticsPartner = partner;
            }
            return next();
        } catch (error) {
            return next(error);
        }
    }
];

