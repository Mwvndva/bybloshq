import { pool } from '../config/database.js';
import { sendTicketEmail } from '../controllers/ticketController.js';
import { sendPaymentConfirmationEmail } from '../utils/email.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import logger from '../utils/logger.js';
import Buyer from '../models/buyer.model.js';

class PaymentCompletionService {
  /**
   * Process a successful payment and complete the ticket purchase
   * @param {Object} payment - The payment object from the database
   * @returns {Promise<Object>} - The result of the operation
   */
  static async processSuccessfulPayment(payment) {
    const client = await pool.connect();
    
    try {
      // Start a transaction with SERIALIZABLE isolation level to prevent race conditions
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      
      // Use advisory lock to prevent concurrent processing of the same payment
      const lockId = `payment_${payment.id}`;
      const lockResult = await client.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) as locked',
        [lockId]
      );
      
      if (!lockResult.rows[0].locked) {
        throw new Error(`Could not acquire lock for payment ${payment.id}`);
      }
      
      // Check if this is a product payment
      const metadata = payment.metadata || {};
      if (metadata.product_id || metadata.order_id) {
        logger.info(`Payment ${payment.id} is a product payment, skipping ticket creation`, {
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          productId: metadata.product_id,
          orderId: metadata.order_id
        });
        await client.query('ROLLBACK');
        return { success: true, isProductPayment: true };
      }
      
      logger.info(`Processing successful payment ${payment.id} for invoice ${payment.invoice_id}`, {
        paymentId: payment.id,
        invoiceId: payment.invoice_id,
        amount: payment.amount,
        status: payment.status,
        ticketId: payment.ticket_id,
      });

      // Check if payment has already been processed
      if (payment.metadata?.email_sent === true) {
        logger.info(`Payment ${payment.id} already processed, skipping...`, {
          emailSentAt: payment.metadata.email_sent_at
        });
        await client.query('ROLLBACK');
        return { success: true, alreadyProcessed: true };
      }
      
      // Check if this payment already has a ticket
      let ticket;
      let isExistingTicket = false;
      
      logger.info('Checking for existing tickets...');
      const existingTicketByPayment = await client.query(
        `SELECT * FROM tickets 
         WHERE metadata->>'payment_id' = $1 
         FOR UPDATE`,
        [payment.id.toString()]
      );
      
      if (existingTicketByPayment.rows.length > 0) {
        ticket = existingTicketByPayment.rows[0];
        logger.info(`Found existing ticket ${ticket.id} for payment ${payment.id} via metadata`);
        isExistingTicket = true;
      } else if (payment.ticket_id) {
        const ticketResult = await client.query(
          'SELECT * FROM tickets WHERE id = $1 FOR UPDATE',
          [payment.ticket_id]
        );
        
        if (ticketResult.rows.length > 0) {
          ticket = ticketResult.rows[0];
          logger.info(`Found existing ticket ${ticket.id} for payment ${payment.id}`);
          isExistingTicket = true;
        }
      }
      
      // If we found an existing ticket and payment is already completed, this is a duplicate webhook
      if (isExistingTicket && payment.status === 'completed') {
        logger.info(`Payment ${payment.id} is already marked as completed, skipping duplicate processing`);
        await client.query('ROLLBACK');
        return { success: true, alreadyProcessed: true };
      }
      
      // Create ticket if no existing one
      if (!isExistingTicket) {
        logger.info('No existing ticket found, creating new ticket...');
        ticket = await this._createTicket(client, payment);
        logger.info(`Successfully created ticket ${ticket.id} for payment ${payment.id}`);
      }
      
      // Generate QR code for the ticket
      const qrCodeData = await this._generateQRCode(ticket);
      
      // Send emails
      let emailResult = { success: false, reason: 'not_attempted' };
      const emailSent = payment.metadata?.email_sent === true || 
                       (payment.metadata?.email_attempts?.some(attempt => attempt.success === true));
      
