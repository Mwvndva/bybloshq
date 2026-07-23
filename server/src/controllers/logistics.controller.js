import LogisticsDashboardService from '../services/logisticsDashboard.service.js';
import { setCourierLocation } from '../services/logisticsLiveLocation.service.js';

export const loginLogisticsPartner = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        const result = await LogisticsDashboardService.login({ email, password });

        res.cookie('jwt', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
            domain: process.env.COOKIE_DOMAIN || undefined
        });

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
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
        const dashboard = await LogisticsDashboardService.getDashboardRequests({
            partnerId: req.logisticsPartner.id,
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

export const updateLogisticsLegStatus = async (req, res, next) => {
    try {
        const result = await LogisticsDashboardService.updateLegStatus({
            partner: req.logisticsPartner,
            partnerId: req.logisticsPartner.id,
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

export const postLogisticsLocation = async (req, res, next) => {
    try {
        const result = await setCourierLocation({
            requestId: req.params.requestId,
            partnerId: req.logisticsPartner.id,
            lat: req.body?.lat,
            lng: req.body?.lng,
            accuracy: req.body?.accuracy,
            heading: req.body?.heading,
            speed: req.body?.speed
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};
