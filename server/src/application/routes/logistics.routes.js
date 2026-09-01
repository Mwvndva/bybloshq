import { validate } from '../middleware/validate.js';
import * as V from '../../shared/validations/logistics.validation.js';
import express from 'express';
import {
    getLogisticsDashboardRequests,
    getLogisticsMe,
    loginLogisticsPartner,
    logoutLogisticsPartner,
    updateLogisticsLegStatus,
    updateRiderLocation
} from '../../domains/logistics/logistics.controller.js';
import { protectLogistics } from '../middleware/logisticsAuth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

router.post('/login', authLimiter, validate(V.login), loginLogisticsPartner);
router.post('/logout', logoutLogisticsPartner);
router.get('/me', protectLogistics, getLogisticsMe);

router.get('/requests', protectLogistics, getLogisticsDashboardRequests);
router.patch('/requests/:requestId/legs/:legType/status', protectLogistics, validate(V.updateLegStatus), updateLogisticsLegStatus);
router.post('/legs/:legId/location', protectLogistics, updateRiderLocation);

export default router;
