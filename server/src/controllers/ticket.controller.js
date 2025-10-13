import { AppError } from '../utils/errorHandler.js';
import TicketRepository from '../repositories/ticket.repository.js';

export default class TicketController {
  /**
   * Validate a ticket by ticket number
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static async validateTicket(req, res, next) {
    try {
      const { ticketNumber } = req.params;
      
      if (!ticketNumber) {
        return res.status(400).json({
          success: false,
          message: 'Ticket number is required'
        });
      }
      
      // Find the ticket by ticket number
      const ticket = await TicketRepository.findByTicketNumber(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({
          valid: false,
          status: 'not_found',
          message: 'Ticket not found'
        });
      }
      
      // Check if ticket is already scanned
      if (ticket.scanned) {
        return res.status(200).json({
          valid: false,
          status: 'already_scanned',
          message: 'This ticket has already been scanned',
          ticket: {
            id: ticket.id,
            ticketNumber: ticket.ticket_number,
            eventName: ticket.event_name,
            customerName: ticket.customer_name,
            scanned: true,
            scannedAt: ticket.scanned_at
          }
        });
      }
      
      // Mark ticket as scanned
      const updatedTicket = await TicketRepository.markAsScanned(ticket.id);
      
      // Return success response
      return res.status(200).json({
        valid: true,
        status: 'valid',
        message: 'Ticket is valid',
        ticket: {
          id: updatedTicket.id,
          ticketNumber: updatedTicket.ticket_number,
          eventName: ticket.event_name,
          customerName: updatedTicket.customer_name,
          scanned: updatedTicket.scanned,
          scannedAt: updatedTicket.scanned_at
        }
      });
      
    } catch (error) {
      console.error('Error validating ticket:', error);
      return res.status(500).json({
        valid: false,
        status: 'error',
        message: 'An error occurred while validating the ticket'
      });
    }
  }
  
  /**
   * Get all tickets for an organizer
   */
  static async getTickets(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError('Authentication required', 401));
      }

      console.log('=== Ticket Controller Debug ===');
      console.log('Request params:', req.params);
      console.log('Request query:', req.query);
      console.log('User ID:', req.user.id);

      const { eventId } = req.params;
      
      // For event-specific tickets, don't apply pagination
      if (eventId) {
        console.log(`Fetching tickets for event ${eventId}`);
        const tickets = await TicketRepository.getAllTicketsForEvent(eventId, req.user.id);
        console.log(`Found ${tickets.length} tickets for event ${eventId}`);
        console.log('Sample ticket:', tickets[0]);
        
        // Format ticket data for response
        const formattedTickets = tickets.map(ticket => ({
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          event_name: ticket.event_name,
          event_id: ticket.event_id,
          customer_name: ticket.customer_name,
          customer_email: ticket.customer_email,
          ticket_type: ticket.ticket_type_name,
          price: parseFloat(ticket.price),
          status: ticket.status,
          scanned: ticket.scanned,
          scanned_at: ticket.scanned_at,
          created_at: ticket.created_at,
          event_start_date: ticket.event_start_date,
          event_end_date: ticket.event_end_date,
          metadata: ticket.metadata || {}
        }));

        return res.status(200).json({
          success: true,
          data: {
            tickets: formattedTickets,
            pagination: {
              total: formattedTickets.length,
              page: 1,
              limit: formattedTickets.length,
              totalPages: 1
            }
          }
        });
      }

      // For all other ticket listings, use pagination
      const { page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      console.log(`Fetching tickets for organizer ${req.user.id} with limit=${limit}, offset=${offset}`);
      const result = await TicketRepository.getTicketsByOrganizer(
        req.user.id,
        parseInt(limit, 10),
        offset
      );
      console.log(`Found ${result.tickets.length} tickets out of ${result.total}`);
      if (result.tickets.length > 0) {
        console.log('Sample ticket:', result.tickets[0]);
      }

      // Format ticket data for response
      const formattedTickets = result.tickets.map(ticket => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        event_name: ticket.event_name,
        event_id: ticket.event_id,
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email,
        ticket_type: ticket.ticket_type_name,
        price: parseFloat(ticket.price),
        status: ticket.status,
        scanned: ticket.scanned,
        scanned_at: ticket.scanned_at,
        created_at: ticket.created_at,
        event_start_date: ticket.event_start_date,
        event_end_date: ticket.event_end_date,
        metadata: ticket.metadata || {}
      }));

      res.status(200).json({
        success: true,
        data: {
          tickets: formattedTickets,
          pagination: {
            total: result.total,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalPages: Math.ceil(result.total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching tickets:', error);
      next(new AppError(error.message || 'Failed to fetch tickets', 500));
    }
  }

  /**
   * Create a new ticket
   */
  static async createTicket(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError('Authentication required', 401));
      }

      const { eventId } = req.params;
      const { customer_name, customer_email, ticket_type, price } = req.body;

      // Validate required fields
      if (!customer_name || !customer_email || !ticket_type || price === undefined) {
        return next(new AppError('Missing required fields', 400));
      }

      const ticketData = {
        event_id: eventId,
        organizer_id: req.user.id,
        customer_name,
        customer_email,
        ticket_type,
        price: parseFloat(price),
        status: 'paid' // Default to paid for now, can be made configurable
      };

      const ticket = await TicketRepository.createTicket(ticketData);

      res.status(201).json({
        status: 'success',
        data: {
          ticket
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ticket by ID
   */
  static async getTicket(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError('Authentication required', 401));
      }

      const { ticketId } = req.params;
      const ticket = await TicketRepository.getTicketById(ticketId, req.user.id);

      if (!ticket) {
        return next(new AppError('Ticket not found', 404));
      }

      res.status(200).json({
        status: 'success',
        data: {
          ticket
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update ticket status
   */
  static async updateTicketStatus(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError('Authentication required', 401));
      }

      const { ticketId } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'paid', 'cancelled', 'refunded'].includes(status)) {
        return next(new AppError('Invalid status', 400));
      }

      const ticket = await TicketRepository.updateTicketStatus(
        ticketId,
        status,
        req.user.id
      );

      if (!ticket) {
        return next(new AppError('Ticket not found', 404));
      }

      res.status(200).json({
        status: 'success',
        data: {
          ticket
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ticket statistics
   */
  static async getTicketStats(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError('Authentication required', 401));
      }

      const stats = await TicketRepository.getTicketStats(req.user.id);

      res.status(200).json({
        status: 'success',
        data: {
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate a ticket by ticket number
   */
  static async validateTicket(req, res, next) {
    try {
      const { ticketNumber } = req.params;
      const { force = false } = req.query; // Optional force parameter to re-scan already scanned tickets
      
      console.log(`Validating ticket: ${ticketNumber}`);
      
      if (!ticketNumber) {
        console.error('No ticket number provided');
        return next(new AppError('Ticket number is required', 400));
      }

      // Find the ticket by ticket number
      const ticket = await TicketRepository.findByTicketNumber(ticketNumber);
      
      if (!ticket) {
        console.error(`Ticket not found: ${ticketNumber}`);
        return res.status(200).json({
          success: false,
          valid: false,
          status: 'not_found',
          message: 'Ticket not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check if ticket is already scanned
      if (ticket.scanned && !force) {
        console.log(`Ticket already scanned: ${ticketNumber} at ${ticket.scanned_at}`);
        return res.status(200).json({
          success: false,
          valid: false,
          status: 'already_scanned',
          message: 'This ticket has already been scanned',
          ticket: {
            id: ticket.id,
            ticketNumber: ticket.ticket_number,
            eventId: ticket.event_id,
            eventName: ticket.event?.name || 'Event',
            customerName: ticket.customer_name || 'Customer',
            customerEmail: ticket.customer_email,
            ticketType: ticket.ticket_type,
            status: ticket.status,
            scanned: true,
            scannedAt: ticket.scanned_at,
            purchaseDate: ticket.created_at
          },
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Mark ticket as scanned
        console.log(`Marking ticket ${ticket.id} as scanned...`);
        const updatedTicket = await TicketRepository.markAsScanned(ticket.id);
        
        console.log(`Successfully validated ticket: ${ticketNumber}`);
        return res.status(200).json({
          success: true,
          valid: true,
          status: 'valid',
          message: 'Ticket is valid and has been marked as scanned',
          ticket: {
            id: updatedTicket.id,
            ticketNumber: updatedTicket.ticket_number,
            eventId: updatedTicket.event_id,
            eventName: updatedTicket.event?.name || 'Event',
            customerName: updatedTicket.customer_name || 'Customer',
            customerEmail: updatedTicket.customer_email,
            ticketType: updatedTicket.ticket_type,
            status: updatedTicket.status,
            scanned: true,
            scannedAt: updatedTicket.scanned_at,
            purchaseDate: updatedTicket.created_at
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (updateError) {
        console.error(`Error updating ticket ${ticket.id}:`, updateError);
        return next(new AppError('Error updating ticket status', 500));
      }

    } catch (error) {
      console.error('Error validating ticket:', error);
      next(new AppError(error.message || 'Error validating ticket', 500));
    }
  }
}
