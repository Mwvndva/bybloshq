import { validate } from '../middleware/validate.js';
import * as V from '../validations/referral.validation.js';
// @ts-check
'use strict';

import express from 'express';
import { protect } from '../middleware/auth.js';
import * as referralController from '../controllers/referral.controller.js';

const router = express.Router();

// All referral routes require authentication
router.use(protect);

router.get('/dashboard', referralController.getDashboard);
router.post('/generate-code', validate(V.generateCode), referralController.generateCode);

export default router;
