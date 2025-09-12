import express from 'express';
import { purchaseTickets, getEventTicketTypes } from '../../controllers/public/ticket.controller.js';

const router = express.Router();

// Get ticket types for an event (public)
router.get('/events/:eventId/ticket-types', getEventTicketTypes);

// Purchase tickets (public)
router.post('/tickets/purchase', purchaseTickets);

export default router;
