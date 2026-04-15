import express from 'express';
import { withdrawalController } from '../controllers/WithdrawalController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.post('/', protect, (req, res) => withdrawalController.createWithdrawal(req, res));
router.post('/callback', (req, res) => withdrawalController.handleCallback(req, res));

export default router;
