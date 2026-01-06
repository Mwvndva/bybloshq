import { pool } from '../config/database.js';
import { sendPaymentConfirmationEmail } from '../utils/email.js';
import { sendTicketEmail } from '../controllers/ticketController.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import logger from '../utils/logger.js';
import Buyer from '../models/buyer.model.js';
import whatsappService from './whatsapp.service.js';

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
      logger.info(`Attempting to acquire lock: ${lockId}`);
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
        logger.info(`Processing product payment ${payment.id}`, {
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          productId: metadata.product_id,
          orderId: metadata.order_id,
          status: payment.status
        });

        // IDEMPOTENCY CHECK: If payment is already completed, don't re-process
        // unless we specifically want to retry notifications (which we should handle carefully)
        if (payment.status === 'completed' && metadata.order_completed_at) {
          logger.info(`Product payment ${payment.id} already completed at ${metadata.order_completed_at}. Skipping to prevent duplicate notifications.`);
          await client.query('ROLLBACK');
          return { success: true, alreadyProcessed: true };
        }

        const result = await this._completeProductOrder(client, payment);
        await client.query('COMMIT');
        return result;
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
        logger.info(`Payment ${payment.id} already has email_sent: true in metadata. Skipping.`, {
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

      // If we found an existing ticket and payment is already completed, 
      // check if we still need to send an email before skipping
      const emailSent = payment.metadata?.email_sent === true ||
        (payment.metadata?.email_attempts?.some(attempt => attempt.success === true));

      if (isExistingTicket && payment.status === 'completed' && emailSent) {
        logger.info(`Payment ${payment.id} is already marked as completed with email sent, skipping`);
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
      // Use the emailSent flag determined above if it exists, otherwise check now
      const hasEmailSent = emailSent !== undefined ? emailSent : (
        payment.metadata?.email_sent === true ||
        (payment.metadata?.email_attempts?.some(attempt => attempt.success === true))
      );

      if (!hasEmailSent) {
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

      logger.info(`=== PAYMENT PROCESSING COMPLETED SUCCESSFULLY ===`, {
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
        FROM event_ticket_types tt
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
      const quantity = parseInt(metadata.quantity || 1, 10);
      const discountAmount = parseFloat(metadata.discount_amount || 0);

      const expectedTotalPrice = (parseFloat(ticketTypeData.price) * quantity) - discountAmount;
      const actualPaidPrice = parseFloat(price);

      // SECURITY: Final check that the paid amount matches the expected amount
      if (Math.abs(expectedTotalPrice - actualPaidPrice) > 1.0) { // Allow 1 unit margin for rounding
        logger.error('PAYMENT AMOUNT MISMATCH - POSSIBLE TAMPERING DETECTED', {
          expected: expectedTotalPrice,
          actual: actualPaidPrice,
          discount: discountAmount,
          paymentId: payment.id
        });
        throw new Error(`Payment amount mismatch: expected ${expectedTotalPrice}, got ${actualPaidPrice}`);
      }

      logger.info('Ticket details validated against paid amount:', {
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

      // Send ticket email using consolidated service
      logger.info(`Calling sendPaymentConfirmationEmail for ${to}...`, {
        eventName: ticketData.eventName,
        ticketNumber: ticketData.ticketNumber,
        paymentId: payment.id
      });

      await sendPaymentConfirmationEmail(to, ticketData);

      logger.info(`Successfully returned from sendPaymentConfirmationEmail for ${to}`);
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
          p.status IN ('completed', 'success') AND
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

  /**
   * Complete a product order after successful payment
   * @private
   */
  static async _completeProductOrder(client, payment) {
    try {
      const { metadata = {} } = payment;
      const orderId = metadata.order_id; // Using order_id from metadata since invoice_id can be same/different

      if (!orderId) {
        logger.warn(`No order_id found in metadata for payment ${payment.id}, cannot complete product order`);
        return { success: false, error: 'No order_id found' };
      }

      logger.info(`Completing product order ${orderId} for payment ${payment.id}`);

      // 1. Get the current order status and details for notification
      const orderResult = await client.query(
        `SELECT po.*, s.phone as seller_phone, s.location as seller_location, s.city as seller_city
         FROM product_orders po
         JOIN sellers s ON po.seller_id = s.id
         WHERE po.id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        logger.error(`Order ${orderId} not found`);
        return { success: false, error: 'Order not found' };
      }

      const order = orderResult.rows[0];

      // 2. Determine new status based on product type
      // - Digital/Services -> COMPLETED or CONFIRMED
      // - Physical -> DELIVERY_PENDING

      let newStatus = 'CONFIRMED'; // Default for services/others

      // Check metadata for product type if available
      let productType = order.product_type || metadata.product_type || metadata.metadata?.product_type;
      let isDigital = order.is_digital || metadata.is_digital || metadata.metadata?.is_digital;

      // Fallback: Check order metadata items if product type is missing
      // This is crucial because product_orders table doesn't have a product_type column
      if (!productType && order.metadata) {
        try {
          const orderMetadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata;

          if (orderMetadata.items && Array.isArray(orderMetadata.items) && orderMetadata.items.length > 0) {
            const items = orderMetadata.items;
            const hasPhysical = items.some(item => item.productType === 'physical' || (!item.productType && !item.isDigital));
            const hasService = items.some(item => item.productType === 'service');
            const hasDigital = items.some(item => item.productType === 'digital' || item.isDigital);

            // Prioritize status based on content
            if (hasService && !hasPhysical) {
              productType = 'service';
            } else if (hasDigital && !hasService && !hasPhysical) {
              productType = 'digital';
              isDigital = true;
            } else {
              productType = 'physical';
            }
          }
        } catch (e) {
          logger.warn(`Failed to parse order metadata for order ${orderId}:`, e);
        }
      }

      // Default to physical if still not determined
      if (!productType) productType = 'physical';

      if (isDigital) {
        newStatus = 'COMPLETED';
      } else if (productType === 'service') {
        newStatus = 'CONFIRMED'; // Ready for service delivery
      } else {
        newStatus = 'DELIVERY_PENDING'; // Physical goods need shipping
      }

      logger.info(`Updating order ${orderId} status from ${order.status} to ${newStatus}`);

      // 3. Update Order Status
      await client.query(
        `UPDATE product_orders 
         SET status = $1, 
             payment_status = 'completed', 
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [newStatus, orderId]
      );

      // 4. Update Payment Status to completed
      await client.query(
        `UPDATE payments 
         SET status = 'completed',
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb), 
               '{order_completed_at}', 
               to_jsonb(NOW())
             )
         WHERE id = $1`,
        [payment.id]
      );

      logger.info(`Successfully completed product order ${orderId}`);

      // 5. Send WhatsApp Notifications
      // We wrap this in a try-catch so it doesn't fail the transaction if notifications fail
      try {
        // Fetch items if they aren't in the order row (they likely aren't selected above)
        // We'll trust the metadata.items if available, or query them
        let items = metadata.items;
        if (!items || items.length === 0) {
          const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
          items = itemsResult.rows.map(item => ({
            ...item,
            name: item.product_name,
            price: item.product_price
          }));
        }

        const notificationData = {
          seller: {
            phone: order.seller_phone,
            location: order.seller_location,
            city: order.seller_city
          },
          buyer: {
            phone: order.buyer_phone, // Directly from order table
            full_name: order.buyer_name
          },
          order: {
            ...order,
            orderNumber: order.order_number, // Ensure consistent naming
            totalAmount: order.total_amount,
            metadata: {
              ...order.metadata,
              ...metadata // Merge payment metadata for extra context
            }
          },
          items: items || []
        };

        logger.info(`Sending WhatsApp notifications for Order ${orderId}...`);

        // Notify Seller
        await whatsappService.notifySellerNewOrder(notificationData);

        // Notify Buyer
        await whatsappService.notifyBuyerOrderConfirmation(notificationData);

        // Notify Logistics (if physical)
        await whatsappService.sendLogisticsNotification(notificationData.order, notificationData.buyer, notificationData.seller);

        logger.info(`WhatsApp notifications sent for Order ${orderId}`);

      } catch (notifyError) {
        logger.error(`Failed to send WhatsApp notifications for Order ${orderId}:`, notifyError);
        // Do not re-throw, we want the payment to remain successful
      }

      return {
        success: true,
        isProductPayment: true,
        orderId,
        newStatus
      };

    } catch (error) {
      logger.error('Error completing product order:', error);
      throw error;
    }
  }
}

export default PaymentCompletionService;
