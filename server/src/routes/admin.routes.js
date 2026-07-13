import { validate } from '../middleware/validate.js';
import * as V from '../validations/admin.validation.js';
import express from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protect, hasPermission } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';
import { getTokenFromRequest, verifyToken } from '../shared/utils/jwt.js';
import logger from '../shared/utils/logger.js';

const router = express.Router();

// Public route for admin login
router.post('/login', authLimiter, validate(V.login), adminController.adminLogin);

router.post('/logout', async (req, res) => {
    // Blacklist the current token so it can't be reused
    const token = getTokenFromRequest(req);
    if (token) {
        try {
            const decoded = verifyToken(token);
            const tokenBlacklist = (await import('../services/tokenBlacklist.service.js')).default;
            await tokenBlacklist.addToken(token, decoded.exp);
        } catch (err) {
            // Token may be invalid/expired — that's fine, just clear cookies
            logger.debug('[LOGOUT] Could not blacklist admin token:', err.message);
        }
    }

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        expires: new Date(0),
        path: '/'
    };
    res.cookie('jwt', '', cookieOptions);
    res.cookie('token', '', cookieOptions);
    res.status(200).json({ status: 'success', message: 'Admin logged out' });
});

// Middleware to protect subsequent admin routes
router.use(protect);
router.use(hasPermission('manage-all'));

// Protected admin routes
router.get('/me', adminController.getMe);
router.get('/stats', adminController.getDashboardStats);
router.get('/dashboard', adminController.getDashboardStats);
router.get('/analytics', adminController.getAnalytics);
router.post('/process-pending-payments', adminController.processPendingPayments);

// Seller management
router.get('/sellers', adminController.getAllSellers);
router.get('/sellers/:id', adminController.getSellerById);
router.patch('/sellers/:id/status', validate(V.updateSellerStatus), adminController.updateSellerStatus);

// Creator management
router.get('/creators', adminController.getAllCreators);
router.delete('/creators/:id', validate(V.deleteCreator), adminController.deleteCreator);

// Buyer management
router.get('/buyers', adminController.getAllBuyers);
router.get('/buyers/:id', adminController.getBuyerById);

// Product management
router.get('/products', adminController.getAllProducts);
router.get('/products/seller/:sellerId', adminController.getSellerProducts);

// Metrics
router.get('/metrics/monthly', adminController.getMonthlyMetrics);
router.get('/metrics/financial', adminController.getFinancialMetrics);
router.get('/metrics/financial/monthly', adminController.getMonthlyFinancialData);

// Payment provider health
router.get('/payment-provider/balances', adminController.getPaymentProviderBalances);

// Clients management
router.get('/clients', adminController.getAllClients);

// User management (Delete/Block)
router.delete('/users/:id', validate(V.deleteUser), adminController.deleteUser);

// Withdrawal requests management
router.get('/withdrawal-requests', adminController.getAllWithdrawalRequests);
router.patch('/withdrawal-requests/:id/status', validate(V.updateWithdrawalStatus), adminController.updateWithdrawalRequestStatus);

// Logistics oversight
router.get('/logistics/requests', adminController.getAdminLogisticsRequests);
router.patch('/logistics/requests/:requestId/legs/:legType/status', validate(V.adminUpdateLegStatus), adminController.adminUpdateLogisticsLegStatus);
router.post('/logistics/requests/:requestId/disputes/resolve', validate(V.resolveDispute), adminController.adminResolveLogisticsDispute);

export default router;

