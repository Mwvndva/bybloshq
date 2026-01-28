import { AppError } from '../utils/errorHandler.js';
import TicketRepository from '../repositories/ticket.repository.js';
import TicketService from '../services/ticket.service.js';
import logger from '../utils/logger.js';

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
      const { force } = req.query; // Check if user forcing rescan? Logic in Service supports force.

      const result = await TicketService.validateTicket(ticketNumber, force === 'true');

      if (!result) {
        return res.status(404).json({ valid: false, status: 'not_found', message: 'Ticket not found' });
      }

      if (result.status === 'already_scanned') {
        return res.status(200).json({
          valid: false,
          status: 'already_scanned',
          message: 'This ticket has already been scanned',
          ticket: result.ticket
        });
      }

      return res.status(200).json({
        valid: true,
        status: 'valid',
        message: 'Ticket is valid',
        ticket: result.ticket
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

      logger.debug('=== Ticket Controller Debug ===', {
        params: req.params,
        query: req.query,
        userId: req.user.id
      });

      const { eventId } = req.params;

      // For event-specific tickets, don't apply pagination
      if (eventId) {
        logger.info(`Fetching tickets for event ${eventId}`);
        const tickets = await TicketRepository.getAllTicketsForEvent(eventId, req.user.id);
        logger.info(`Found ${tickets.length} tickets for event ${eventId}`);

        if (tickets.length > 0) {
          logger.debug('Sample ticket:', tickets[0]);
        }

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

      logger.debug(`Fetching tickets for organizer ${req.user.id} with limit=${limit}, offset=${offset}`);
      const result = await TicketRepository.getTicketsByOrganizer(
        req.user.id,
        parseInt(limit, 10),
        offset
      );
      logger.info(`Found ${result.tickets.length} tickets out of ${result.total}`);
      if (result.tickets.length > 0) {
        logger.debug('Sample ticket:', result.tickets[0]);
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
      logger.error('Error fetching tickets:', error);
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

      logger.info(`Validating ticket: ${ticketNumber}`);

      if (!ticketNumber) {
        logger.error('No ticket number provided');
        return next(new AppError('Ticket number is required', 400));
      }

      // Find the ticket by ticket number
      const ticket = await TicketRepository.findByTicketNumber(ticketNumber);

      if (!ticket) {
        logger.error(`Ticket not found: ${ticketNumber}`);
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
        logger.info(`Ticket already scanned: ${ticketNumber} at ${ticket.scanned_at}`);
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
        logger.info(`Marking ticket ${ticket.id} as scanned...`);
        const updatedTicket = await TicketRepository.markAsScanned(ticket.id);

        logger.info(`Successfully validated ticket: ${ticketNumber}`);
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
        logger.error(`Error updating ticket ${ticket.id}:`, updateError);
        return next(new AppError('Error updating ticket status', 500));
      }

    } catch (error) {
      logger.error('Error validating ticket:', error);
      next(new AppError(error.message || 'Error validating ticket', 500));
    }
  }

  /**
   * Send ticket confirmation email
   * Consolidated from ticketController.js
   */
  static async sendTicketEmail(req, res) {
    // Import dependencies at method level to avoid polluting class scope
    const { sendEmail } = await import('../utils/email.js');
    const path = await import('path');
    const fs = await import('fs');
    const ejs = await import('ejs');
    const { qrCodeToBuffer } = await import('../utils/qrCodeUtils.js');

    logger.info('Received email request:', {
      to: req.body.to ? '[REDACTED]' : 'missing',
      subject: req.body.subject,
      hasData: !!req.body.ticketData
    });

    try {
      const { to, subject, ticketData } = req.body;

      // Validate required fields
      if (!to || !subject || !ticketData) {
        const error = new Error('Missing required fields');
        error.statusCode = 400;
        error.details = {
          missing: [
            !to && 'to',
            !subject && 'subject',
            !ticketData && 'ticketData'
          ].filter(Boolean)
        };
        throw error;
      }

      // Process price
      let price = 0;
      if (ticketData.price !== undefined && ticketData.price !== null) {
        price = typeof ticketData.price === 'number' ? ticketData.price : parseFloat(ticketData.price) || 0;
      } else if (ticketData.totalPrice !== undefined && ticketData.totalPrice !== null) {
        price = typeof ticketData.totalPrice === 'number' ? ticketData.totalPrice : parseFloat(ticketData.totalPrice) || 0;
        if (ticketData.quantity && ticketData.quantity > 1) {
          price = price / ticketData.quantity;
        }
      }
      price = Math.max(0, price);

      const formattedPrice = new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(price);

      // Format purchase date
      let formattedDate = 'Date not available';
      try {
        const purchaseDate = ticketData.purchaseDate ? new Date(ticketData.purchaseDate) : new Date();
        if (!isNaN(purchaseDate.getTime())) {
          formattedDate = purchaseDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Nairobi'
          });
        }
      } catch (error) {
        logger.error('Error formatting purchase date:', error.message);
      }

      // Process QR code
      let qrCodeBuffer = null;
      if (ticketData.qrCode) {
        try {
          if (ticketData.qrCode.startsWith('data:image/')) {
            qrCodeBuffer = await qrCodeToBuffer(ticketData.qrCode);
          } else {
            const QRCode = (await import('qrcode')).default;
            const qrCodeDataUrl = await QRCode.toDataURL(ticketData.qrCode, {
              errorCorrectionLevel: 'H',
              type: 'image/png',
              margin: 1,
              scale: 4
            });
            qrCodeBuffer = await qrCodeToBuffer(qrCodeDataUrl);
          }
        } catch (error) {
          logger.error('Error processing QR code:', error);
        }
      }

      // Prepare template data
      const templateData = {
        appName: process.env.APP_NAME || 'Byblos',
        subject: subject,
        ...ticketData,
        price: price,
        formattedPrice: formattedPrice,
        purchaseDate: ticketData.purchaseDate,
        formattedDate: formattedDate,
        title: subject,
        eventName: ticketData.eventName,
        event: ticketData.eventName,
        ticket: {
          number: ticketData.ticketNumber,
          type: ticketData.ticketType,
          price: price,
          formattedPrice: formattedPrice,
          purchaseDate: ticketData.purchaseDate,
          formattedDate: formattedDate,
          quantity: ticketData.quantity || 1
        },
        user: {
          name: ticketData.customerName,
          email: ticketData.customerEmail
        },
        customerName: ticketData.customerName,
        quantity: ticketData.quantity || 1
      };

      // Render email template
      const emailTemplatesDir = path.default.join(process.cwd(), 'email-templates');
      const templatePath = path.default.join(emailTemplatesDir, 'ticket-confirmation.ejs');

      if (!fs.default.existsSync(templatePath)) {
        throw new Error(`Email template not found at: ${templatePath}`);
      }

      const template = fs.default.readFileSync(templatePath, 'utf-8');
      const html = ejs.default.render(template, templateData);

      if (!html || typeof html !== 'string' || html.trim() === '') {
        throw new Error('Rendered template is empty');
      }

      // Prepare email options
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Byblos Experience'}" <${process.env.EMAIL_FROM_EMAIL}>`,
        to,
        subject,
        html,
        text: `Thank you for your purchase! Here's your ticket information:

Event: ${ticketData.eventName}
Ticket Number: ${ticketData.ticketNumber}
Ticket Type: ${ticketData.ticketType}
Price: ${formattedPrice}

Please present this email and the QR code at the event entrance.

Thank you for choosing Byblos Experience!`,
        attachments: []
      };

      // Add QR code as attachment
      if (qrCodeBuffer) {
        mailOptions.attachments.push({
          filename: `ticket-${ticketData.ticketNumber}.png`,
          content: qrCodeBuffer,
          cid: 'qrcode'
        });
      }

      // Send email
      await sendEmail(mailOptions);
      logger.info('Ticket email sent successfully');

      res.status(200).json({
        success: true,
        message: 'Ticket email sent successfully',
      });
    } catch (error) {
      logger.error('❌ Error sending ticket email:', {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
        details: error.details
      });

      const statusCode = error.statusCode || 500;
      const errorMessage = error.message || 'Failed to send ticket email';

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        details: process.env.NODE_ENV === 'development' ? error.details : undefined
      });
    }
  }
}
