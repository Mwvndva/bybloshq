import express from 'express';
import { authController } from '../controllers/AuthController.js';

const router = express.Router();

router.post('/login', (req, res) => authController.login(req, res));
router.post('/register/:type', (req, res) => authController.register(req, res));
router.get('/verify-email', (req, res) => authController.verifyEmail(req, res));

export default router;
