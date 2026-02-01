import express from 'express';
import * as publicController from '../controllers/public.controller.js';
import * as eventController from '../controllers/event.controller.js';
import publicTicketRoutes from './ticket.routes.js';
import paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Public product routes
router.get('/aesthetics', publicController.getAesthetics);
router.get('/products', publicController.getProducts);
router.get('/products/:id', publicController.getProduct);

// Public seller info
router.get('/sellers/:id/public', publicController.getSellerPublicInfo);

// Public events
router.get('/events/upcoming', eventController.getUpcomingEvents);
router.get('/events/public/upcoming', eventController.getUpcomingEvents); // Alias for compatibility
router.get('/events/public/:eventId', eventController.getPublicEvent);
router.get('/events/public/:eventId/booking', eventController.getEventForBooking); // For booking page with detailed info
router.get('/events/public/:eventId/ticket-types', eventController.getEventTicketTypes);

// Public ticket routes
router.use(publicTicketRoutes);

export default router;
