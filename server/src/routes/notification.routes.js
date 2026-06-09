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

router.post('/logistics/devices', protectLogistics, registerDevice);
router.delete('/logistics/devices', protectLogistics, unregisterDevice);
router.delete('/logistics/devices/:token', protectLogistics, unregisterDevice);

router.use(protect);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:notificationId/read', markNotificationRead);
router.post('/devices', registerDevice);
router.delete('/devices', unregisterDevice);
router.delete('/devices/:token', unregisterDevice);

export default router;
