import LogisticsDashboardService from './logisticsDashboard.service.js';
import { setAuthCookie } from '../../shared/utils/cookie.utils.js';
import { AppError } from '../../shared/utils/errorHandler.js';

export const loginLogisticsPartner = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        const result = await LogisticsDashboardService.login({ email, password });

        setAuthCookie(res, result.token);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const logoutLogisticsPartner = async (req, res, next) => {
    try {
        res.clearCookie('jwt', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            domain: process.env.COOKIE_DOMAIN || undefined
        });

        res.status(200).json({
            status: 'success',
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};


export const getLogisticsMe = async (req, res, next) => {
    try {
        res.status(200).json({
            status: 'success',
            data: {
                partner: req.logisticsPartner
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getLogisticsDashboardRequests = async (req, res, next) => {
    try {
        const partnerId = req.logisticsPartner?.id || req.user?.profile_id || req.user?.id;
        if (!partnerId) {
            return next(new AppError('Logistics partner identity not found', 400));
        }

        const dashboard = await LogisticsDashboardService.getDashboardRequests({
            partnerId,
            sort: req.query.sort,
            limit: req.query.limit,
            offset: req.query.offset
        });

        res.status(200).json({
            status: 'success',
            data: dashboard
        });
    } catch (error) {
        next(error);
    }
};

import LogisticsEtaService from './logisticsEta.service.js';

export const updateLogisticsLegStatus = async (req, res, next) => {
    try {
        const partnerId = req.logisticsPartner?.id || req.user?.profile_id || req.user?.id;
        if (!partnerId) {
            return next(new AppError('Logistics partner identity not found', 400));
        }

        const result = await LogisticsDashboardService.updateLegStatus({
            partner: req.logisticsPartner || { id: partnerId, email: req.user?.email },
            partnerId,
            requestId: req.params.requestId,
            legType: req.params.legType,
            status: req.body?.status
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const updateRiderLocation = async (req, res, next) => {
    try {
        const partnerId = req.logisticsPartner?.id || req.user?.profile_id || req.user?.id;
        const { legId } = req.params;
        const { latitude, longitude, accuracy, speed, heading, timestamp } = req.body || {};

        const result = await LogisticsEtaService.recordRiderLocation({
            partnerId,
            legId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            timestamp
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

