/**
 * Central route aggregator — server/src/routes/index.js
 * All API routes are mounted here and exposed as a single Express Router.
 * This is then mounted at /api in server/src/index.js.
 */
import express from 'express';

import sellerRoutes from './seller.routes.js';
import buyerRoutes from './buyer.routes.js';
import publicRoutes from './public.routes.js';
import healthRoutes from './health.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';
import refundRoutes from './refund.routes.js';
import callbackRoutes from './callback.routes.js';
import orderRoutes from './orderRoutes.js';
import whatsappRoutes from './whatsapp.routes.js';
import activationRoutes from './activation.routes.js';
import refreshTokenRoutes from './refreshToken.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ─── Public / Unauthenticated Routes ────────────────────────────────────────
router.use('/sellers', sellerRoutes);
router.use('/buyers', buyerRoutes);
router.use('/public', publicRoutes);
router.use('/health', healthRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/refunds', refundRoutes);
router.use('/auth', refreshTokenRoutes);
router.use('/callbacks', callbackRoutes);
router.use('/orders', orderRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/activation', activationRoutes);
router.use('/wishlist', wishlistRoutes);

export default router;
