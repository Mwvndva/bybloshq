import { validate } from '../middleware/validate.js';
import * as V from '../validations/logistics.validation.js';
import express from 'express';
import {
    getLogisticsDashboardRequests,
    getLogisticsMe,
    loginLogisticsPartner,
    updateLogisticsLegStatus
} from '../controllers/logistics.controller.js';
import { protectLogistics } from '../middleware/logisticsAuth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

router.post('/login', authLimiter, validate(V.login), loginLogisticsPartner);
router.get('/me', protectLogistics, getLogisticsMe);
router.get('/requests', protectLogistics, getLogisticsDashboardRequests);
router.patch('/requests/:requestId/legs/:legType/status', protectLogistics, validate(V.updateLegStatus), updateLogisticsLegStatus);

export default router;
