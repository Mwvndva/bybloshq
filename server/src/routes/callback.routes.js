import express from 'express';
import { handlePaydCallback } from '../controllers/callback.controller.js';

const router = express.Router();

// Route for Payd callbacks
router.post('/payd', handlePaydCallback);

export default router;
