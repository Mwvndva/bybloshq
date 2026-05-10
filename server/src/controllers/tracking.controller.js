import LogisticsTrackingLinkService from '../services/logisticsTrackingLink.service.js';

export const getPublicTrackingByToken = async (req, res, next) => {
    try {
        const tracking = await LogisticsTrackingLinkService.getSafeTrackingByToken(req.params.token);
        res.status(200).json({
            status: 'success',
            data: tracking
        });
    } catch (error) {
        next(error);
    }
};
