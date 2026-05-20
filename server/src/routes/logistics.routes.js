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

router.post('/login', authLimiter, loginLogisticsPartner);
router.get('/me', protectLogistics, getLogisticsMe);
router.get('/requests', protectLogistics, getLogisticsDashboardRequests);
router.patch('/requests/:requestId/legs/:legType/status', protectLogistics, updateLogisticsLegStatus);

export default router;
