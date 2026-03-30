import express from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protect, hasPermission } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

// Public route for admin login
router.post('/login', authLimiter, adminController.adminLogin);

router.post('/logout', (req, res) => {
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
router.patch('/sellers/:id/status', adminController.updateSellerStatus);

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

// Payd Management
router.get('/payd/balances', adminController.getPaydBalances);

// Clients management
router.get('/clients', adminController.getAllClients);

// User management (Delete/Block)
router.delete('/users/:id', adminController.deleteUser);

// Withdrawal requests management
router.get('/withdrawal-requests', adminController.getAllWithdrawalRequests);
router.patch('/withdrawal-requests/:id/status', adminController.updateWithdrawalRequestStatus);

export default router;