import express from 'express';
import { requestPayout, getPayoutHistory } from '../controllers/payout.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply protect middleware to all routes in this router
router.use(protect);

// Payout routes
router.post('/request-payout', requestPayout);
router.get('/payouts', getPayoutHistory);

export default router;
