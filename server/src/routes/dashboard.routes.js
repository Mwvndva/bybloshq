import express from 'express';
import dashboardController from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes with authentication
router.use(protect);

// Get dashboard data
router.get('/', dashboardController.getDashboardData);

// Record a new sale (typically called from webhook)
router.post('/sales', dashboardController.recordSale);

// Add a recent event (called when a new event is created)
router.post('/recent-events', dashboardController.addRecentEvent);

export default router;
