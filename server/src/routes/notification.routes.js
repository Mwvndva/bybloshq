import { validate } from '../middleware/validate.js';
import * as V from '../validations/notification.validation.js';
import express from 'express';
import { protect } from '../middleware/auth.js';
import { protectLogistics } from '../middleware/logisticsAuth.js';
import {
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    registerDevice,
    unregisterDevice
} from '../controllers/notification.controller.js';

const router = express.Router();

router.post('/logistics/devices', protectLogistics, validate(V.registerDevice), registerDevice);
router.delete('/logistics/devices', protectLogistics, validate(V.unregisterDevice), unregisterDevice);
router.delete('/logistics/devices/:token', protectLogistics, validate(V.unregisterDeviceByToken), unregisterDevice);

// Logistics partners authenticate differently, so they get their own list/read routes
// (the controller's currentUserId already resolves req.logisticsPartner.userId).
router.get('/logistics', protectLogistics, listNotifications);
router.patch('/logistics/read-all', protectLogistics, markAllNotificationsRead);
router.patch('/logistics/:notificationId/read', protectLogistics, validate(V.markRead), markNotificationRead);

router.use(protect);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:notificationId/read', validate(V.markRead), markNotificationRead);
router.post('/devices', validate(V.registerDevice), registerDevice);
router.delete('/devices', validate(V.unregisterDevice), unregisterDevice);
router.delete('/devices/:token', validate(V.unregisterDeviceByToken), unregisterDevice);

export default router;
