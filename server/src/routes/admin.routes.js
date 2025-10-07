import express from 'express';
import * as adminController from '../controllers/admin.controller.js';

const router = express.Router();

// Public route for admin login
router.post('/login', adminController.adminLogin);

// Middleware to protect subsequent admin routes
router.use(adminController.protect);

// Protected admin routes
router.get('/stats', adminController.getDashboardStats);
router.get('/dashboard', adminController.getDashboardStats);
router.post('/process-pending-payments', adminController.processPendingPayments);

// Seller management
router.get('/sellers', adminController.getAllSellers);
router.get('/sellers/:id', adminController.getSellerById);
router.patch('/sellers/:id/status', adminController.updateSellerStatus);

// Organizer management
router.get('/organizers', adminController.getAllOrganizers);
router.get('/organizers/:id', adminController.getOrganizerById);
router.patch('/organizers/:id/status', adminController.updateOrganizerStatus);

// Buyer management
router.get('/buyers', adminController.getAllBuyers);
router.get('/buyers/:id', adminController.getBuyerById);

// Event management
router.get('/events', adminController.getAllEvents);
router.get('/events/monthly', adminController.getMonthlyEvents);
router.get('/events/:id', adminController.getEventById);
router.get('/events/:id/tickets', adminController.getEventTickets);
router.patch('/events/:eventId/mark-paid', adminController.markEventAsPaid);

// Product management
router.get('/products', adminController.getAllProducts);
router.get('/products/seller/:sellerId', adminController.getSellerProducts);

// Metrics
router.get('/metrics/monthly-events', adminController.getMonthlyEvents);
router.get('/metrics/monthly', adminController.getMonthlyMetrics);
router.get('/metrics/financial', adminController.getFinancialMetrics);
router.get('/metrics/financial/monthly', adminController.getMonthlyFinancialData);

// Withdrawal requests management
router.get('/withdrawal-requests', adminController.getAllWithdrawalRequests);
router.patch('/withdrawal-requests/:id/status', adminController.updateWithdrawalRequestStatus);

export default router;