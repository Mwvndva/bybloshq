import { pool } from '../config/database.js';
import { sendTicketEmail } from '../controllers/ticketController.js';
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
      
      // Debug: Query the payment directly from database
      const dbPayment = await client.query(
        'SELECT id, invoice_id, amount, status, ticket_type_id, event_id, metadata::text as metadata_raw FROM payments WHERE id = $1',
        [payment.id]
      );
      
      if (dbPayment.rows.length > 0) {
        const dbRow = dbPayment.rows[0];
        logger.info('Raw payment data from database:', {
          id: dbRow.id,
          invoice_id: dbRow.invoice_id,
          amount: dbRow.amount,
          status: dbRow.status,
          ticket_type_id: dbRow.ticket_type_id,
          event_id: dbRow.event_id,
          metadata_raw: dbRow.metadata_raw,
          metadata_type: typeof dbRow.metadata_raw
        });
        
        // Update the payment object with database values
        payment = { ...payment, ...dbRow };
        
        // Check if there are any existing tickets for this payment
        const existingTickets = await client.query(
          'SELECT id, status, ticket_type_id FROM tickets WHERE payment_id = $1',
          [payment.id]
        );
        
        if (existingTickets.rows.length > 0) {
          logger.info('Found existing tickets for payment:', {
            paymentId: payment.id,
            ticketCount: existingTickets.rows.length,
            tickets: existingTickets.rows.map(t => ({
              id: t.id,
              status: t.status,
              ticket_type_id: t.ticket_type_id
            }))
          });
        }
      }
      
      // Use advisory lock to prevent concurrent processing of the same payment
      const lockId = `payment_${payment.id}`;
      const lockResult = await client.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) as locked',
        [lockId]
      );
      
      if (!lockResult.rows[0].locked) {
        throw new Error(`Could not acquire lock for payment ${payment.id}`);
      }
      
      // Log the start of payment processing
      logger.info(`Processing successful payment ${payment.id} for invoice ${payment.invoice_id}`, {
        paymentId: payment.id,
        invoiceId: payment.invoice_id,
        amount: payment.amount,
        status: payment.status,
        ticketId: payment.ticket_id,
        eventId: payment.event_id,
        organizerId: payment.organizer_id,
        metadata: payment.metadata,
        lockAcquired: true
      });

      // Check if this payment was already processed successfully
      if (payment.status === 'completed' && payment.metadata?.email_sent) {
        logger.info(`Payment ${payment.id} was already processed and email sent, skipping duplicate processing`, {
          paymentId: payment.id,
          emailSentAt: payment.metadata.email_sent_at
        });
        await client.query('ROLLBACK');
        return { success: true, alreadyProcessed: true };
      }
      
      // Check if this payment already has a ticket (with FOR UPDATE to lock the row)
      let ticket;
      let isExistingTicket = false;
      
      // First check if there's a ticket with this payment ID in metadata
      const existingTicketByPayment = await client.query(
        `SELECT * FROM tickets 
         WHERE metadata->>'payment_id' = $1 
         FOR UPDATE`,
        [payment.id.toString()]
      );
      
      if (existingTicketByPayment.rows.length > 0) {
        // Found ticket by payment ID in metadata
        ticket = existingTicketByPayment.rows[0];
        logger.info(`Found existing ticket ${ticket.id} for payment ${payment.id} via metadata`);
        isExistingTicket = true;
      } 
      // If no ticket found by metadata but payment has ticket_id, check that
      else if (payment.ticket_id) {
        logger.info(`Checking for existing ticket with ID ${payment.ticket_id} for payment ${payment.id}`);
        const ticketResult = await client.query(
          'SELECT * FROM tickets WHERE id = $1 FOR UPDATE',
          [payment.ticket_id]
        );
        
        if (ticketResult.rows.length > 0) {
          ticket = ticketResult.rows[0];
          logger.info(`Found existing ticket ${ticket.id} for payment ${payment.id}`);
          isExistingTicket = true;
        } else {
          logger.warn(`Ticket ${payment.ticket_id} not found for payment ${payment.id}, will create new ticket`);
        }
      }
      
      // If we found an existing ticket and payment is already completed, this is a duplicate webhook
      if (isExistingTicket && payment.status === 'completed') {
        logger.info(`Payment ${payment.id} is already marked as completed, skipping duplicate processing`);
        await client.query('ROLLBACK');
        return { success: true, alreadyProcessed: true };
      }
      
      // If no existing ticket, create one
      logger.info(`Creating new ticket for payment ${payment.id}`, {
        paymentId: payment.id,
        invoiceId: payment.invoice_id,
        ticketTypeId: payment.ticket_type_id,
        eventId: payment.event_id,
        customerEmail: payment.email,
        amount: payment.amount
      });
      
      // Log complete payment object for debugging
      logger.info('Processing payment object:', {
        paymentId: payment.id,
        hasTicketTypeId: !!payment.ticket_type_id,
        ticketTypeId: payment.ticket_type_id,
        metadataType: typeof payment.metadata,
        metadata: payment.metadata,
        paymentKeys: Object.keys(payment).filter(k => !['metadata'].includes(k))
      });

      // Validate required fields for ticket creation
      if (!payment.ticket_type_id) {
        // Try to get from metadata if available
        try {
          let metadata = payment.metadata || {};
          
          // Try to parse metadata if it's a string
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch (parseError) {
              logger.warn('Failed to parse metadata as JSON, using as-is', {
                paymentId: payment.id,
                metadata: payment.metadata
              });
            }
          }
          
          logger.info('Checking metadata for ticket_type_id:', {
            paymentId: payment.id,
            metadataKeys: Object.keys(metadata),
            hasTicketTypeId: !!metadata.ticket_type_id,
            ticketTypeId: metadata.ticket_type_id
          });
          
          if (metadata.ticket_type_id) {
            payment.ticket_type_id = metadata.ticket_type_id;
            logger.info(`Using ticket_type_id from metadata: ${payment.ticket_type_id}`, {
              paymentId: payment.id
            });
          } else {
            throw new Error('ticket_type_id not found in payment or metadata');
          }
        } catch (error) {
          logger.error('Error getting ticket_type_id from metadata:', {
            error: error.message,
            stack: error.stack,
            paymentId: payment.id,
            metadata: payment.metadata,
            payment: {
              id: payment.id,
              invoice_id: payment.invoice_id,
              amount: payment.amount,
              status: payment.status,
              ticket_type_id: payment.ticket_type_id,
              event_id: payment.event_id,
              metadata: payment.metadata
            }
          });
          throw new Error(`Payment is missing ticket_type_id and could not be retrieved from metadata. Payment ID: ${payment.id}, Invoice: ${payment.invoice_id}`);
        }
      }
      if (!payment.event_id) {
        throw new Error('Payment is missing event_id');
      }
      
      try {
        // The _createTicket method will now fetch the ticket details using the ticket_id
        ticket = await this._createTicket(client, payment);
        logger.info(`Successfully created ticket ${ticket.id} for payment ${payment.id}`);
        
        // The ticket already exists, so we don't need to update the payment with a new ticket ID
        if (ticket.id !== payment.ticket_id) {
          logger.warn(`Ticket ID mismatch: payment.ticket_id=${payment.ticket_id}, created ticket.id=${ticket.id}`);
        }
      } catch (ticketError) {
        const errorDetails = {
          error: ticketError.message,
          stack: ticketError.stack,
          payment: {
            id: payment.id,
            invoice_id: payment.invoice_id,
            amount: payment.amount,
            ticket_type_id: payment.ticket_type_id,
            ticket_id: payment.ticket_id,
            event_id: payment.event_id,
            organizer_id: payment.organizer_id,
            email: payment.email,
            metadata: payment.metadata
          },
          timestamp: new Date().toISOString()
        };
        
        logger.error(`Failed to create ticket for payment ${payment.id}:`, errorDetails);
        
        // Re-throw with more context
        const error = new Error(`Failed to create ticket: ${ticketError.message}`);
        error.details = errorDetails;
        throw error;
      }
      
      // Generate QR code for the ticket
      const qrCodeData = await this._generateQRCode(ticket);
      
      // Check if email was already sent successfully
      let emailResult = { success: false, reason: 'not_attempted' };
      const emailSent = payment.metadata?.email_sent === true || 
                       (payment.metadata?.email_attempts?.some(attempt => attempt.success === true));
      
      if (!emailSent) {
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second delay between retries
        let lastError = null;
        
        // Try sending email with retries
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            logger.info(`Sending ticket email (attempt ${attempt}/${maxRetries}) for payment ${payment.id}`);
            
            emailResult = await this._sendTicketConfirmationEmail(ticket, payment, qrCodeData);
            emailResult.attempt = attempt;
            
            // Update payment metadata to indicate email was sent successfully
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
            
            logger.info(`Successfully sent ticket email on attempt ${attempt} for payment ${payment.id}`);
            break; // Exit retry loop on success
            
          } catch (emailError) {
            lastError = emailError;
            logger.warn(`Email sending attempt ${attempt} failed for payment ${payment.id}:`, emailError.message);
            
            // Log the failed attempt in metadata
            await client.query(
              `UPDATE payments 
               SET metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{email_attempts}', 
                 COALESCE(metadata->'email_attempts', '[]'::jsonb) || 
                   jsonb_build_object(
                     'timestamp', to_jsonb(NOW()),
                     'success', false,
                     'error', emailError.message,
                     'attempt', $2::text
                   )::jsonb
               ) 
               WHERE id = $1`,
              [payment.id, attempt.toString()]
            );
            
            // If this was the last attempt, prepare the error result
            if (attempt === maxRetries) {
              emailResult = { 
                success: false, 
                error: `Failed after ${maxRetries} attempts: ${emailError.message}`,
                attempts: maxRetries
              };
              logger.error(`All ${maxRetries} email sending attempts failed for payment ${payment.id}`);
            } else {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
          }
        }
        
        // If we have a last error and no successful send, log it
        if (!emailResult.success && lastError) {
          logger.error('Final email sending failure for payment:', {
            paymentId: payment.id,
            ticketId: ticket.id,
            error: lastError.message,
            stack: lastError.stack
          });
        }
      } else {
        logger.info(`Email already sent successfully for payment ${payment.id}, skipping`);
        emailResult = { 
          success: true, 
          reason: 'already_sent',
          lastAttempt: payment.metadata?.email_attempts?.findLast(a => a.success === true)
        };
      }
      
      // Skip updating buyer information as requested
      // The buyers table should not be modified during payment processing
      const userUpdateResult = { 
        success: true, 
        message: 'Buyer information update skipped as per configuration' 
      };
      logger.info('Skipped buyer information update as configured');

      // Update payment status to completed if not already
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
      
      // Commit the transaction
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
        user: userUpdateResult,
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
      // First, check if a ticket already exists for this payment (with FOR UPDATE to lock the row)
      const existingTicket = await client.query(
        `SELECT * FROM tickets 
         WHERE metadata->>'payment_id' = $1 
         LIMIT 1 FOR UPDATE`,
        [payment.id.toString()]
      );

      if (existingTicket.rows.length > 0) {
        logger.warn(`Ticket already exists for payment ${payment.id}, returning existing ticket`);
        return existingTicket.rows[0];
      }
      
      // Double-check using payment's ticket_id if it exists
      if (payment.ticket_id) {
        const ticketById = await client.query(
          'SELECT * FROM tickets WHERE id = $1 FOR UPDATE',
          [payment.ticket_id]
        );
        
        if (ticketById.rows.length > 0) {
          logger.warn(`Found existing ticket by ID ${payment.ticket_id} for payment ${payment.id}`);
          return ticketById.rows[0];
        }
      }

    // Log the payment data for debugging
    logger.info('Creating ticket with payment data:', {
      paymentId: payment.id,
      invoiceId: payment.invoice_id,
      ticket_type_id: payment.ticket_type_id,
      event_id: payment.event_id,
      organizer_id: payment.organizer_id,
      email: payment.email,
      amount: payment.amount,
      metadata: payment.metadata || {}
    });

    const { 
      ticket_type_id: ticketTypeId,
      email: customerEmail,
      metadata = {},
      amount: price,
      event_id: eventId,
      organizer_id: organizerId
    } = payment;

    // Validate required fields with detailed error messages
    if (!ticketTypeId) {
      const error = new Error('Missing required field: ticket_type_id');
      error.details = {
        paymentId: payment.id,
        invoiceId: payment.invoice_id,
        paymentData: {
          id: payment.id,
          ticket_type_id: payment.ticket_type_id,
          event_id: payment.event_id,
          organizer_id: payment.organizer_id,
          metadata: payment.metadata || {}
        }
      };
      logger.error('Ticket creation failed - missing ticket_type_id', error.details);
      throw error;
    }
    
    if (!customerEmail) {
      throw new Error('Missing required field: customer_email');
    }
    
    if (!price) {
      throw new Error('Missing required field: amount');
    }
    
    if (!eventId) {
      throw new Error('Missing required field: event_id');
    }
    
    if (!organizerId) {
      throw new Error('Missing required field: organizer_id');
    }

      // Get ticket type details
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
      throw new Error(`Ticket type with ID ${ticketTypeId} not found for event ${eventId}`);
    }
    
    const ticketTypeData = ticketTypeResult.rows[0];
    
    logger.info('Retrieved ticket type details:', {
      ticketTypeId: ticketTypeData.ticket_type_id,
      ticketTypeName: ticketTypeData.ticket_type_name,
      eventName: ticketTypeData.event_name
    });

    // Extract customer details from metadata or use defaults
    const customerName = metadata.customer_name || payment.metadata?.user_name || 'Guest';
    const ticketTypeName = ticketTypeData.ticket_type_name || 'General Admission';
    const eventName = ticketTypeData.event_name || 'Event';
    const quantity = metadata.quantity || 1;
    
    // Generate a unique ticket number using UUID and timestamp
    const generateTicketNumber = () => {
      const uuid = uuidv4();
      return `TKT-${Date.now()}-${uuid.substring(0, 8)}`;
    };
    
    // Try up to 3 times to create a unique ticket
    let attempts = 0;
    const maxAttempts = 3;
    let ticketNumber;
    let ticket;
    
    // Use advisory lock to prevent concurrent ticket creation for the same payment
    const lockId = `ticket_creation_${payment.id}`;
    const lockKey = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) as locked',
      [lockId]
    );
    
    if (!lockKey.rows[0].locked) {
      throw new Error('Could not acquire lock for ticket creation');
    }
    
    // Double-check if ticket was created while waiting for the lock
    const recheckTicket = await client.query(
      'SELECT * FROM tickets WHERE metadata->>\'payment_id\' = $1',
      [payment.id]
    );
    
    if (recheckTicket.rows.length > 0) {
      logger.warn(`Ticket was created while waiting for lock, returning existing ticket for payment ${payment.id}`);
      return recheckTicket.rows[0];
    }
      
    while (attempts < maxAttempts) {
      try {
        ticketNumber = generateTicketNumber();
        attempts++;
        
        const query = `
          WITH inserted_ticket AS (
            INSERT INTO tickets (
              ticket_number, 
              event_id, 
              organizer_id, 
              customer_name, 
              customer_email, 
              ticket_type_id, 
              ticket_type_name,
              price,
              status,
              metadata,
              created_at, 
              updated_at
            ) 
            SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
            WHERE NOT EXISTS (
              SELECT 1 FROM tickets 
              WHERE metadata->>'payment_id' = $11
            )
            RETURNING *
          )
          SELECT * FROM inserted_ticket
          UNION
          SELECT * FROM tickets 
          WHERE metadata->>'payment_id' = $11
          LIMIT 1
        `;
  
        const values = [
          ticketNumber,
          eventId,
          organizerId,
          customerName,
          customerEmail,
          ticketTypeId,
          ticketTypeName,
          price / (quantity || 1), // Price per ticket
          'paid',
          JSON.stringify({
            ...metadata,
            payment_id: payment.id,
            payment_method: payment.payment_method,
            purchase_date: new Date().toISOString(),
            creation_attempt: attempts,
            created_at: new Date().toISOString()
          }),
          payment.id.toString() // For the WHERE NOT EXISTS check
        ];
        
        const { rows } = await client.query(query, values);
        
        if (rows.length > 0) {
          ticket = rows[0];
          logger.info(`Successfully created ticket ${ticket.id} with number ${ticketNumber} for payment ${payment.id}`);
          return ticket;
        }
        
        // If we're here, it means the ticket number already existed and we got no rows back
        logger.warn(`Ticket number ${ticketNumber} already exists, retrying... (attempt ${attempts} of ${maxAttempts})`);
        
      } catch (error) {
        // If it's a unique violation, log and retry
        if (error.code === '23505' && error.constraint === 'tickets_ticket_number_key') {
          logger.warn(`Ticket number ${ticketNumber} already exists, retrying... (attempt ${attempts} of ${maxAttempts})`);
        } else {
          // For other errors, rethrow
          throw error;
        }
      }
    }
    
    // If we've exhausted all attempts
    throw new Error(`Failed to generate a unique ticket number after ${maxAttempts} attempts`);
  } catch (error) {
    logger.error('Error in _createTicket:', {
      error: error.message,
      paymentId: payment.id,
      ticketTypeId: payment.ticket_id,
      eventId: payment.event_id,
      organizerId: payment.organizer_id,
      metadata: payment.metadata
    });
    throw error;
  }
  }

  /**
   * Update payment record with ticket ID
   * @private
   */
  static async _updatePaymentWithTicketId(client, paymentId, ticketId) {
    const query = `
      UPDATE payments 
      SET ticket_id = $1, 
          updated_at = NOW() 
      WHERE id = $2
      RETURNING *
    `;
    
    const { rows } = await client.query(query, [ticketId, paymentId]);
    return rows[0];
  }

  /**
   * Generate QR code for the ticket with validation data
   * @private
   */
  static async _generateQRCode(ticket) {
    try {
      // Create a secure token for validation using uuidv4
      const token = uuidv4();
      const validationTimestamp = Date.now();
      
      // Get event details for validation
      const eventQuery = 'SELECT name, start_date, end_date FROM events WHERE id = $1';
      const eventResult = await pool.query(eventQuery, [ticket.event_id]);
      const event = eventResult.rows[0];
      
      // Store the validation token in the ticket metadata
      await pool.query(
        `UPDATE tickets SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ 
          validationToken: token, 
          validationTimestamp,
          // Store additional data needed for validation
          eventName: event?.name || '',
          eventStart: event?.start_date?.toISOString() || '',
          eventEnd: event?.end_date?.toISOString() || '',
          customerName: ticket.customer_name,
          ticketType: ticket.ticket_type_name || 'General Admission'
        }), ticket.id]
      );
      
      // Create validation URL with ticket number and qr flag
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const validationUrl = `${baseUrl}/tickets/validate/${ticket.ticket_number}?qr=true`;
      
      // Generate QR code with just the validation URL
      return await QRCode.toDataURL(validationUrl);
    } catch (error) {
      logger.error('Error generating QR code:', error);
      return null;
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
      
      // Prepare event details from metadata or use defaults
      const eventName = metadata.event_name || 'Event';
      const eventDate = metadata.event_date || new Date().toISOString();
      const eventLocation = metadata.event_location || 'Venue not specified';
      
      // Format the date for display
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
      
      // Prepare ticket data for the email template
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
        // Include any additional metadata that might be used in the template
        ...metadata
      };

      // Log the email being sent (without sensitive data)
      logger.info(`Sending ticket confirmation email to: ${to}`, {
        ticketNumber,
        eventName,
        hasQrCode: !!qrCodeData
      });

      // Create a mock response object for the email controller
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

      // Call the email controller
      await sendTicketEmail({
        body: {
          to,
          subject: `Your Ticket Confirmation - ${ticketData.eventName}`,
          ticketData
        }
      }, mockRes);
      
      // Check if we got a successful response
      if (!responseData || responseData.status >= 400) {
        throw new Error(responseData?.data?.message || 'Failed to send email');
      }
      
      logger.info(`Successfully sent ticket confirmation email to: ${to}`);
      return { 
        success: true, 
        message: 'Email sent successfully',
        to,
        ticketNumber
      };
      
    } catch (error) {
      logger.error('Error sending ticket confirmation email:', {
        error: error.message,
        ticketId: ticket.id,
        paymentId: payment.id,
        stack: error.stack
      });
      
      // Rethrow with additional context
      const enhancedError = new Error(`Failed to send ticket confirmation: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.ticketId = ticket.id;
      enhancedError.paymentId = payment.id;
      throw enhancedError;
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
            NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = p.ticket_id) OR
            
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