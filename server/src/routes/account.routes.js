import express from 'express';
import { protect } from '../middleware/auth.js';
import { myAccounts, switchRole } from '../controllers/account.controller.js';

const router = express.Router();

// GET  /api/auth/accounts — which account types the current user owns
router.get('/accounts', protect, myAccounts);
// POST /api/auth/switch   — mint a token for another role the user owns
router.post('/switch', protect, switchRole);

export default router;
