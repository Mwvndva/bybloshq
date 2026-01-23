import TicketRepository from '../repositories/ticket.repository.js';
import logger from '../utils/logger.js';

class TicketService {
    async validateTicket(ticketNumber, force = false) {
        if (!ticketNumber) throw new Error('Ticket number is required');

        const ticket = await TicketRepository.findByTicketNumber(ticketNumber);
        if (!ticket) return null;

        if (ticket.scanned && !force) {
            return {
                valid: false,
                status: 'already_scanned',
                ticket: { ...ticket, scanned: true }
            };
        }

        const updatedTicket = await TicketRepository.markAsScanned(ticket.id);
        return {
            valid: true,
            status: 'valid',
            ticket: updatedTicket
        };
    }

    async createTicket(organizerId, ticketData) {
        // Validate ticketData
        const { eventId, customer_name, customer_email, ticket_type, price } = ticketData;

        return await TicketRepository.createTicket({
            event_id: eventId,
            organizer_id: organizerId,
            customer_name,
            customer_email,
            ticket_type,
            price: parseFloat(price),
            status: 'paid'
        });
    }
}

export default new TicketService();
