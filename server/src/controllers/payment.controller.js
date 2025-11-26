import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import PaymentCompletionService from '../services/paymentCompletion.service.js';
import { v4 as uuidv4 } from 'uuid';
import PromoCode from '../models/promoCode.model.js';
import sseService from '../services/sse.service.js';


class PaymentController {
  formatPhoneNumber = (phone) => {
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
  };

  // Initiate payment for a product purchase (no event/ticket required)
  initiateProductPayment = async (req, res) => {
    const client = await pool.connect();
    try {
      logger.info('Product payment initiation request:', { body: req.body });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('Validation errors (product):', { errors: errors.array() });
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        phone,
        email,
        amount,
        productId,
        productName,
        sellerId,
        customerName,
        narrative,
        paymentMethod = 'mpesa'
      } = req.body;

      // Basic missing fields safety (validators already cover required ones)
      const missing = [];
      if (!phone) missing.push('phone');
      if (!email) missing.push('email');
      if (!amount) missing.push('amount');
      if (!productId) missing.push('productId');
      if (missing.length) {
        return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
      }

      await client.query('BEGIN');

      try {
        const formattedPhone = this.formatPhoneNumber(phone);
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const invoiceId = `INV-PROD-${timestamp}-${randomNum}`;

        // Prepare metadata for reconciliation
        const metadata = {
          kind: 'product',
          product_id: productId,
          product_name: productName,
          seller_id: sellerId,
          customer_name: customerName,
          narrative: narrative || (productName ? `Payment for ${productName}` : 'Product payment'),
          payment_method: paymentMethod,
          timestamp: new Date().toISOString()
        };

        // Insert product transaction row
        const insertTx = await client.query(
          `INSERT INTO product_transactions (
             invoice_id, product_id, seller_id, buyer_email, buyer_phone, buyer_name,
             amount, currency, status, payment_method, metadata
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)
           RETURNING *`,
          [
            invoiceId,
            String(productId),
            sellerId ? String(sellerId) : null,
            email,
            formattedPhone,
            customerName || null,
            amount,
            'KES',
            paymentMethod,
            JSON.stringify(metadata)
          ]
        );

        let productTx = insertTx.rows[0];

        // Trigger provider payment (IntaSend)
        const paymentResponse = await paymentService.initiateMpesaPayment({
          amount: amount,
          phone: formattedPhone,
          email: email,
          invoice_id: invoiceId,
          firstName: customerName?.split(' ')[0] || 'Customer',
          lastName: customerName?.split(' ').slice(1).join(' ') || '',
          narrative: metadata.narrative
        });

        if (paymentResponse) {
          const apiRef = paymentResponse.invoice_id || invoiceId;
          await client.query(
            `UPDATE product_transactions
             SET provider_reference = $1, api_ref = $2, updated_at = NOW()
             WHERE id = $3`,
            [paymentResponse.reference || null, apiRef, productTx.id]
          );
          const refetched = await client.query('SELECT * FROM product_transactions WHERE id = $1', [productTx.id]);
          productTx = refetched.rows[0];
        }

        await client.query('COMMIT');
        return res.status(200).json({
          success: true,
          message: 'Product payment initiated successfully',
          data: {
            transaction: {
              id: productTx.id,
              invoiceId: productTx.invoice_id,
              amount: productTx.amount,
              status: productTx.status,
              productId: productTx.product_id,
              sellerId: productTx.seller_id
            },
            payment_provider_response: paymentResponse,
            invoiceId: productTx.invoice_id
          }
        });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Error initiating product payment:', { message: err.message, stack: err.stack });
        return res.status(400).json({ success: false, message: err.message || 'Failed to initiate product payment' });
      }
    } finally {
      client.release();
    }
  };

  initiatePayment = async (req, res) => {
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

      const { phone, email, amount, ticketId, eventId, customerName, narrative, paymentMethod = 'mpesa', promoCode, quantity = 1 } = req.body;
      
      // Handle both ticketId and ticketTypeId for backward compatibility
      const ticketTypeId = ticketId;
      
      if (!ticketTypeId) {
        throw new Error('ticketId must be provided');
      }
      
      // Validate required fields
      const missingFields = [];
      if (!phone) missingFields.push('phone');
      if (!email) missingFields.push('email');
      if (!amount) missingFields.push('amount');
      if (!eventId) missingFields.push('eventId');
      if (!ticketTypeId) missingFields.push('ticketTypeId');
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      const userId = req.user?.id; // If using authentication
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Format and validate phone number
        const formattedPhone = this.formatPhoneNumber(phone);
        
        // Generate a unique invoice ID
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const invoiceId = `INV-${timestamp}-${randomNum}`;
        
        // First, get the event to get the organizer ID
        const eventResult = await client.query(
          'SELECT organizer_id FROM events WHERE id = $1',
          [eventId]
        );
        
        if (eventResult.rows.length === 0) {
          throw new Error(`Event with ID ${eventId} not found`);
        }
        
        const organizerId = eventResult.rows[0].organizer_id;
        
        if (!organizerId) {
          throw new Error(`No organizer found for event ${eventId}`);
        }
        
        // Get ticket type to calculate base price
        const ticketTypeResult = await client.query(
          'SELECT price FROM ticket_types WHERE id = $1',
          [ticketTypeId]
        );
        
        let baseTotalPrice = 0;
        if (ticketTypeResult.rows.length > 0) {
          const ticketPrice = parseFloat(ticketTypeResult.rows[0].price);
          const ticketQuantity = parseInt(quantity) || 1;
          baseTotalPrice = ticketPrice * ticketQuantity;
        } else {
          // Fallback: use the amount provided if ticket type not found
          baseTotalPrice = parseFloat(amount);
          logger.warn(`Ticket type ${ticketTypeId} not found, using provided amount as base price`);
        }
        
        // Validate and apply promo code if provided
        let promoCodeData = null;
        let discountAmount = 0;
        let finalAmount = baseTotalPrice;
        
        if (promoCode) {
          logger.info('Validating promo code in payment initiation:', { promoCode, eventId, baseTotalPrice });
          
          const validation = await PromoCode.validateForUse(eventId, promoCode.toUpperCase().trim(), baseTotalPrice);
          
          if (!validation.valid) {
            await client.query('ROLLBACK');
            throw new Error(validation.error || 'Invalid promo code');
          }
          
          promoCodeData = validation.promoCode;
          discountAmount = PromoCode.calculateDiscount(promoCodeData, baseTotalPrice);
          finalAmount = Math.max(0, baseTotalPrice - discountAmount);
          
          logger.info('Promo code applied:', {
            code: promoCodeData.code,
            discountType: promoCodeData.discount_type,
            discountValue: promoCodeData.discount_value,
            originalPrice: baseTotalPrice,
            discountAmount,
            finalAmount
          });
          
          // Verify that the provided amount matches the calculated discounted amount
          const providedAmount = parseFloat(amount);
          const amountDifference = Math.abs(providedAmount - finalAmount);
          
          // Allow small rounding differences (up to 0.01)
          if (amountDifference > 0.01) {
            logger.warn('Amount mismatch:', {
              providedAmount,
              calculatedAmount: finalAmount,
              difference: amountDifference
            });
            // Use the backend-calculated amount for security
            finalAmount = finalAmount;
            logger.info('Using backend-calculated discounted amount:', finalAmount);
          }
        } else {
          // No promo code - verify amount matches base price
          const providedAmount = parseFloat(amount);
          const amountDifference = Math.abs(providedAmount - baseTotalPrice);
          
          if (amountDifference > 0.01) {
            logger.warn('Amount mismatch (no promo code):', {
              providedAmount,
              baseTotalPrice,
              difference: amountDifference
            });
            // Use the backend-calculated amount
            finalAmount = baseTotalPrice;
          }
        }
        
        // Prepare metadata with all relevant information including promo code
        const metadata = {
          user_id: userId,
          customer_name: customerName,
          narrative: narrative || `Payment for event ${eventId}`,
          ticket_type_id: ticketTypeId, // Include ticket_type_id in metadata as backup
          event_id: eventId,
          organizer_id: organizerId,
          payment_method: paymentMethod,
          quantity: parseInt(quantity) || 1,
          base_total_price: baseTotalPrice,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          promo_code: promoCodeData ? {
            code: promoCodeData.code,
            discount_type: promoCodeData.discount_type,
            discount_value: promoCodeData.discount_value
          } : null,
          timestamp: new Date().toISOString()
        };

        // Insert the payment record with organizer_id using the calculated final amount
        const paymentResult = await client.query(
          `INSERT INTO payments (
            invoice_id, amount, currency, status, payment_method,
            phone_number, email, ticket_type_id, event_id, organizer_id, metadata,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING *`,
          [
            invoiceId,
            finalAmount, // Use the backend-calculated discounted amount
            'KES',
            'pending',
            paymentMethod,
            formattedPhone,
            email,
            ticketTypeId,
            eventId,
            organizerId,
            JSON.stringify(metadata)
          ]
        );
        
        let payment = paymentResult.rows[0];
        
        // Process payment with payment provider using the calculated final amount
        try {
          const paymentResponse = await paymentService.initiateMpesaPayment({
            amount: finalAmount, // Use the backend-calculated discounted amount
            phone: formattedPhone,
            email: email,
            invoice_id: invoiceId,
            firstName: customerName?.split(' ')[0] || 'Customer',
            lastName: customerName?.split(' ').slice(1).join(' ') || '',
            narrative: narrative || `Payment for event ${eventId}${promoCodeData ? ` (Promo: ${promoCodeData.code})` : ''}`
          });
          
          // Update payment with provider reference if available
          if (paymentResponse) {
            const apiRef = paymentResponse.invoice_id || invoiceId;
            
            await client.query(
              `UPDATE payments 
               SET provider_reference = $1, 
                   api_ref = $2,
                   updated_at = NOW() 
               WHERE id = $3`,
              [
                paymentResponse.reference || null,
                apiRef,
                payment.id
              ]
            );
            
            // Refresh payment data with the updated record
            const updatedPayment = await client.query(
              'SELECT * FROM payments WHERE id = $1',
              [payment.id]
            );
            payment = updatedPayment.rows[0];
          }
          
          // Commit the transaction
          await client.query('COMMIT');
          
          return res.status(200).json({
            success: true,
            message: 'Payment initiated successfully',
            data: {
              payment: {
                id: payment.id,
                invoiceId: payment.invoice_id,
                amount: payment.amount,
                status: payment.status,
                provider_reference: payment.provider_reference
              },
              payment_provider_response: paymentResponse,
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
  };

  formatPaymentResponse = (payment) => {
    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      ticketId: payment.ticket_id,
      eventId: payment.event_id,
      ticketTypeId: payment.ticket_type_id,
      userId: payment.user_id,
      providerReference: payment.provider_reference,
      invoiceId: payment.invoice_id,
      metadata: payment.metadata,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at
    };
  };

  checkStatus = async (req, res) => {
    const { paymentId } = req.params;
    let client;
    
    try {
      // Log all parameters for debugging
      logger.info('Checking payment status:', {
        paymentId,
        query: req.query,
        params: req.params,
        body: req.body
      });
      
      if (!paymentId) {
        throw new Error('No payment ID provided');
      }
      
      client = await pool.connect();
      logger.info('Database connection established');
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Try to find payment by invoice_id or id with FOR UPDATE to lock the row
        // First try to find by invoice_id (most common case)
        let query = `
          SELECT * FROM payments 
          WHERE invoice_id = $1 
          LIMIT 1
        `;
        
        logger.info('Executing query:', { query, params: [paymentId] });
        
        let result = await client.query(query, [paymentId]);
        
        // If not found by invoice_id, try by payment ID
        if (result.rows.length === 0) {
          query = `
            SELECT * FROM payments 
            WHERE id = $1 
            LIMIT 1
          `;
          logger.info('Trying to find by payment ID:', { query, params: [paymentId] });
          result = await client.query(query, [paymentId]);
        }
        
        if (result.rows.length === 0) {
          logger.warn(`Payment not found in payments for ID: ${paymentId}`);

          // Try product transactions by invoice_id
          const prodQuery = `SELECT * FROM product_transactions WHERE invoice_id = $1 LIMIT 1`;
          const prodRes = await client.query(prodQuery, [paymentId]);

          if (prodRes.rows.length > 0) {
            let prodTx = prodRes.rows[0];
            logger.info('Found product transaction for invoice:', { id: prodTx.id, status: prodTx.status });

            // If not terminal, query provider status and update
            const statusResp = await paymentService.checkPaymentStatus(paymentId);
            const mapped = this.mapPaymentStatus(statusResp.state || statusResp.status || 'pending');

            // Normalize to enum (no 'processing' in enum)
            const mappedEnum = (mapped === 'completed' || mapped === 'failed' || mapped === 'cancelled') ? mapped : 'pending';

            const providerRef = statusResp.mpesa_reference || prodTx.provider_reference;
            const metaUpdate = {
              last_status_check: new Date().toISOString(),
              provider_data: statusResp
            };

            await client.query(
              `UPDATE product_transactions
               SET status = $1,
                   provider_reference = COALESCE($2, provider_reference),
                   metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                   updated_at = NOW()
               WHERE id = $4`,
              [mappedEnum, providerRef || null, JSON.stringify(metaUpdate), prodTx.id]
            );

            // Commit and return
            await client.query('COMMIT');
            // If completed, also create order and mark product sold
            if (mappedEnum === "completed") {
              try {
                const txRowRes = await client.query('SELECT * FROM product_transactions WHERE invoice_id = $1', [paymentId]);
                const txRow = txRowRes.rows[0];
                if (txRow) {
                  const exists = await client.query('SELECT id FROM product_orders WHERE invoice_id = $1', [paymentId]);
                  if (exists.rows.length === 0) {
                    const productIdInt = isNaN(parseInt(txRow.product_id)) ? null : parseInt(txRow.product_id);
                    const sellerIdInt = isNaN(parseInt(txRow.seller_id)) ? null : parseInt(txRow.seller_id);
                    await client.query(`INSERT INTO product_orders (
                      transaction_id, invoice_id, product_id, seller_id, buyer_email, buyer_phone, buyer_name,
                      amount, currency, status, metadata
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid',$10)`,
                      [txRow.id, txRow.invoice_id, productIdInt, sellerIdInt, txRow.buyer_email, txRow.buyer_phone, txRow.buyer_name, txRow.amount, txRow.currency || 'KES', JSON.stringify({ source: 'status_poll' })]
                    );
                  }
                  const productIdInt2 = isNaN(parseInt(txRow.product_id)) ? null : parseInt(txRow.product_id);
                  if (productIdInt2) {
                    try {
                      await client.query(`UPDATE products SET status = 'sold', sold_at = COALESCE(sold_at, NOW()), updated_at = NOW() WHERE id = $1 AND status <> 'sold'`, [productIdInt2]);
                    } catch (e) { /* ignore */ }
                  }
                }
              } catch (e) {
                logger.error('Error creating product order during status poll:', { error: e.message, invoice: paymentId });
              }
            }
            return res.json({ success: true, status: mappedEnum, message: `Payment is ${mappedEnum}`, data: { invoice_id: paymentId } });
          }

          // Not found anywhere
          await client.query('COMMIT');
          return res.status(404).json({ success: false, status: 'not_found', message: 'Payment not found' });
        }
        
        const payment = result.rows[0];
        logger.info(`Found payment:`, { 
          id: payment.id, 
          invoiceId: payment.invoice_id,
          status: payment.status 
        });
        
        // If payment is already completed, just return the status
        if (['completed', 'failed', 'cancelled'].includes(payment.status)) {
          return res.json({
            success: true,
            status: payment.status,
            message: `Payment is already ${payment.status}`,
            data: this.formatPaymentResponse(payment)
          });
        }
        
        // If payment is pending and has a provider reference, check with provider
        if (payment.status === 'pending' && payment.provider_reference) {
          try {
            logger.info(`Checking payment status with provider for reference: ${payment.provider_reference}`);
            const statusCheck = await paymentService.checkPaymentStatus(
              payment.provider_reference || payment.invoice_id
            );
            
            const statusFromProvider = statusCheck.state || statusCheck.status;
            const mappedStatus = this.mapPaymentStatus(statusFromProvider);
            
            logger.info(`Provider status: ${statusFromProvider}, Mapped status: ${mappedStatus}`);
            
            // Update payment status if it has changed
            if (mappedStatus !== payment.status) {
              await client.query(
                'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2',
                [mappedStatus, payment.id]
              );
              
              logger.info(`Updated payment status to: ${mappedStatus}`);
              
              // Create ticket if payment is completed and no ticket exists
              if (mappedStatus === 'completed' && !payment.ticket_id) {
                logger.info('Creating ticket for completed payment');
                try {
                  await this.createTicketForPayment(client, { ...payment, status: mappedStatus });
                  logger.info('Successfully created ticket');
                } catch (ticketError) {
                  logger.error('Error creating ticket:', ticketError);
                  // Don't fail the whole request if ticket creation fails
                }
              }
              
              // Refresh payment data
              const updatedPayment = await client.query(
                'SELECT * FROM payments WHERE id = $1',
                [payment.id]
              );
              
              if (updatedPayment.rows.length > 0) {
                payment.status = mappedStatus;
                Object.assign(payment, updatedPayment.rows[0]);
              }
            }
            
          } catch (error) {
            logger.error('Error checking payment status with provider:', {
              error: error.message,
              stack: error.stack,
              paymentId: payment.id
            });
            // Continue with the existing status if provider check fails
          }
        }
        
        await client.query('COMMIT');
        
        // Format the response
        return res.json({
          success: true,
          status: payment.status,
          message: `Payment is ${payment.status}`,
          data: this.formatPaymentResponse(payment)
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      logger.error('Error in checkStatus:', {
        error: error.message,
        stack: error.stack,
        paymentId,
        query: error.query,
        parameters: error.parameters
      });
      
      // Check for database connection issues
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.error('Database connection error:', error);
        return res.status(503).json({
          success: false,
          status: 'error',
          message: 'Database connection error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      // Check for query errors
      if (error.code === '42P01') { // Table doesn't exist
        logger.error('Database table error:', error);
        return res.status(500).json({
          success: false,
          status: 'error',
          message: 'Database configuration error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to check payment status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
      
    } finally {
      if (client) {
        try {
          await client.release();
        } catch (releaseError) {
          logger.error('Error releasing database connection:', releaseError);
        }
      }
    }
  };
  
  createTicketForPayment = async (client, payment) => {
    try {
      // Log the incoming payment data for debugging
      logger.info('Creating ticket for payment:', {
        paymentId: payment.id,
        eventId: payment.event_id,
        ticketTypeId: payment.ticket_type_id,
        userId: payment.user_id,
        amount: payment.amount,
        currency: payment.currency,
        metadata: payment.metadata
      });

      // Define all required fields for ticket creation
      const requiredFields = [
        'event_id',
        'ticket_type_id',
        'amount',
        'currency',
        'id' // payment id
      ];
      
      // Check for missing required fields
      const missingFields = requiredFields.filter(field => {
        const value = payment[field];
        return value === undefined || value === null || value === '';
      });
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields for ticket creation: ${missingFields.join(', ')}`);
      }

      // Get ticket type details to ensure it exists and get additional info
      const ticketTypeResult = await client.query(
        `SELECT tt.*, e.organizer_id 
         FROM ticket_types tt
         JOIN events e ON tt.event_id = e.id
         WHERE tt.id = $1`,
        [payment.ticket_type_id]
      );

      if (ticketTypeResult.rows.length === 0) {
        throw new Error(`Ticket type not found: ${payment.ticket_type_id}`);
      }

      const ticketType = ticketTypeResult.rows[0];
      
      // Generate a unique ticket number
      const ticketNumber = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Get user details if available
      let userDetails = {};
      if (payment.user_id) {
        const userResult = await client.query(
          'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
          [payment.user_id]
        );
        if (userResult.rows.length > 0) {
          userDetails = userResult.rows[0];
        }
      }
      
      // Prepare ticket data
      const ticketData = {
        ticket_number: ticketNumber,
        ticket_type_id: payment.ticket_type_id,
        event_id: payment.event_id,
        user_id: payment.user_id || null,
        organizer_id: ticketType.organizer_id,
        status: 'confirmed',
        price: payment.amount,
        currency: payment.currency || 'KES',
        payment_id: payment.id,
        qr_code: `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        metadata: {
          ...(payment.metadata || {}),
          customer_name: payment.metadata?.customer_name || `${userDetails.first_name || ''} ${userDetails.last_name || ''}`.trim(),
          customer_email: payment.metadata?.customer_email || userDetails.email,
          ticket_type_name: ticketType.name,
          event_name: ticketType.event_name,
          purchase_date: new Date().toISOString()
        },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      logger.debug('Creating ticket with data:', ticketData);

      // Create the ticket
      const ticketResult = await client.query(
        `INSERT INTO tickets (
          ticket_number, ticket_type_id, event_id, user_id, organizer_id, status, 
          price, currency, payment_id, qr_code, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          ticketData.ticket_number,
          ticketData.ticket_type_id,
          ticketData.event_id,
          ticketData.user_id,
          ticketData.organizer_id,
          ticketData.status,
          ticketData.price,
          ticketData.currency,
          ticketData.payment_id,
          ticketData.qr_code,
          JSON.stringify(ticketData.metadata),
          ticketData.created_at,
          ticketData.updated_at
        ]
      );
      
      if (ticketResult.rows.length === 0) {
        throw new Error('Failed to create ticket: No data returned from insert');
      }
      
      const ticket = ticketResult.rows[0];
      
      // Update payment with ticket ID
      await client.query(
        'UPDATE payments SET ticket_id = $1, updated_at = NOW() WHERE id = $2',
        [ticket.id, payment.id]
      );
      
      logger.info('Successfully created ticket:', {
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        paymentId: payment.id,
        eventId: ticket.event_id,
        ticketTypeId: ticket.ticket_type_id
      });
      
      return ticket;
      
    } catch (error) {
      const errorDetails = {
        error: error.message,
        paymentId: payment?.id,
        eventId: payment?.event_id,
        ticketTypeId: payment?.ticket_type_id,
        paymentData: {
          id: payment?.id,
          event_id: payment?.event_id,
          ticket_type_id: payment?.ticket_type_id,
          user_id: payment?.user_id,
          amount: payment?.amount,
          currency: payment?.currency,
          status: payment?.status
        },
        stack: error.stack
      };
      
      logger.error('Error in createTicketForPayment:', errorDetails);
      
      // Rethrow with more context
      const enhancedError = new Error(`Failed to create ticket: ${error.message}`);
      enhancedError.details = errorDetails;
      throw enhancedError;
    }
  };

  handleWebhook = async (req, res) => {
    const client = await pool.connect();
    
    try {
      const webhookData = req.body;
      logger.info('Received payment webhook:', JSON.stringify(webhookData, null, 2));
  
      // Extract relevant data from webhook - handle different provider formats
      // IntaSend webhook structure: invoice_id (their ID), api_ref (our invoice ID), state (COMPLETE/PROCESSING/FAILED)
      const { 
        invoice_id,           // IntaSend's internal invoice ID
        state,                // IntaSend state: COMPLETE, PROCESSING, FAILED
        status,               // Some providers use 'status' instead of 'state'
        api_ref,              // Our invoice ID (this is what we use to find the payment)
        mpesa_reference,
        amount,
        currency,
        account,
        failed_reason,        // Reason for failure if state is FAILED
        failed_code,          // Error code if state is FAILED
        failed_code_link,     // Link to error documentation
        invoice_id: invoiceIdAlias, // Handle case where it might be invoiceId
        api_ref: apiRefAlias,       // Handle case where it might be apiRef
        transaction_id,
        payment_id,
        reference,
        // Handle nested data structures
        data: nestedData = {},
        body: requestBody = {}
      } = webhookData;
      
      // Merge all possible data sources with priority: direct props > body > data
      const mergedData = {
        ...nestedData,
        ...requestBody,
        ...webhookData
      };
      
      // Get the effective status/state with fallback
      const effectiveState = state || status || mergedData.state || mergedData.status || 'UNKNOWN';
      
      // Log the raw state/status for debugging
      logger.info('Processing webhook with status:', {
        state,
        status,
        effectiveState,
        webhookData: Object.keys(webhookData)
      });

      // Use the most specific value available for invoice ID and API reference
      // Note: IntaSend uses 'invoice_id' for their ID and 'api_ref' for our invoice ID
      // We should prioritize 'api_ref' since that's our invoice ID
      const effectiveApiRef = api_ref || apiRefAlias || mergedData.api_ref || mergedData.apiRef || reference || transaction_id || payment_id || '';
      const effectiveInvoiceId = invoice_id || invoiceIdAlias || mergedData.invoice_id || mergedData.invoiceId || effectiveApiRef || '';
      
      // First, attempt to match a product transaction directly by invoice id
      if (effectiveInvoiceId) {
        try {
          const prodRes = await client.query(
            'SELECT * FROM product_transactions WHERE invoice_id = $1 FOR UPDATE',
            [effectiveInvoiceId]
          );
          if (prodRes.rows.length > 0) {
            const prodTx = prodRes.rows[0];
            const mapped = this.mapPaymentStatus(effectiveState);
            const mappedEnum = (mapped === 'completed' || mapped === 'failed' || mapped === 'cancelled') ? mapped : 'pending';

            const providerRef = mpesa_reference || reference || transaction_id || prodTx.provider_reference;
            const metaUpdate = {
              webhook: webhookData,
              last_webhook_status: effectiveState,
              last_webhook_received: new Date().toISOString()
            };

            await client.query(
              `UPDATE product_transactions
               SET status = $1,
                   provider_reference = COALESCE($2, provider_reference),
                   metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                   updated_at = NOW()
               WHERE id = $4`,
              [mappedEnum, providerRef || null, JSON.stringify(metaUpdate), prodTx.id]
            );

            // On completed payment, create order and mark product sold
            if (mappedEnum === 'completed') {
              // Create order if it doesn't exist
              const orderExists = await client.query(
                'SELECT id FROM product_orders WHERE invoice_id = $1',
                [effectiveInvoiceId]
              );
              if (orderExists.rows.length === 0) {
                const productIdInt = isNaN(parseInt(prodTx.product_id)) ? null : parseInt(prodTx.product_id);
                const sellerIdInt = isNaN(parseInt(prodTx.seller_id)) ? null : parseInt(prodTx.seller_id);
                await client.query(
                  `INSERT INTO product_orders (
                    transaction_id, invoice_id, product_id, seller_id, buyer_email, buyer_phone, buyer_name,
                    amount, currency, status, metadata
                   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid',$10)`,
                  [
                    prodTx.id,
                    prodTx.invoice_id,
                    productIdInt,
                    sellerIdInt,
                    prodTx.buyer_email,
                    prodTx.buyer_phone,
                    prodTx.buyer_name,
                    prodTx.amount,
                    prodTx.currency || 'KES',
                    JSON.stringify({ source: 'webhook' })
                  ]
                );
              }

              // Mark product as sold (best effort)
              const productIdInt = isNaN(parseInt(prodTx.product_id)) ? null : parseInt(prodTx.product_id);
              if (productIdInt) {
                try {
                  await client.query(
                    `UPDATE products
                     SET status = 'sold', sold_at = COALESCE(sold_at, NOW()), updated_at = NOW()
                     WHERE id = $1 AND status <> 'sold'`,
                    [productIdInt]
                  );
                } catch (e) {
                  logger.error('Failed to mark product as sold:', { error: e.message, productId: productIdInt });
                }
              }
            }

            await client.query('COMMIT');
            return res.json({ success: true, message: 'Product transaction updated from webhook', invoice_id: effectiveInvoiceId, status: mappedEnum });
          }
        } catch (e) {
          logger.error('Error processing product transaction webhook path:', { error: e.message });
          // Continue to payment path
        }
      }

      // Start transaction early to ensure all queries are within it
      await client.query('BEGIN');
      
      try {
        // Try to find payment by multiple identifiers
        // Priority: api_ref (our invoice ID) > invoice_id (IntaSend's ID) > other references
        const searchValues = [
          effectiveApiRef,         // Try API reference first (our invoice ID - this is what we store)
          effectiveInvoiceId,      // Then IntaSend invoice ID
          mergedData.reference,    // Then generic reference
          mergedData.transaction_id,// Then transaction ID
          mergedData.payment_id    // Then payment ID
        ].filter(Boolean); // Remove any empty values
        
        // Log the search parameters
        logger.info('Searching for payment with identifiers:', { 
          effectiveInvoiceId,
          effectiveApiRef,
          reference: mergedData.reference,
          transaction_id: mergedData.transaction_id,
          payment_id: mergedData.payment_id,
          searchValues
        });

        // Find payment by invoice_id or api_ref using ILIKE for case-insensitive matching
        // Include ticket_type_id and metadata explicitly
        const queryText = `
          SELECT p.*, 
                 p.ticket_type_id as ticket_type_id,
                 p.metadata as payment_metadata
          FROM payments p
          WHERE 
            (p.invoice_id = $1 OR p.invoice_id = $2 OR 
             p.api_ref = $1 OR p.api_ref = $2 OR
             p.invoice_id ILIKE $1 OR p.invoice_id ILIKE $2 OR
             p.api_ref ILIKE $1 OR p.api_ref ILIKE $2)
          ORDER BY p.created_at DESC
          LIMIT 1
          FOR UPDATE
        `;

        const result = await client.query(queryText, searchValues);

        if (result.rows.length === 0) {
          // Try one more time with just the numeric part of the invoice ID
          const numericInvoiceId = effectiveInvoiceId.replace(/[^0-9]/g, '');
          const numericApiRef = effectiveApiRef.replace(/[^0-9]/g, '');
          
          if (numericInvoiceId || numericApiRef) {
            const retryResult = await client.query(
              `SELECT p.*, 
                      p.ticket_type_id as ticket_type_id,
                      p.metadata as payment_metadata
               FROM payments p
               WHERE 
                 (p.invoice_id ~ $1 OR p.api_ref ~ $1 OR 
                  p.invoice_id ~ $2 OR p.api_ref ~ $2)
               ORDER BY p.created_at DESC
               LIMIT 1 
               FOR UPDATE`,
              [numericInvoiceId, numericApiRef]
            );

            if (retryResult.rows.length > 0) {
              result.rows = retryResult.rows;
            }
          }
        }

        if (result.rows.length === 0) {
          // Log all recent payments to help with debugging
          const recentPayments = await client.query(
            `SELECT id, invoice_id, api_ref, status, created_at, provider_reference 
             FROM payments 
             WHERE created_at > NOW() - INTERVAL '1 hour'
             ORDER BY created_at DESC 
             LIMIT 10`
          );
          
          await client.query('ROLLBACK');
          
          logger.warn('Payment not found for webhook. Recent payments:', JSON.stringify({
            invoice_id: effectiveInvoiceId,
            api_ref: effectiveApiRef,
            search_values: searchValues,
            recent_payments: recentPayments.rows
          }, null, 2));
          
          return res.status(404).json({ 
            success: false, 
            message: 'Payment not found',
            searched_values: {
              invoice_id: effectiveInvoiceId,
              api_ref: effectiveApiRef
            },
            recent_payments: recentPayments.rows
          });
        }

        const payment = result.rows[0];
        
        // Map the status using the effective state we determined earlier
        const mappedStatus = this.mapPaymentStatus(effectiveState);
        
        // Log the status mapping for debugging
        logger.info('Processing payment status update:', {
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          currentStatus: payment.status,
          newStatus: mappedStatus,
          providerStatus: effectiveState,
          hasTicket: !!payment.ticket_id,
          rawState: state,
          rawStatus: status
        });

        // Always update payment to record webhook receipt, even if status hasn't changed
        // This ensures we have a record of all webhook events
        logger.info(`Updating payment ${payment.id} from webhook - Status: '${payment.status}' -> '${mappedStatus}'`);

        try {
          // Update payment status with additional logging
          const updateQuery = `
            UPDATE payments 
            SET status = $1, 
                updated_at = NOW(),
                provider_reference = COALESCE($2, provider_reference),
                metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
            WHERE id = $4
            RETURNING *
          `;
          
          // Build metadata update with webhook information and history
          const existingMetadata = payment.metadata || {};
          const webhookHistory = existingMetadata.webhook_history || [];
          webhookHistory.push({
            received_at: new Date().toISOString(),
            status: effectiveState,
            mapped_status: mappedStatus,
            provider_reference: mpesa_reference || mergedData.reference || mergedData.transaction_id,
            failed_reason: failed_reason || null,
            failed_code: failed_code || null,
            full_payload: webhookData
          });
          
          const metadataUpdate = {
            ...existingMetadata,
            last_webhook_status: effectiveState,
            last_webhook_received: new Date().toISOString(),
            webhook_history: webhookHistory.slice(-10), // Keep last 10 webhooks for audit trail
            provider_data: {
              state,
              status,
              reference: mergedData.reference,
              transaction_id: mergedData.transaction_id,
              mpesa_reference: mpesa_reference,
              failed_reason: failed_reason || null,
              failed_code: failed_code || null,
              failed_code_link: failed_code_link || null
            }
          };
          
          const updateParams = [
            mappedStatus,
            mpesa_reference || payment.provider_reference || mergedData.transaction_id || mergedData.reference,
            JSON.stringify(metadataUpdate),
            payment.id
          ];
          
          logger.debug('Executing payment status update query:', { 
            query: updateQuery, 
            params: updateParams,
            paymentId: payment.id,
            currentStatus: payment.status,
            newStatus: mappedStatus
          });
          
          try {
            const updateResult = await client.query(updateQuery, updateParams);
            
            if (updateResult.rows.length === 0) {
              throw new Error('Failed to update payment status - no rows affected');
            }
            
            const updatedPayment = updateResult.rows[0];
            
            // Update local payment object with latest data from database
            Object.assign(payment, updatedPayment);
            
            logger.info(`Payment ${payment.id} updated successfully from webhook:`, {
              paymentId: payment.id,
              oldStatus: payment.status,
              newStatus: updatedPayment.status,
              updatedAt: updatedPayment.updated_at,
              providerReference: updatedPayment.provider_reference,
              statusChanged: payment.status !== updatedPayment.status
            });
            
          } catch (updateError) {
            logger.error('Error executing payment status update query:', {
              error: updateError.message,
              stack: updateError.stack,
              query: updateQuery,
              params: updateParams,
              paymentId: payment.id
            });
            throw updateError;
          }

          // Create ticket if payment is completed (check for both 'complete' and 'completed')
          if (mappedStatus === 'completed') {
            if (payment.ticket_id) {
              logger.info(`Payment ${payment.id} already has ticket ${payment.ticket_id}, skipping ticket creation`);
            } else {
              logger.info(`Creating ticket for completed payment ${payment.id}`);
              try {
                // Ensure we have all required fields for ticket creation
                const ticketData = {
                  ...payment,
                  status: mappedStatus,
                  // Ensure we have required fields with fallbacks
                  event_id: payment.event_id || (payment.metadata?.event_id ? parseInt(payment.metadata.event_id) : null),
                  ticket_type_id: payment.ticket_type_id || (payment.metadata?.ticket_type_id ? parseInt(payment.metadata.ticket_type_id) : null),
                  amount: payment.amount || (payment.metadata?.amount ? parseFloat(payment.metadata.amount) : 0),
                  currency: payment.currency || (payment.metadata?.currency || 'KES')
                };
                
                // Validate required fields
                if (!ticketData.ticket_type_id) {
                  throw new Error('Payment is missing ticket_type_id. Cannot create ticket.');
                }
                
                if (!ticketData.event_id) {
                  throw new Error('Payment is missing event_id. Cannot create ticket.');
                }
                
                logger.debug('Creating ticket with data:', ticketData);
                
                await this.createTicketForPayment(client, ticketData);
                
                // Refresh payment data to get the updated ticket_id
                const refreshedPayment = await client.query(
                  'SELECT * FROM payments WHERE id = $1',
                  [payment.id]
                );
                
                if (refreshedPayment.rows.length > 0) {
                  Object.assign(payment, refreshedPayment.rows[0]);
                  logger.info(`Successfully created ticket ${payment.ticket_id} for payment ${payment.id}`);
                } else {
                  logger.warn(`Could not refresh payment data after ticket creation for payment ${payment.id}`);
                }
              } catch (ticketError) {
                // Log the error with more context
                const errorMessage = ticketError.message || 'Unknown error creating ticket';
                const isMissingData = errorMessage.includes('missing') || errorMessage.includes('required');
                
                logger.error(`Error creating ticket for payment ${payment.id}:`, {
                  error: errorMessage,
                  stack: ticketError.stack,
                  paymentId: payment.id,
                  paymentStatus: payment.status,
                  mappedStatus,
                  isMissingData,
                  paymentData: {
                    hasTicketTypeId: !!payment.ticket_type_id,
                    hasEventId: !!payment.event_id,
                    metadataKeys: payment.metadata ? Object.keys(payment.metadata) : []
                  }
                });
                
                // Update payment with detailed error information
                const errorMetadata = {
                  ticket_creation_error: errorMessage,
                  ticket_creation_attempted_at: new Date().toISOString(),
                  missing_fields: {
                    ticket_type_id: !payment.ticket_type_id,
                    event_id: !payment.event_id
                  },
                  metadata: payment.metadata || {}
                };
                
                await client.query(
                  'UPDATE payments SET metadata = COALESCE(metadata, \'{}\'::jsonb) || $1::jsonb WHERE id = $2',
                  [JSON.stringify(errorMetadata), payment.id]
                );
                
                // If this is a data validation error, don't retry
                if (isMissingData) {
                  logger.warn(`Payment ${payment.id} has missing data, marking as failed: ${errorMessage}`);
                  await client.query(
                    'UPDATE payments SET status = \'failed\', updated_at = NOW() WHERE id = $1',
                    [payment.id]
                  );
                }
              }
            }
          }

          // Refresh payment data after all updates
          const refreshedPayment = await client.query(
            'SELECT * FROM payments WHERE id = $1',
            [payment.id]
          );
          
          if (refreshedPayment.rows.length > 0) {
            Object.assign(payment, refreshedPayment.rows[0]);
          }

          await client.query('COMMIT');
          logger.info(`Successfully committed transaction for payment ${payment.id}`);

          // Broadcast payment status update to connected SSE clients
          const invoiceId = payment.invoice_id;
          if (invoiceId) {
            // Extract failure details from webhook if payment failed or cancelled
            const failureDetails = (mappedStatus === 'failed' || mappedStatus === 'cancelled') ? {
              failed_reason: failed_reason || mergedData.failed_reason || null,
              failed_code: failed_code || mergedData.failed_code || null,
              failed_code_link: failed_code_link || mergedData.failed_code_link || null
            } : null;

            sseService.broadcast(invoiceId, {
              type: 'payment_status_update',
              invoiceId: invoiceId,
              status: mappedStatus,
              payment: this.formatPaymentResponse(payment),
              failureDetails: failureDetails,
              timestamp: new Date().toISOString()
            });
            logger.info(`SSE: Broadcasted payment status update for invoice ${invoiceId} to ${sseService.getConnectionCount(invoiceId)} client(s)`);
          }

        } catch (error) {
          await client.query('ROLLBACK');
          logger.error('Error updating payment from webhook:', {
            error: error.message,
            paymentId: payment.id,
            stack: error.stack
          });
          throw error;
        }
        
        return res.json({ 
          success: true, 
          message: 'Webhook processed successfully',
          payment: this.formatPaymentResponse(payment)
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error in payment webhook transaction:', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }

    } catch (error) {
      logger.error('Error in payment webhook handler:', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      return res.status(500).json({ 
        success: false, 
        message: 'Error processing webhook',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  };

  mapPaymentStatus = (providerStatus) => {
    // First normalize the status by converting to uppercase and trimming whitespace
    // IntaSend uses uppercase states: COMPLETE, PROCESSING, FAILED
    const normalizedStatus = String(providerStatus || '').trim().toUpperCase();
    
    // Log the mapping for debugging
    logger.debug('Mapping payment status:', { providerStatus, normalizedStatus });
    
    // Map IntaSend states to internal statuses
    if (normalizedStatus === 'COMPLETE' || normalizedStatus === 'COMPLETED') {
      return 'completed';
    }
    
    if (normalizedStatus === 'PROCESSING' || normalizedStatus === 'IN_PROGRESS') {
      return 'processing';
    }
    
    if (normalizedStatus === 'FAILED' || normalizedStatus === 'FAILURE') {
      return 'failed';
    }
    
    // Also handle lowercase variants for backward compatibility
    const lowerStatus = normalizedStatus.toLowerCase();
    if (lowerStatus === 'complete' || lowerStatus === 'completed') {
      return 'completed';
    }
    
    if (lowerStatus === 'processing' || lowerStatus === 'in_progress') {
      return 'processing';
    }
    
    if (lowerStatus === 'failed' || lowerStatus === 'failure') {
      return 'failed';
    }
    
    // Default to 'pending' for all other cases
    return 'pending';
  };
}

export default new PaymentController();

