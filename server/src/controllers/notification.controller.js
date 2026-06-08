import NotificationService from '../services/notification.service.js';
import logger from '../shared/utils/logger.js';

const currentUserId = (req) => Number(req.user?.userId || req.user?.id);
const currentRole = (req) => req.user?.role || req.user?.userType;

export const registerDevice = async (req, res) => {
    try {
        const device = await NotificationService.registerDeviceToken({
            userId: currentUserId(req),
            role: currentRole(req),
            platform: req.body.platform,
            token: req.body.token,
            deviceId: req.body.deviceId || req.body.device_id,
            appVersion: req.body.appVersion || req.body.app_version
        });

        res.status(200).json({
            status: 'success',
            message: 'Device registered for notifications',
            data: device
        });
    } catch (error) {
        logger.warn('[NotificationController] Device registration failed', {
            userId: currentUserId(req),
            error: error.message
        });
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

export const unregisterDevice = async (req, res) => {
    try {
        const token = req.body.token || req.params.token;
        const removed = await NotificationService.unregisterDeviceToken({
            userId: currentUserId(req),
            token
        });

        res.status(200).json({
            status: 'success',
            data: { removed }
        });
    } catch (error) {
        logger.warn('[NotificationController] Device unregister failed', {
            userId: currentUserId(req),
            error: error.message
        });
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

export const listNotifications = async (req, res) => {
    const notifications = await NotificationService.listForUser({
        userId: currentUserId(req),
        limit: req.query.limit,
        unreadOnly: req.query.unreadOnly === 'true' || req.query.unread_only === 'true'
    });

    res.status(200).json({
        status: 'success',
        data: notifications
    });
};

export const markNotificationRead = async (req, res) => {
    const notification = await NotificationService.markRead({
        userId: currentUserId(req),
        notificationId: req.params.notificationId
    });

    if (!notification) {
        return res.status(404).json({
            status: 'error',
            message: 'Notification not found'
        });
    }

    return res.status(200).json({
        status: 'success',
        data: notification
    });
};

export const markAllNotificationsRead = async (req, res) => {
    const updated = await NotificationService.markAllRead({
        userId: currentUserId(req)
    });

    res.status(200).json({
        status: 'success',
        data: { updated }
    });
};
