import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import PaymentCompletionService from '../services/paymentCompletion.service.js';
import { v4 as uuidv4 } from 'uuid';

class PaymentController {
  /**
   * Format and validate phone number for M-Pesa
   * @param {string} phone - Raw phone number
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it starts with 0, replace with 254
    if (digits.startsWith('0')) {
      return '254' + digits.substring(1);
    }
    
    // If it starts with +254, remove the +
    if (digits.startsWith('254')) {
      return digits;
    }
    
    // If it's 9 digits and starts with 7 or 1, add 254 prefix
    if (digits.length === 9 && /^[17]/.test(digits)) {
      return '254' + digits;
    }
    
    throw new Error('Invalid phone number format. Please use a valid Kenyan number (e.g., 0712345678 or 254712345678)');
  }

  /**
   * Initiate payment for ticket purchase
   * @route POST /api/payments/initiate
   */
  initiatePayment = async (req, res, next) => {
    const client = await pool.connect();
    
    try {
      // Log complete request body for debugging
      logger.info('Payment initiation request:', { 
        body: req.body,
        params: req.params,
        query: req.query 
      });

      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('Validation errors:', { errors: errors.array() });
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { phone, email, amount, ticketId, eventId, ticketTypeId: ticketTypeIdFromBody } = req.body;
      
      // Handle both ticketId and ticketTypeId for backward compatibility
      const ticketTypeId = ticketTypeIdFromBody || ticketId;
      
      if (!ticketTypeId) {
        throw new Error('Either ticketId or ticketTypeId must be provided');
      }
      
      // Validate required fields
      const missingFields = [];
      if (!phone) missingFields.push('phone');
      if (!email) missingFields.push('email');
      if (!amount) missingFields.push('amount');
      if (!eventId) missingFields.push('eventId');
      if (!ticketTypeId) missingFields.push('ticketTypeId');
      
      if (missingFields.length > 0) {
        const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
        error.details = { 
          phone: !!phone, 
          email: !!email, 
          amount: !!amount, 
          eventId: !!eventId, 
          ticketTypeId: !!ticketTypeId,
          requestBody: req.body  // Log the complete request body
        };
        logger.error('Missing required fields in payment request:', error.details);
        throw error;
      }
      const userId = req.user?.id; // If using authentication
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Format and validate phone number
        const formattedPhone = this.formatPhoneNumber(phone);
        
        // Check ticket availability and get ticket type details
        logger.info('Looking up ticket type:', { ticketTypeId, eventId });
        
        // First, check if the event exists
        const eventCheck = await client.query(
          'SELECT id, name, status FROM events WHERE id = $1',
          [eventId]
        );
        
        if (eventCheck.rows.length === 0) {
          throw new Error(`Event with ID ${eventId} not found`);
        }
        
        logger.info('Event found:', eventCheck.rows[0]);
        
        // Then check ticket types for this event
        const ticketTypeResult = await client.query(
          `SELECT tt.*, e.organizer_id,
                  (SELECT COUNT(*) FROM tickets t 
                   WHERE t.ticket_type_id = tt.id 
                   AND t.status = 'paid') as sold_count
           FROM ticket_types tt
           JOIN events e ON e.id = tt.event_id
           WHERE tt.id = $1 AND tt.event_id = $2`,
          [ticketTypeId, eventId]
        );
        
        if (ticketTypeResult.rows.length === 0) {
          // Log all ticket types for this event for debugging
          const allTicketTypes = await client.query(
            'SELECT id, name, event_id FROM ticket_types WHERE event_id = $1',
            [eventId]
          );
          
          logger.error('Ticket type not found. Available ticket types for this event:', {
            eventId,
            requestedTicketTypeId: ticketTypeId,
            availableTicketTypes: allTicketTypes.rows
          });
          
          throw new Error(`Ticket type ${ticketTypeId} not found for event ${eventId}`);
        }
        
        const ticketType = ticketTypeResult.rows[0];
        
        // Check if ticket type has quantity limit and if it's sold out
        if (ticketType.quantity !== null && ticketType.sold_count >= ticketType.quantity) {
          throw new Error('This ticket type is sold out');
        }
        
        // Create payment record
        if (!ticketType.organizer_id) {
          throw new Error('Organizer ID not found for this ticket type');
        }
        
        // Generate a unique invoice ID - use a shorter format that matches what IntaSend expects
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const invoiceId = `INV-${timestamp}-${randomNum}`;
        
        logger.info(`Generated invoice ID: ${invoiceId}`, {
          timestamp,
          randomNum,
          eventId,
          ticketTypeId,
          amount
        });
        
        // Insert the payment record without provider_reference first
        const paymentResult = await client.query(
          `INSERT INTO payments (
            invoice_id, amount, currency, status, payment_method,
            phone_number, email, ticket_type_id, event_id, organizer_id,
            metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING *`,
          [
            invoiceId,
            amount,
            'KES',
            'pending',
            'mpesa',
            formattedPhone,
            email,
            ticketTypeId,
            eventId,
            ticketType.organizer_id,
            JSON.stringify({
              user_id: userId,
              ticket_details: {
                id: ticketType.id,
                name: ticketType.name,
                price: ticketType.price,
                event_id: eventId,
                organizer_id: ticketType.organizer_id
              },
              payment_initiated_at: new Date().toISOString()
            })
          ]
        );
        
        let payment = paymentResult.rows[0];
        
        // Process payment with payment provider
        try {
          const paymentResponse = await paymentService.initiateMpesaPayment({
            amount: amount,
            phone: formattedPhone,
            email: email,
            invoice_id: invoiceId,
            firstName: email.split('@')[0] || 'Customer',
            lastName: '',
            narrative: `Payment for ${ticketType.name} ticket`
          });

          // Update payment with provider reference and api_ref if available
          if (paymentResponse) {
            // Ensure we have a valid api_ref (use invoice_id from response or our generated one)
            const apiRef = paymentResponse.invoice_id || invoiceId;
            
            logger.info('Updating payment with provider details:', {
              paymentId: payment.id,
              providerReference: paymentResponse.reference,
              apiRef: apiRef,
              responseInvoiceId: paymentResponse.invoice_id,
              ourInvoiceId: invoiceId
            });
            
            const updateParams = [
              paymentResponse.reference || null, // provider_reference
              apiRef, // api_ref
              payment.id
            ];
            
            await client.query(
              `UPDATE payments 
               SET provider_reference = $1, 
                   api_ref = $2,
                   updated_at = NOW() 
               WHERE id = $3`,
              updateParams
            );
            
            // Refresh payment data with the updated record
            const updatedPayment = await client.query(
              'SELECT * FROM payments WHERE id = $1',
              [payment.id]
            );
            payment = updatedPayment.rows[0];
            
            logger.info('Successfully updated payment with provider details:', {
              paymentId: payment.id,
              providerReference: payment.provider_reference,
              apiRef: payment.api_ref,
              invoiceId: payment.invoice_id
            });
          }
          
          // Commit the transaction
          await client.query('COMMIT');
          
          return res.status(200).json({
            success: true,
            message: 'Payment initiated successfully',
            data: {
              payment: {
                id: payment.id,
                invoiceId: payment.invoice_id, // Changed from invoice_id to invoiceId
                amount: payment.amount,
                status: payment.status,
                provider_reference: payment.provider_reference,
                api_ref: payment.api_ref
              },
              payment_provider_response: paymentResponse,
              // Add invoiceId at the root level for backward compatibility
              invoiceId: payment.invoice_id
            }
          });
        } catch (paymentError) {
          // Update payment status to failed
          await client.query(
            'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2',
            ['failed', payment.id]
          );
          
          // Log the error
          logger.error('Error processing payment:', {
            error: paymentError.message,
            stack: paymentError.stack,
            paymentId: payment.id
          });
          
          // Re-throw to be caught by the outer catch block
          throw new Error(`Payment processing failed: ${paymentError.message}`);
        }
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      logger.error('Error initiating payment:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to initiate payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  }

  /**
   * Check payment status
   * @route GET /api/payments/status/:invoiceId
   */
  checkStatus = async (req, res) => {
    const { invoiceId } = req.params;
    const client = await pool.connect();
    
    if (!invoiceId || invoiceId === 'undefined') {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required and cannot be undefined'
      });
    }
    
    logger.info(`Checking payment status for ID: ${invoiceId}`);
    
    try {
      await client.query('BEGIN');
      // First try to find by api_ref (from IntaSend) or invoice_id
      // Use the transaction client and add FOR UPDATE to lock the row
      const result = await client.query(
        `SELECT * FROM payments 
         WHERE api_ref = $1 OR invoice_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1
         FOR UPDATE`,
        [invoiceId]
      );
      
      if (result.rows.length === 0) {
        logger.warn(`Payment not found for ID: ${invoiceId}`);
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
          debug: process.env.NODE_ENV === 'development' ? { searchedId: invoiceId } : undefined
        });
      }
      
      const payment = result.rows[0];
      
      logger.info(`Found payment with status: ${payment.status}`, {
        paymentId: payment.id,
        apiRef: payment.api_ref,
        invoiceId: payment.invoice_id,
        status: payment.status
      });
      
      // If payment is not yet completed, check with payment provider
      if ((payment.status === 'pending' || payment.status === 'processing') && (payment.provider_reference || payment.invoice_id)) {
        try {
          // Try with provider_reference first, fallback to invoice_id
          const reference = payment.provider_reference || payment.invoice_id;
          logger.info(`Checking payment status with provider using reference: ${reference}`);
          
          const statusCheck = await paymentService.checkPaymentStatus(reference);
          
          // Log the full status response for debugging
          logger.info('Raw payment status check response:', {
            reference,
            rawResponse: statusCheck,
            hasState: !!statusCheck.state,
            hasStatus: !!statusCheck.status,
            state: statusCheck.state,
            status: statusCheck.status
          });
          
          // Map the provider's status to our status
          const statusFromProvider = statusCheck.state || statusCheck.status;
          const mappedStatus = this.mapPaymentStatus(statusFromProvider);
          
          logger.info('Mapped payment status:', {
            reference,
            statusFromProvider,
            mappedStatus,
            currentStatus: payment.status
          });
          
          // Always update if the status has changed
          const isStatusChange = mappedStatus !== payment.status.toLowerCase();
          
          // We should update the status if:
          // 1. The status has changed, or
          // 2. The provider reports a completed status
          const shouldUpdate = isStatusChange || 
                             (mappedStatus === 'completed' && payment.status !== 'completed');
          
          // Log the update decision
          logger.info('Payment status update decision:', {
            paymentId: payment.id,
            currentStatus: payment.status,
            newStatus: mappedStatus,
            shouldUpdate,
            reason: isStatusChange ? 'status-changed' : 
                   (mappedStatus === 'completed' ? 'force-completed' : 'no-update')
          });
          
          const willUpdate = shouldUpdate;
          
          logger.debug('Status update evaluation:', {
            currentStatus: payment.status,
            mappedStatus,
            isStatusChange,
            shouldUpdateStatus,
            shouldForceUpdate,
            willUpdate
          });
          
          logger.info(`Payment status update decision:`, {
            paymentId: payment.id,
            currentStatus: payment.status,
            newStatus: mappedStatus,
            statusFromProvider,
            shouldUpdate: willUpdate,
            reason: shouldForceUpdate ? 'force-update-to-completed' : 
                   shouldUpdateStatus ? 'valid-status-transition' : 'no-update-needed'
          });
          
          if (willUpdate) {
            logger.info(`Updating payment status from ${payment.status} to ${mappedStatus} for payment ${payment.id}`);
            
            try {
              // Start a new transaction for the update
              await client.query('BEGIN');
              
              // Update the payment status with row-level locking
              const updateResult = await client.query(
                `UPDATE payments 
                 SET status = $1, 
                     updated_at = NOW(),
                     provider_reference = COALESCE($2, provider_reference)
                 WHERE id = $3
                 RETURNING status, updated_at, ticket_id`,
                [
                  mappedStatus,
                  statusCheck.provider_reference || statusCheck.mpesa_reference || payment.provider_reference,
                  payment.id
                ]
              );
              
              logger.info('Payment status update result:', {
                paymentId: payment.id,
                rowsUpdated: updateResult.rowCount,
                newStatus: updateResult.rows[0]?.status,
                updatedAt: updateResult.rows[0]?.updated_at,
                hasTicket: !!updateResult.rows[0]?.ticket_id
              });
              
              // If payment is completed, create a ticket if we don't have one
              if (mappedStatus === 'completed' && !updateResult.rows[0]?.ticket_id) {
                logger.info(`Creating ticket for completed payment ${payment.id}`);
                try {
                  await this.createTicketForPayment(client, payment);
                  // Verify the ticket was created
                  const updatedPayment = await client.query(
                    'SELECT ticket_id FROM payments WHERE id = $1',
                    [payment.id]
                  );
                  logger.info('Ticket creation verification:', {
                    paymentId: payment.id,
                    hasTicket: !!updatedPayment.rows[0]?.ticket_id
                  });
                } catch (ticketError) {
                  logger.error('Error creating ticket:', {
                    error: ticketError.message,
                    stack: ticketError.stack,
                    paymentId: payment.id
                  });
                  throw ticketError; // Re-throw to trigger rollback
                }
              }
              
              // Commit the transaction
              await client.query('COMMIT');
              logger.info(`Successfully committed status update for payment ${payment.id}`);
              
            } catch (updateError) {
              // Rollback on error
              await client.query('ROLLBACK');
              logger.error('Error updating payment status:', {
                error: updateError.message,
                stack: updateError.stack,
                paymentId: payment.id
              });
              throw updateError;
            }
            
            // Update the payment object with the new status
            payment.status = mappedStatus;
          }
        } catch (error) {
          logger.error('Error checking payment status with provider:', {
            error: error.message,
            stack: error.stack,
            paymentId: payment.id,
            providerReference: payment.provider_reference,
            invoiceId: payment.invoice_id
          });
          // Continue with the current status if there's an error checking with provider
        }
      }
      
      // Get the latest status from the database before committing
      const finalStatus = await client.query(
        'SELECT status, ticket_id FROM payments WHERE id = $1',
        [payment.id]
      );
      
      logger.info('Final payment status before response:', {
        paymentId: payment.id,
        status: finalStatus.rows[0].status,
        hasTicket: !!finalStatus.rows[0].ticket_id
      });
      
      // Verify final status before committing
      const finalCheck = await client.query(
        'SELECT status, updated_at FROM payments WHERE id = $1',
        [payment.id]
      );
      
      logger.info('Final status before commit:', {
        paymentId: payment.id,
        status: finalCheck.rows[0]?.status,
        updatedAt: finalCheck.rows[0]?.updated_at
      });
      
      await client.query('COMMIT');
      logger.info(`Successfully committed transaction for payment ${payment.id}`);
      
      return res.json({
        success: true,
        data: {
          status: finalStatus.rows[0].status,
          amount: payment.amount,
          currency: payment.currency,
          ticketId: payment.ticket_id,
          eventId: payment.event_id,
          ticketTypeId: payment.ticket_type_id,
          userId: payment.user_id,
          paymentId: payment.id,
          apiRef: payment.api_ref,
          invoiceId: payment.invoice_id,
          invoice_id: payment.invoice_id, // Keep for backward compatibility
          providerReference: payment.provider_reference,
          metadata: payment.metadata,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at
        }
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        logger.error('Error rolling back transaction:', rollbackError);
      });
      
      logger.error('Error in checkStatus:', {
        error: error.message,
        stack: error.stack,
        invoiceId
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error checking payment status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        debug: process.env.NODE_ENV === 'development' ? {
          error: error.message,
          stack: error.stack
        } : undefined
      });
    } finally {
      client.release();
    }
  }

  /**
   * Handle payment webhooks from payment provider
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  handleWebhook = async (req, res) => {
    const client = await pool.connect();
    
    try {
      const payload = req.body;
      logger.info('Received payment webhook:', { 
        payloadKeys: Object.keys(payload),
        payload: process.env.NODE_ENV === 'development' ? payload : { type: 'webhook', id: payload.id }
      });
      
      // Verify webhook signature if required
      // ...
      
      // Use api_ref or fallback to invoice_id from the payload
      const apiRef = payload.api_ref || payload.invoice_id || (payload.data && payload.data.invoice_id);
      if (!apiRef) {
        const errorMsg = 'No api_ref or invoice_id found in webhook payload';
        logger.error(errorMsg, { 
          payloadKeys: Object.keys(payload),
          payload: process.env.NODE_ENV === 'development' ? payload : '[REDACTED]' 
        });
        return res.status(400).json({
          success: false,
          message: errorMsg,
          receivedPayload: process.env.NODE_ENV === 'development' ? payload : undefined
        });
      }
      
      logger.info(`Processing webhook for api_ref: ${apiRef}`, {
        invoice_id: payload.invoice_id || (payload.data && payload.data.invoice_id),
        state: payload.state || (payload.data && payload.data.state),
        provider: payload.provider,
        webhookType: payload.type
      });
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // First try to find by api_ref or invoice_id
        const paymentResult = await client.query(
          `SELECT * FROM payments 
           WHERE api_ref = $1 OR invoice_id = $1 
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          [apiRef]
        );
        
        let payment = paymentResult.rows[0];
        
        // If not found, try with invoice_id from payload if different from apiRef
        if (!payment && payload.invoice_id && payload.invoice_id !== apiRef) {
          logger.info(`Trying fallback lookup with invoice_id: ${payload.invoice_id}`);
          const fallbackResult = await client.query(
            `SELECT * FROM payments 
             WHERE invoice_id = $1 
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [payload.invoice_id]
          );
          
          if (fallbackResult.rows.length > 0) {
            payment = fallbackResult.rows[0];
            // Update the payment with the api_ref for future reference
            await client.query(
              'UPDATE payments SET api_ref = $1, updated_at = NOW() WHERE id = $2',
              [apiRef, payment.id]
            );
            logger.info(`Updated payment ${payment.id} with api_ref: ${apiRef}`);
          }
        }
        
        if (!payment) {
          // Log all potential matches for debugging
          const allPayments = await client.query(
            'SELECT id, invoice_id, api_ref, status, created_at FROM payments ORDER BY created_at DESC LIMIT 10'
          );
          
          logger.error(`Payment not found for api_ref/invoice_id: ${apiRef}. Recent payments:`, {
            recentPayments: allPayments.rows,
            searchApiRef: apiRef,
            searchInvoiceId: payload.invoice_id
          });
          
          throw new Error(`Payment with api_ref/invoice_id '${apiRef}' not found`);
        }
        
        // Skip if payment is already completed
        if (payment.status === 'completed') {
          await client.query('COMMIT');
          return res.json({ success: true, message: 'Payment already processed' });
        }
        
        // Map the state from the webhook payload to our status
        // IntaSend uses 'state' in webhook but 'status' in API responses
        const statusFromWebhook = payload.state || payload.status;
        const newStatus = this.mapPaymentStatus(statusFromWebhook);
        
        // Log the status mapping for debugging
        logger.info(`Mapping webhook state '${statusFromWebhook}' to status '${newStatus}' for payment ${payment.id}`);
        
        // Update payment status and save the provider's reference
        await client.query(
          `UPDATE payments 
           SET status = $1, 
               provider_reference = COALESCE($2, provider_reference),
               updated_at = NOW() 
           WHERE id = $3`,
          [
            newStatus,
            payload.mpesa_reference || payload.provider_reference || payment.provider_reference,
            payment.id
          ]
        );
        
        logger.info(`Updated payment ${payment.id} to status: ${newStatus}`, {
          paymentId: payment.id,
          previousStatus: payment.status,
          newStatus,
          providerReference: payload.mpesa_reference || payload.provider_reference,
          webhookPayload: payload
        });
        
        // If payment is completed, process ticket creation
        if (newStatus === 'completed') {
          try {
            await PaymentCompletionService.processSuccessfulPayment({
              ...payment,
              status: newStatus
            });
          } catch (ticketError) {
            logger.error('Error processing ticket creation:', ticketError);
            // Don't fail the entire webhook if ticket creation fails
            // The payment is still marked as completed
          }
        }
        
        await client.query('COMMIT');
        return res.json({ success: true, message: 'Webhook processed successfully' });
        
      } catch (error) {
        await client.query('ROLLBACK').catch(rollbackError => {
          logger.error('Error rolling back transaction:', rollbackError);
        });
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Error processing payment webhook:', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing webhook',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  mapPaymentStatus = (providerStatus) => {
    const statusMap = {
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'AWAITING_AUTH': 'pending',
      'AWAITING_CONFIRMATION': 'pending',
      'COMPLETED': 'completed',
      'COMPLETE': 'completed', // Handle both 'COMPLETE' and 'COMPLETED'
      'SUCCESS': 'completed',
      'SUCCESSFUL': 'completed',
      'FAILED': 'failed',
      'ERROR': 'failed',
      'DECLINED': 'failed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'cancelled',
      'REVERSED': 'refunded',
      'REFUNDED': 'refunded',
      'UNKNOWN': 'pending',
      // M-Pesa specific states
      'SUBMITTED': 'pending',
      'SETTLED': 'completed',
      'PENDING_CONFIRMATION': 'pending'
    };
    
    const normalizedStatus = (providerStatus || '').toUpperCase().trim();
    // Default to pending instead of failed for unknown states to prevent false failures
    return statusMap[normalizedStatus] || 'pending';
  }
}

export default new PaymentController();
