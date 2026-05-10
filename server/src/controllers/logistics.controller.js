import LogisticsDashboardService from '../services/logisticsDashboard.service.js';

export const loginLogisticsPartner = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        const result = await LogisticsDashboardService.login({ email, password });

        res.status(200).json({
            status: 'success',
            data: result
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
