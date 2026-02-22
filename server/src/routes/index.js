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
import ticketRoutes from './ticket.routes.js';
import paymentRoutes from './payment.routes.js';
import discountCodeRoutes from './discountCode.routes.js';
import adminRoutes from './admin.routes.js';
import refundRoutes from './refund.routes.js';
import callbackRoutes from './callback.routes.js';
import eventRoutes from './event.routes.js';
import orderRoutes from './orderRoutes.js';
import whatsappRoutes from './whatsapp.routes.js';
import activationRoutes from './activation.routes.js';
import refreshTokenRoutes from './refreshToken.routes.js';
import organizerRoutes from './organizer.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import { protect } from '../middleware/auth.js';
import * as eventController from '../controllers/event.controller.js';

const router = express.Router();

// ─── Public / Unauthenticated Routes ────────────────────────────────────────
router.use('/sellers', sellerRoutes);
router.use('/buyers', buyerRoutes);
router.use('/public', publicRoutes);
router.use('/health', healthRoutes);
router.use('/tickets', ticketRoutes);
router.use('/payments', paymentRoutes);
router.use('/discount-codes', discountCodeRoutes);
router.use('/admin', adminRoutes);
router.use('/refunds', refundRoutes);
router.use('/events', eventRoutes);
router.use('/auth', refreshTokenRoutes);
router.use('/callbacks', callbackRoutes);
router.use('/orders', orderRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/activation', activationRoutes);
router.use('/wishlist', wishlistRoutes);

// ─── Public Organizer Auth Routes + Protected Dashboard Routes ───────────────
// organizer.routes.js contains both: public auth routes AND protected routes
// (protect middleware is applied per-route inside organizer.routes.js)
router.use('/organizers', organizerRoutes);

// ─── Protected Organizer Dashboard & Event Routes ────────────────────────────
const protectedRouter = express.Router();
protectedRouter.use(protect);

// Dashboard (e.g. /api/organizers/dashboard/stats)
protectedRouter.use('/dashboard', dashboardRoutes);

// Protected event management (organizer-scoped)
protectedRouter.get('/events', eventController.getOrganizerEvents);
protectedRouter.post('/events', eventController.createEvent);
protectedRouter.get('/events/dashboard', eventController.getDashboardEvents);
protectedRouter.get('/events/:id', eventController.getEvent);
protectedRouter.put('/events/:id', eventController.updateEvent);
protectedRouter.delete('/events/:id', eventController.deleteEvent);

// Organizer-scoped ticket access
protectedRouter.use('/tickets', ticketRoutes);

router.use('/organizers', protectedRouter);

export default router;