      if (!emailSent) {
        const maxRetries = 3;
        const retryDelay = 1000;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            logger.info(`Sending ticket email (attempt ${attempt}/${maxRetries}) for payment ${payment.id}`);
            
            // Send ticket confirmation email
            emailResult = await this._sendTicketConfirmationEmail(ticket, payment, qrCodeData);
            emailResult.attempt = attempt;
            
            // Update payment metadata
            await client.query(
              `UPDATE payments 
               SET metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{email_attempts}', 
                 COALESCE(metadata->'email_attempts', '[]'::jsonb) || 
                   jsonb_build_object(
                     'timestamp', to_jsonb(NOW()),
                     'success', true,
                     'attempt', $2::text
                   )::jsonb
               ) 
               WHERE id = $1`,
              [payment.id, attempt.toString()]
            );
            
            logger.info(`Successfully sent emails on attempt ${attempt} for payment ${payment.id}`);
            break;
            
          } catch (emailError) {
            lastError = emailError;
            logger.warn(`Email sending attempt ${attempt} failed for payment ${payment.id}:`, emailError.message);
            
            await client.query(
              `UPDATE payments 
               SET metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{email_attempts}', 
                 COALESCE(metadata->'email_attempts', '[]'::jsonb) || 
                   jsonb_build_object(
                     'timestamp', to_jsonb(NOW()),
                     'success', false,
                     'error', $3::text,
                     'attempt', $2::text
                   )::jsonb
               ) 
               WHERE id = $1`,
              [payment.id, attempt.toString(), emailError.message]
            );
            
            if (attempt === maxRetries) {
              emailResult = { 
                success: false, 
                error: `Failed after ${maxRetries} attempts: ${emailError.message}`,
                attempts: maxRetries
              };
            } else {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
          }
        }
      } else {
        logger.info(`Email already sent successfully for payment ${payment.id}, skipping`);
        emailResult = { 
          success: true, 
          reason: 'already_sent'
        };
      }
      
      // Update payment status to completed
      if (payment.status !== 'completed') {
        await client.query(
          `UPDATE payments 
           SET status = 'completed', 
               metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{email_sent_at}', 
                 to_jsonb(NOW())
               )
           WHERE id = $1`,
          [payment.id]
        );
      }
      
      await client.query('COMMIT');
      
      logger.info(`Successfully processed payment ${payment.id}`, {
        paymentId: payment.id,
        ticketId: ticket?.id,
        emailSent: emailResult.success,
        isExistingTicket
      });
      
      return {
        success: true,
        payment: {
          id: payment.id,
          status: 'completed',
          ticketId: ticket?.id,
          emailSent: emailResult.success
        },
        email: emailResult,
        isExistingTicket
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing successful payment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a ticket record in the database
   * @private
   */
  static async _createTicket(client, payment) {
    try {
      logger.info('=== TICKET CREATION START ===', {
        paymentId: payment.id,
        paymentStatus: payment.status,
        ticketTypeId: payment.ticket_type_id,
        eventId: payment.event_id,
        organizerId: payment.organizer_id
      });

      // Check if ticket already exists
      logger.info('Checking for existing ticket...');
      const existingTicket = await client.query(
        `SELECT * FROM tickets 
         WHERE metadata->>'payment_id' = $1 
         LIMIT 1 FOR UPDATE`,
        [payment.id.toString()]
      );

      if (existingTicket.rows.length > 0) {
        logger.info(`Found existing ticket ${existingTicket.rows[0].id} for payment ${payment.id}`);
        return existingTicket.rows[0];
      }
      
      logger.info('No existing ticket found, proceeding with creation...');
      
      const { 
        ticket_type_id: ticketTypeId,
        email: customerEmail,
        metadata = {},
        amount: price,
        event_id: eventId,
        organizer_id: organizerId
      } = payment;

      logger.info('Destructured payment data:', {
        ticketTypeId,
        customerEmail,
        price,
        eventId,
        organizerId,
        metadataKeys: Object.keys(metadata)
      });

      // Validate required fields
      if (!ticketTypeId || !customerEmail || !price || !eventId || !organizerId) {
        logger.error('Missing required fields for ticket creation:', {
          ticketTypeId: !!ticketTypeId,
          customerEmail: !!customerEmail,
          price: !!price,
          eventId: !!eventId,
          organizerId: !!organizerId
        });
        throw new Error('Missing required fields for ticket creation');
      }

      logger.info('All required fields validated successfully');

      // Get ticket type details
      logger.info('Fetching ticket type details...');
      const ticketTypeQuery = `
        SELECT 
          tt.id as ticket_type_id,
          tt.name as ticket_type_name,
          e.name as event_name
        FROM ticket_types tt
        JOIN events e ON tt.event_id = e.id
        WHERE tt.id = $1 AND tt.event_id = $2
      `;
      
      const ticketTypeResult = await client.query(ticketTypeQuery, [ticketTypeId, eventId]);
      
      if (ticketTypeResult.rows.length === 0) {
        logger.error(`Ticket type with ID ${ticketTypeId} not found for event ${eventId}`);
        throw new Error(`Ticket type with ID ${ticketTypeId} not found for event ${eventId}`);
      }
      
      const ticketTypeData = ticketTypeResult.rows[0];
      logger.info('Ticket type data retrieved:', ticketTypeData);
      
      const customerName = metadata.customer_name || 'Guest';
      const quantity = metadata.quantity || 1;
      
      logger.info('Ticket details calculated:', {
        customerName,
        quantity,
        unitPrice: price / quantity
      });
      
      // Generate unique ticket number
      const generateTicketNumber = () => {
        const uuid = uuidv4();
        return `TKT-${Date.now()}-${uuid.substring(0, 8)}`;
      };
      
      let ticketNumber;
      let attempts = 0;
      const maxAttempts = 3;
      
      logger.info('Starting ticket number generation...');
      
      while (attempts < maxAttempts) {
        try {
          ticketNumber = generateTicketNumber();
          attempts++;
          logger.info(`Attempt ${attempts}: Generated ticket number ${ticketNumber}`);
          
          const query = `
            INSERT INTO tickets (
              ticket_number, event_id, organizer_id, customer_name, 
              customer_email, ticket_type_id, ticket_type_name, price,
              status, metadata, created_at, updated_at, payment_id
            ) 
            SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11
            WHERE NOT EXISTS (
              SELECT 1 FROM tickets WHERE metadata->>'payment_id' = $12
            )
            RETURNING *
          `;

          const values = [
            ticketNumber,
            eventId,
            organizerId,
            customerName,
            customerEmail,
            ticketTypeId,
            ticketTypeData.ticket_type_name,
            price / quantity,
            'paid',
            JSON.stringify({
              ...metadata,
              payment_id: payment.id,
              payment_method: payment.payment_method,
              purchase_date: new Date().toISOString()
            }),
            payment.id,
            payment.id.toString()
          ];

          logger.info('Executing ticket INSERT query with values:', {
            ticketNumber,
            eventId,
            organizerId,
            customerName,
            customerEmail,
            ticketTypeId,
            ticketTypeName: ticketTypeData.ticket_type_name,
            unitPrice: price / quantity,
            paymentId: payment.id
          });
          
          const { rows } = await client.query(query, values);
          
          if (rows.length > 0) {
            logger.info(`Successfully created ticket ${rows[0].id} for payment ${payment.id}`);
            return rows[0];
          } else {
            logger.warn(`INSERT returned no rows on attempt ${attempts}, possible duplicate`);
          }
          
        } catch (error) {
          logger.error(`Error in ticket creation attempt ${attempts}:`, error);
          if (error.code === '23505' && attempts < maxAttempts) {
            logger.info('Duplicate detected, retrying...');
            continue;
          }
          throw error;
        }
      }
      
      logger.error(`Failed to generate unique ticket number after ${maxAttempts} attempts`);
      throw new Error(`Failed to generate unique ticket number after ${maxAttempts} attempts`);
      
    } catch (error) {
      logger.error('Error in _createTicket:', error);
      throw error;
    }
  }

  /**
   * Generate QR code for the ticket
   * @private
   */
  static async _generateQRCode(ticket) {
    try {
      const token = uuidv4();
      
      // Get event details
      const eventQuery = 'SELECT name, start_date, end_date FROM events WHERE id = $1';
      const eventResult = await pool.query(eventQuery, [ticket.event_id]);
      const event = eventResult.rows[0];
      
      // Update ticket metadata with validation token
      await pool.query(
        `UPDATE tickets SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ 
          validationToken: token,
          eventName: event?.name || '',
          eventStart: event?.start_date?.toISOString() || '',
          eventEnd: event?.end_date?.toISOString() || '',
          customerName: ticket.customer_name,
          ticketType: ticket.ticket_type_name || 'General Admission'
        }), ticket.id]
      );
      
      // Generate QR code with validation URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const validationUrl = `${baseUrl}/tickets/validate/${ticket.ticket_number}?qr=true`;
      
      return await QRCode.toDataURL(validationUrl);
    } catch (error) {
      logger.error('Error generating QR code:', error);
      return null;
    }
  }

  /**
   * Send payment confirmation email
   * @private
   */
  static async _sendPaymentConfirmationEmail(ticket, payment, qrCodeData) {
    try {
      const { customer_email: to, ticket_number: ticketNumber } = ticket;
      const { metadata = {} } = payment;
      
      // Prepare event details
      const eventName = metadata.event_name || 'Event';
      const eventDate = metadata.event_date || new Date().toISOString();
      const eventLocation = metadata.event_location || 'Venue not specified';
      
      let formattedDate;
      try {
        formattedDate = new Date(eventDate).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Nairobi'
        });
      } catch (e) {
        formattedDate = eventDate;
      }
      
      // Prepare payment data
      const paymentData = {
        ticketNumber,
        ticketType: ticket.ticket_type_name || 'General Admission',
        eventName,
        eventDate: formattedDate,
        eventLocation,
        customerName: ticket.customer_name || 'Guest',
        amount: parseFloat(payment.amount || 0).toFixed(2),
        quantity: parseInt(metadata.quantity || 1, 10),
        reference: payment.invoice_id,
        qrCode: qrCodeData || '',
        ...metadata
      };

      logger.info(`Sending payment confirmation email to: ${to}`, {
        ticketNumber,
        eventName,
        amount: paymentData.amount,
        reference: paymentData.reference
      });

      // Send payment confirmation email
      await sendPaymentConfirmationEmail(to, paymentData);
      
      logger.info(`Successfully sent payment confirmation email to: ${to}`);
      return { 
        success: true, 
        message: 'Payment confirmation email sent successfully',
        to,
        ticketNumber,
        reference: paymentData.reference
      };
      
    } catch (error) {
      logger.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  /**
   * Send ticket confirmation email
   * @private
   */
  static async _sendTicketConfirmationEmail(ticket, payment, qrCodeData) {
    try {
      const { customer_email: to, ticket_number: ticketNumber } = ticket;
      const { metadata = {} } = payment;
      
      // Prepare event details
      const eventName = metadata.event_name || 'Event';
      const eventDate = metadata.event_date || new Date().toISOString();
      const eventLocation = metadata.event_location || 'Venue not specified';
      
      let formattedDate;
      try {
        formattedDate = new Date(eventDate).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Nairobi'
        });
      } catch (e) {
        formattedDate = eventDate;
      }
      
      // Prepare ticket data
      const ticketData = {
        ticketNumber,
        ticketType: ticket.ticket_type_name || 'General Admission',
        eventName,
        eventDate: formattedDate,
        eventLocation,
        customerName: ticket.customer_name || 'Guest',
        customerEmail: to,
        price: parseFloat(ticket.price || 0).toFixed(2),
        quantity: parseInt(metadata.quantity || 1, 10),
        totalPrice: parseFloat(payment.amount || 0).toFixed(2),
        purchaseDate: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Nairobi'
        }),
        qrCode: qrCodeData || '',
        ...metadata
      };

      logger.info(`Sending ticket confirmation email to: ${to}`, {
        ticketNumber,
        eventName,
        hasQrCode: !!qrCodeData
      });

      // Create mock response for email controller
      let responseData;
      const mockRes = {
        status: (status) => ({
          json: (data) => {
            responseData = { status, data };
            if (status >= 400) {
              throw new Error(data.message || `Failed to send email: Status ${status}`);
            }
            return { json: () => Promise.resolve(data) };
          }
        })
      };

      // Send ticket email
      await sendTicketEmail({
        body: {
          to,
          subject: `Your Ticket Confirmation - ${ticketData.eventName}`,
          ticketData
        }
      }, mockRes);
      
      if (!responseData || responseData.status >= 400) {
        throw new Error(responseData?.data?.message || 'Failed to send email');
      }
      
      logger.info(`Successfully sent ticket confirmation email to: ${to}`);
      return { 
        success: true, 
        message: 'Ticket email sent successfully',
        to,
        ticketNumber
      };
      
    } catch (error) {
      logger.error('Error sending ticket confirmation email:', error);
      throw error;
    }
  }

  /**
   * Process pending payments that might have failed during webhook processing
   * This can be called from a cron job to retry failed payments
   * @param {number} [hoursAgo=24] - Only process payments from the last X hours
   * @param {number} [limit=100] - Maximum number of payments to process
   * @returns {Promise<Object>} - Result of the operation
   */
  static async processPendingPayments(hoursAgo = 24, limit = 100) {
    const client = await pool.connect();
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Find pending or failed payments from the last X hours
      const query = `
        SELECT p.* 
        FROM payments p
        WHERE 
          p.status = 'completed' AND
          p.created_at >= NOW() - INTERVAL '${hoursAgo} hours' AND
          (
            -- Either no ticket exists yet
            NOT EXISTS (SELECT 1 FROM tickets t WHERE t.metadata->>'payment_id' = p.id::text) OR
            
            -- Or email was not sent successfully
            (
              p.metadata->'email_attempts' IS NOT NULL AND
              NOT EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(p.metadata->'email_attempts') a 
                WHERE (a->>'success')::boolean = true
              )
            )
          )
        ORDER BY p.created_at DESC
        LIMIT $1
      `;
      
      const { rows: pendingPayments } = await client.query(query, [limit]);
      
      if (pendingPayments.length === 0) {
        logger.info('No pending payments found for processing');
        return { processedCount, successCount, errorCount };
      }
      
      logger.info(`Found ${pendingPayments.length} pending payments to process`);
      
      // Process each payment
      for (const payment of pendingPayments) {
        processedCount++;
        
        try {
          logger.info(`Processing payment ${payment.id} (${processedCount}/${pendingPayments.length})`);
          
          // Process the payment (this will create ticket and send email if needed)
          const result = await this.processSuccessfulPayment(payment);
          
          if (result.success) {
            successCount++;
            logger.info(`Successfully processed payment ${payment.id}`);
          } else {
            errorCount++;
            logger.warn(`Failed to process payment ${payment.id}:`, result.error);
          }
          
        } catch (error) {
          errorCount++;
          logger.error(`Error processing payment ${payment.id}:`, error);
        }
        
        // Small delay between processing payments to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      logger.info(`Processed ${processedCount} payments: ${successCount} successful, ${errorCount} failed`);
      return { processedCount, successCount, errorCount };
      
    } catch (error) {
      logger.error('Error in processPendingPayments:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default PaymentCompletionService;
