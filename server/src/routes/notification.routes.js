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

router.use(protect);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:notificationId/read', validate(V.markRead), markNotificationRead);
router.post('/devices', validate(V.registerDevice), registerDevice);
router.delete('/devices', validate(V.unregisterDevice), unregisterDevice);
router.delete('/devices/:token', validate(V.unregisterDeviceByToken), unregisterDevice);

export default router;
