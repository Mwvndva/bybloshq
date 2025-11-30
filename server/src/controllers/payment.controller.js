import { validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import paystackService from '../services/paystack.service.js';
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
      console.log('Product payment initiation request:', { body: req.body });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors (product):', { errors: errors.array() });
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
        console.error('Error initiating product payment:', { message: err.message, stack: err.stack });
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
      console.log('[PAYMENT INITIATION] Step 0: Payment initiation request received', { 
        body: {
          phone: req.body.phone || 'NOT SET',
          email: req.body.email || 'NOT SET',
          amount: req.body.amount || 'NOT SET',
          ticketId: req.body.ticketId || 'NOT SET',
          eventId: req.body.eventId || 'NOT SET',
          customerName: req.body.customerName || 'NOT SET',
          narrative: req.body.narrative || 'NOT SET',
          paymentMethod: req.body.paymentMethod || 'NOT SET',
          promoCode: req.body.promoCode || 'NOT SET',
          quantity: req.body.quantity || 'NOT SET'
        },
        params: req.params,
        query: req.query,
        userId: req.user?.id || 'NOT SET'
      });

      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', { errors: errors.array() });
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { phone, email, amount, ticketId, eventId, customerName, narrative, paymentMethod = 'mpesa', promoCode, quantity = 1 } = req.body;
      
      console.log('[PAYMENT INITIATION] Step 0.5: Extracted request data', {
        phone: phone || 'NOT SET',
        email: email || 'NOT SET',
        amount: amount || 'NOT SET',
        amountType: typeof amount,
        ticketId: ticketId || 'NOT SET',
        eventId: eventId || 'NOT SET',
        customerName: customerName || 'NOT SET',
        narrative: narrative || 'NOT SET',
        paymentMethod: paymentMethod || 'mpesa',
        promoCode: promoCode || 'NOT SET',
        quantity: quantity || 1,
        quantityType: typeof quantity
      });
      
      // Handle both ticketId and ticketTypeId for backward compatibility
      const ticketTypeId = ticketId;
      
      if (!ticketTypeId) {
        console.error('[PAYMENT INITIATION] Step 0.5: Missing ticketId', { ticketId, ticketTypeId });
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
        console.error('[PAYMENT INITIATION] Step 0.5: Missing required fields', { missingFields });
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      const userId = req.user?.id; // If using authentication
      console.log('[PAYMENT INITIATION] Step 0.5: Validation passed', {
        hasUserId: !!userId,
        userId: userId || 'NOT SET',
        allFieldsPresent: true
      });
      
      // Start transaction
      console.log('[PAYMENT INITIATION] Step 1: Starting database transaction');
      await client.query('BEGIN');
      
      try {
        // Format and validate phone number
        console.log('[PAYMENT INITIATION] Step 2: Formatting phone number', { 
          phone: phone || 'NOT SET',
          phoneType: typeof phone,
          phoneLength: phone ? String(phone).length : 0
        });
        const formattedPhone = this.formatPhoneNumber(phone);
        console.log('[PAYMENT INITIATION] Step 2: Phone number formatted - Before/After', { 
          originalPhone: phone,
          formattedPhone: formattedPhone,
          changed: phone !== formattedPhone,
          formattedPhoneType: typeof formattedPhone,
          formattedPhoneLength: formattedPhone ? String(formattedPhone).length : 0
        });
        
        // Generate a unique invoice ID
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const invoiceId = `INV-${timestamp}-${randomNum}`;
        console.log('[PAYMENT INITIATION] Step 3: Generated invoice ID', { invoiceId, timestamp, randomNum });
        
        // First, get the event to get the organizer ID
        console.log('[PAYMENT INITIATION] Step 4: Looking up event', { 
          eventId: eventId || 'NOT SET',
          eventIdType: typeof eventId,
          eventIdLength: eventId ? String(eventId).length : 0
        });
        const eventResult = await client.query(
          'SELECT organizer_id FROM events WHERE id = $1',
          [eventId]
        );
        
        console.log('[PAYMENT INITIATION] Step 4: Event lookup result', {
          found: eventResult.rows.length > 0,
          count: eventResult.rows.length,
          eventId
        });
        
        if (eventResult.rows.length === 0) {
          console.error('[PAYMENT INITIATION] Step 4: Event not found', { 
            eventId,
            eventIdType: typeof eventId,
            searchedFor: eventId
          });
          throw new Error(`Event with ID ${eventId} not found`);
        }
        
        const organizerId = eventResult.rows[0].organizer_id;
        console.log('[PAYMENT INITIATION] Step 4: Event found - Full details', { 
          eventId,
          eventIdType: typeof eventId,
          organizerId: organizerId || 'NULL',
          organizerIdType: typeof organizerId,
          hasOrganizer: !!organizerId
        });
        
        if (!organizerId) {
          console.error('[PAYMENT INITIATION] Step 4: No organizer found for event', { 
            eventId,
            eventData: eventResult.rows[0]
          });
          throw new Error(`No organizer found for event ${eventId}`);
        }
        
        // Get ticket type to calculate base price
        console.log('[PAYMENT INITIATION] Step 5: Looking up ticket type', { 
          ticketTypeId: ticketTypeId || 'NOT SET',
          ticketTypeIdType: typeof ticketTypeId,
          quantity: quantity || 1,
          quantityType: typeof quantity,
          providedAmount: amount || 'NOT SET',
          providedAmountType: typeof amount
        });
        const ticketTypeResult = await client.query(
          'SELECT price FROM ticket_types WHERE id = $1',
          [ticketTypeId]
        );
        
        console.log('[PAYMENT INITIATION] Step 5: Ticket type lookup result', {
          found: ticketTypeResult.rows.length > 0,
          count: ticketTypeResult.rows.length,
          ticketTypeId,
          rawPrice: ticketTypeResult.rows[0]?.price || 'NOT FOUND'
        });
        
        let baseTotalPrice = 0;
        if (ticketTypeResult.rows.length > 0) {
          const ticketPrice = parseFloat(ticketTypeResult.rows[0].price);
          const ticketQuantity = parseInt(quantity) || 1;
          baseTotalPrice = ticketPrice * ticketQuantity;
          console.log('[PAYMENT INITIATION] Step 5: Ticket type found - Price calculation', { 
            ticketTypeId,
            ticketTypeIdType: typeof ticketTypeId,
            ticketPrice: ticketPrice,
            ticketPriceType: typeof ticketPrice,
            ticketQuantity: ticketQuantity,
            ticketQuantityType: typeof ticketQuantity,
            baseTotalPrice: baseTotalPrice,
            baseTotalPriceType: typeof baseTotalPrice,
            calculation: `${ticketPrice} * ${ticketQuantity} = ${baseTotalPrice}`,
            providedAmount: amount,
            amountMatch: Math.abs(parseFloat(amount) - baseTotalPrice) < 0.01
          });
        } else {
          // Fallback: use the amount provided if ticket type not found
          baseTotalPrice = parseFloat(amount);
          console.warn('[PAYMENT INITIATION] Step 5: Ticket type not found, using provided amount', { 
            ticketTypeId,
            baseTotalPrice: baseTotalPrice,
            baseTotalPriceType: typeof baseTotalPrice,
            providedAmount: amount,
            providedAmountType: typeof amount
          });
        }
        
        // Validate and apply promo code if provided
        let promoCodeData = null;
        let discountAmount = 0;
        let finalAmount = baseTotalPrice;
        
        if (promoCode) {
          console.log('[PAYMENT INITIATION] Step 6: Validating promo code', { 
            promoCode: promoCode || 'NOT SET',
            promoCodeType: typeof promoCode,
            promoCodeNormalized: promoCode ? promoCode.toUpperCase().trim() : 'NOT SET',
            eventId,
            baseTotalPrice,
            baseTotalPriceType: typeof baseTotalPrice
          });
          
          const validation = await PromoCode.validateForUse(eventId, promoCode.toUpperCase().trim(), baseTotalPrice);
          
          console.log('[PAYMENT INITIATION] Step 6: Promo code validation result', {
            valid: validation.valid,
            error: validation.error || 'NONE',
            promoCode: promoCode
          });
          
          if (!validation.valid) {
            await client.query('ROLLBACK');
            throw new Error(validation.error || 'Invalid promo code');
          }
          
          promoCodeData = validation.promoCode;
          discountAmount = PromoCode.calculateDiscount(promoCodeData, baseTotalPrice);
          finalAmount = Math.max(0, baseTotalPrice - discountAmount);
          
          console.log('[PAYMENT INITIATION] Step 6: Promo code applied - Discount calculation', {
            code: promoCodeData.code,
            discountType: promoCodeData.discount_type,
            discountValue: promoCodeData.discount_value,
            discountValueType: typeof promoCodeData.discount_value,
            originalPrice: baseTotalPrice,
            discountAmount: discountAmount,
            discountAmountType: typeof discountAmount,
            finalAmount: finalAmount,
            finalAmountType: typeof finalAmount,
            calculation: `${baseTotalPrice} - ${discountAmount} = ${finalAmount}`
          });
          
          // Verify that the provided amount matches the calculated discounted amount
          const providedAmount = parseFloat(amount);
          const amountDifference = Math.abs(providedAmount - finalAmount);
          
          console.log('[PAYMENT INITIATION] Step 6: Amount verification (with promo code)', {
            providedAmount: providedAmount,
            providedAmountType: typeof providedAmount,
            calculatedAmount: finalAmount,
            calculatedAmountType: typeof finalAmount,
            difference: amountDifference,
            differenceType: typeof amountDifference,
            withinTolerance: amountDifference <= 0.01,
            tolerance: 0.01
          });
          
          // Allow small rounding differences (up to 0.01)
          if (amountDifference > 0.01) {
            console.warn('[PAYMENT INITIATION] Step 6: Amount mismatch detected', {
              providedAmount,
              calculatedAmount: finalAmount,
              difference: amountDifference,
              willUseCalculated: true
            });
            // Use the backend-calculated amount for security
            finalAmount = finalAmount;
            console.log('[PAYMENT INITIATION] Step 6: Using backend-calculated discounted amount', { 
              finalAmount,
              finalAmountType: typeof finalAmount
            });
          }
        } else {
          console.log('[PAYMENT INITIATION] Step 6: No promo code provided', {
            promoCode: promoCode || 'NOT SET',
            willUseBasePrice: true
          });
          
          // No promo code - verify amount matches base price
          const providedAmount = parseFloat(amount);
          const amountDifference = Math.abs(providedAmount - baseTotalPrice);
          
          console.log('[PAYMENT INITIATION] Step 6: Amount verification (no promo code)', {
            providedAmount: providedAmount,
            providedAmountType: typeof providedAmount,
            baseTotalPrice: baseTotalPrice,
            baseTotalPriceType: typeof baseTotalPrice,
            difference: amountDifference,
            differenceType: typeof amountDifference,
            withinTolerance: amountDifference <= 0.01,
            tolerance: 0.01
          });
          
          if (amountDifference > 0.01) {
            console.warn('[PAYMENT INITIATION] Step 6: Amount mismatch (no promo code)', {
              providedAmount,
              baseTotalPrice,
              difference: amountDifference,
              willUseBasePrice: true
            });
            // Use the backend-calculated amount
            finalAmount = baseTotalPrice;
          }
        }
        
        console.log('[PAYMENT INITIATION] Step 6: Final amount determined', {
          finalAmount: finalAmount,
          finalAmountType: typeof finalAmount,
          baseTotalPrice: baseTotalPrice,
          discountAmount: discountAmount,
          hasPromoCode: !!promoCodeData,
          promoCode: promoCodeData?.code || 'NONE'
        });
        
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
        console.log('[PAYMENT INITIATION] Step 7: Creating payment record in database - Full data', {
          invoiceId: invoiceId,
          invoiceIdType: typeof invoiceId,
          invoiceIdLength: invoiceId.length,
          finalAmount: finalAmount,
          finalAmountType: typeof finalAmount,
          currency: 'KES',
          status: 'pending',
          paymentMethod: paymentMethod || 'mpesa',
          email: process.env.NODE_ENV === 'production' ? '[REDACTED]' : email,
          emailType: typeof email,
          phone: process.env.NODE_ENV === 'production' ? '[REDACTED]' : formattedPhone,
          phoneType: typeof formattedPhone,
          ticketTypeId: ticketTypeId,
          ticketTypeIdType: typeof ticketTypeId,
          eventId: eventId,
          eventIdType: typeof eventId,
          organizerId: organizerId,
          organizerIdType: typeof organizerId,
          customerName: customerName || 'NOT SET',
          quantity: parseInt(quantity) || 1,
          quantityType: typeof quantity,
          promoCode: promoCodeData ? promoCodeData.code : null,
          metadata: {
            keys: Object.keys(metadata),
            hasPromoCode: !!metadata.promo_code,
            quantity: metadata.quantity,
            baseTotalPrice: metadata.base_total_price,
            finalAmount: metadata.final_amount,
            invoice_id: metadata.invoice_id || 'NOT SET',
            event_id: metadata.event_id || 'NOT SET',
            ticket_type_id: metadata.ticket_type_id || 'NOT SET'
          },
          note: 'This invoice_id will be stored and used to match Paystack webhook reference - MUST MATCH EXACTLY'
        });
        
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
        console.log('[PAYMENT INITIATION] Step 7: Payment record created - Full payment data', {
          paymentId: payment.id,
          paymentIdType: typeof payment.id,
          invoiceId: payment.invoice_id || 'NULL',
          invoiceIdType: typeof payment.invoice_id,
          invoiceIdLength: payment.invoice_id ? String(payment.invoice_id).length : 0,
          apiRef: payment.api_ref || 'NULL',
          apiRefType: typeof payment.api_ref,
          providerReference: payment.provider_reference || 'NULL',
          providerReferenceType: typeof payment.provider_reference,
          amount: payment.amount,
          amountType: typeof payment.amount,
          currency: payment.currency,
          status: payment.status,
          email: payment.email,
          phoneNumber: payment.phone_number,
          ticketTypeId: payment.ticket_type_id,
          eventId: payment.event_id,
          organizerId: payment.organizer_id,
          paymentMethod: payment.payment_method,
          createdAt: payment.created_at,
          metadata: payment.metadata ? {
            keys: Object.keys(payment.metadata),
            invoice_id: payment.metadata.invoice_id || 'NOT SET',
            invoice_idType: typeof payment.metadata.invoice_id,
            event_id: payment.metadata.event_id || 'NOT SET',
            ticket_type_id: payment.metadata.ticket_type_id || 'NOT SET',
            hasPromoCode: !!payment.metadata.promo_code,
            quantity: payment.metadata.quantity,
            baseTotalPrice: payment.metadata.base_total_price,
            finalAmount: payment.metadata.final_amount
          } : null,
          matchingInfo: {
            invoiceIdMatchesGenerated: payment.invoice_id === invoiceId,
            note: 'payment.invoice_id MUST match Paystack webhook reference for successful lookup'
          }
        });
        
        // Process payment with Paystack using the calculated final amount
        try {
          // Construct callback URL
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const callbackUrl = `${frontendUrl}/payment/callback?invoice_id=${invoiceId}`;
          
          console.log('[PAYMENT INITIATION] Step 8: Initiating Paystack payment - Full request data', {
            invoiceId: invoiceId,
            invoiceIdType: typeof invoiceId,
            invoiceIdLength: invoiceId.length,
            email: process.env.NODE_ENV === 'production' ? '[REDACTED]' : email,
            amount: finalAmount,
            amountType: typeof finalAmount,
            amountInKobo: finalAmount * 100,
            reference: invoiceId,
            referenceType: typeof invoiceId,
            referenceLength: invoiceId.length,
            callbackUrl: callbackUrl,
            metadata: {
              invoice_id: invoiceId,
              invoice_idType: typeof invoiceId,
              event_id: eventId,
              ticket_type_id: ticketTypeId,
              customer_name: customerName,
              phone: formattedPhone,
              quantity: parseInt(quantity) || 1,
              promo_code: promoCodeData ? promoCodeData.code : null,
              narrative: narrative || `Payment for event ${eventId}${promoCodeData ? ` (Promo: ${promoCodeData.code})` : ''}`
            },
            criticalNote: 'reference MUST be exactly the same as invoice_id for webhook matching'
          });
          
          const paymentResponse = await paymentService.initiatePayment({
            email: email,
            amount: finalAmount, // Use the backend-calculated discounted amount
            reference: invoiceId, // Use invoice_id as Paystack reference
            callback_url: callbackUrl,
            metadata: {
              invoice_id: invoiceId,
              event_id: eventId,
              ticket_type_id: ticketTypeId,
              customer_name: customerName,
              phone: formattedPhone,
              quantity: parseInt(quantity) || 1,
              promo_code: promoCodeData ? promoCodeData.code : null,
              narrative: narrative || `Payment for event ${eventId}${promoCodeData ? ` (Promo: ${promoCodeData.code})` : ''}`
            }
          });
          
          console.log('[PAYMENT INITIATION] Step 8: Paystack payment initiated successfully - Full response', {
            invoiceId: invoiceId,
            invoiceIdType: typeof invoiceId,
            invoiceIdLength: invoiceId.length,
            accessCode: paymentResponse.access_code || 'NOT SET',
            authorizationUrl: paymentResponse.authorization_url || 'NOT SET',
            reference: paymentResponse.reference || 'NOT SET',
            referenceType: typeof paymentResponse.reference,
            referenceLength: paymentResponse.reference ? String(paymentResponse.reference).length : 0,
            matchingCheck: {
              invoiceIdMatchesPaystackRef: invoiceId === paymentResponse.reference,
              invoiceIdValue: invoiceId,
              paystackRefValue: paymentResponse.reference,
              exactMatch: invoiceId === paymentResponse.reference,
              stringComparison: String(invoiceId) === String(paymentResponse.reference || ''),
              note: 'CRITICAL: invoiceId and paymentResponse.reference MUST match for webhook lookup'
            }
          });
          
          // Update payment with provider reference (Paystack reference)
          if (paymentResponse) {
            console.log('[PAYMENT INITIATION] Step 9: Updating payment with Paystack reference', {
              paymentId: payment.id,
              reference: paymentResponse.reference || invoiceId,
              invoiceId
            });
            
            await client.query(
              `UPDATE payments 
               SET provider_reference = $1, 
                   api_ref = $2,
                   updated_at = NOW() 
               WHERE id = $3`,
              [
                paymentResponse.reference || invoiceId,
                invoiceId,
                payment.id
              ]
            );
            
            // Refresh payment data with the updated record
            const updatedPayment = await client.query(
              'SELECT * FROM payments WHERE id = $1',
              [payment.id]
            );
            payment = updatedPayment.rows[0];
            
            console.log('[PAYMENT INITIATION] Step 9: Payment updated with Paystack reference', {
              paymentId: payment.id,
              invoiceId: payment.invoice_id,
              providerReference: payment.provider_reference,
              apiRef: payment.api_ref
            });
          }
          
          // Commit the transaction
          console.log('[PAYMENT INITIATION] Step 10: Committing database transaction', { invoiceId });
          await client.query('COMMIT');
          console.log('[PAYMENT INITIATION] Step 10: Database transaction committed successfully', { invoiceId });
          
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
              access_code: paymentResponse.access_code,
              authorization_url: paymentResponse.authorization_url,
              reference: paymentResponse.reference,
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
          console.error('Error processing payment:', {
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
      console.error('Error initiating payment:', error);
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
      ticketId: payment.ticket_id, // First ticket for backward compatibility
      ticketIds: payment.metadata?.ticket_ids || (payment.ticket_id ? [payment.ticket_id] : []), // Array of all ticket IDs
      ticketCount: payment.metadata?.ticket_count || (payment.ticket_id ? 1 : 0), // Total number of tickets
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
      console.log('Checking payment status:', {
        paymentId,
        query: req.query,
        params: req.params,
        body: req.body
      });
      
      if (!paymentId) {
        throw new Error('No payment ID provided');
      }
      
      client = await pool.connect();
      console.log('Database connection established');
      
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
        
        console.log('Executing query:', { query, params: [paymentId] });
        
        let result = await client.query(query, [paymentId]);
        
        // If not found by invoice_id, try by payment ID
        if (result.rows.length === 0) {
          query = `
            SELECT * FROM payments 
            WHERE id = $1 
            LIMIT 1
          `;
          console.log('Trying to find by payment ID:', { query, params: [paymentId] });
          result = await client.query(query, [paymentId]);
        }
        
        if (result.rows.length === 0) {
          console.warn(`Payment not found in payments for ID: ${paymentId}`);

          // Try product transactions by invoice_id
          const prodQuery = `SELECT * FROM product_transactions WHERE invoice_id = $1 LIMIT 1`;
          const prodRes = await client.query(prodQuery, [paymentId]);

          if (prodRes.rows.length > 0) {
            let prodTx = prodRes.rows[0];
            console.log('Found product transaction for invoice:', { id: prodTx.id, status: prodTx.status });

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
                console.error('Error creating product order during status poll:', { error: e.message, invoice: paymentId });
              }
            }
            return res.json({ success: true, status: mappedEnum, message: `Payment is ${mappedEnum}`, data: { invoice_id: paymentId } });
          }

          // Not found anywhere
          await client.query('COMMIT');
          return res.status(404).json({ success: false, status: 'not_found', message: 'Payment not found' });
        }
        
        const payment = result.rows[0];
        console.log(`Found payment:`, { 
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
            console.log(`Checking payment status with provider for reference: ${payment.provider_reference}`);
            const statusCheck = await paymentService.checkPaymentStatus(
              payment.provider_reference || payment.invoice_id
            );
            
            const statusFromProvider = statusCheck.state || statusCheck.status;
            const mappedStatus = this.mapPaymentStatus(statusFromProvider);
            
            console.log(`Provider status: ${statusFromProvider}, Mapped status: ${mappedStatus}`);
            
            // Update payment status if it has changed
            if (mappedStatus !== payment.status) {
              await client.query(
                'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2',
                [mappedStatus, payment.id]
              );
              
              console.log(`Updated payment status to: ${mappedStatus}`);
              
              // Create tickets if payment is completed and no tickets exist
              const existingTicketIds = payment.metadata?.ticket_ids || [];
              const hasExistingTickets = payment.ticket_id || (existingTicketIds.length > 0);
              
              if (mappedStatus === 'completed' && !hasExistingTickets) {
                console.log('Creating tickets for completed payment');
                try {
                  const tickets = await this.createTicketForPayment(client, { ...payment, status: mappedStatus });
                  console.log(`Successfully created ${tickets.length} ticket(s)`);
                } catch (ticketError) {
                  console.error('Error creating tickets:', ticketError);
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
            console.error('Error checking payment status with provider:', {
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
      console.error('Error in checkStatus:', {
        error: error.message,
        stack: error.stack,
        paymentId,
        query: error.query,
        parameters: error.parameters
      });
      
      // Check for database connection issues
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.error('Database connection error:', error);
        return res.status(503).json({
          success: false,
          status: 'error',
          message: 'Database connection error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      // Check for query errors
      if (error.code === '42P01') { // Table doesn't exist
        console.error('Database table error:', error);
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
          console.error('Error releasing database connection:', releaseError);
        }
      }
    }
  };

  /**
   * Verify payment with Paystack after callback redirect
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  verifyPayment = async (req, res) => {
    const { reference } = req.params;
    const client = await pool.connect();
    
    try {
      console.log(`Verifying payment with reference: ${reference}`);
      
      // Verify with Paystack
      const verificationResult = await paystackService.verifyTransaction(reference);
      
      if (!verificationResult.success) {
        return res.status(400).json({
          success: false,
          message: verificationResult.error || 'Payment verification failed',
          reference
        });
      }
      
      // Find payment by reference (which is our invoice_id)
      await client.query('BEGIN');
      
      const paymentResult = await client.query(
        `SELECT * FROM payments 
         WHERE invoice_id = $1 OR provider_reference = $1
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [reference]
      );
      
      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
          reference
        });
      }
      
      let payment = paymentResult.rows[0];
      const paystackStatus = verificationResult.status; // 'completed', 'failed', 'pending'
      
      // Map Paystack status to our internal status
      const mappedStatus = this.mapPaymentStatus(paystackStatus === 'success' ? 'SUCCESS' : paystackStatus.toUpperCase());
      
      // Update payment status if it changed
      if (payment.status !== mappedStatus) {
        await client.query(
          `UPDATE payments 
           SET status = $1, 
               provider_reference = COALESCE($2, provider_reference),
               updated_at = NOW()
           WHERE id = $3`,
          [mappedStatus, reference, payment.id]
        );
        
        // Refresh payment
        const updatedResult = await client.query(
          'SELECT * FROM payments WHERE id = $1',
          [payment.id]
        );
        payment = updatedResult.rows[0];
      }
      
      await client.query('COMMIT');
      
      return res.json({
        success: true,
        status: mappedStatus,
        payment: this.formatPaymentResponse(payment),
        verification: verificationResult.data
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error verifying payment:', {
        error: error.message,
        reference,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error verifying payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  };
  
  /**
   * Calculate the quantity of tickets from payment metadata
   * Considers promo codes and verifies amount matches expected calculation
   * @param {Object} payment - Payment object with metadata
   * @param {Object} ticketType - Ticket type object with price
   * @returns {Object} - { quantity, pricePerTicket, calculatedTotal, verification }
   */
  calculateTicketQuantity = (payment, ticketType) => {
    const metadata = payment.metadata || {};
    
    // First, try to get quantity directly from metadata
    let quantity = parseInt(metadata.quantity) || 1;
    
    // Get ticket price
    const ticketPrice = parseFloat(ticketType.price);
    
    // Get payment amount
    const paymentAmount = parseFloat(payment.amount);
    
    // Get base total price from metadata (before discount)
    const baseTotalPrice = parseFloat(metadata.base_total_price) || (ticketPrice * quantity);
    
    // Get discount amount from metadata
    const discountAmount = parseFloat(metadata.discount_amount) || 0;
    
    // Get final amount from metadata (after discount)
    const finalAmount = parseFloat(metadata.final_amount) || paymentAmount;
    
    // Verify quantity by calculating backwards from amount
    // If promo code was used, we need to account for discount
    let calculatedQuantity = quantity;
    
    if (metadata.promo_code) {
      // With promo code: finalAmount = (ticketPrice * quantity) - discount
      // So: (ticketPrice * quantity) = finalAmount + discount
      // But we already have baseTotalPrice = ticketPrice * quantity
      // So we verify: baseTotalPrice - discountAmount ≈ finalAmount
      const expectedFinal = baseTotalPrice - discountAmount;
      const amountDifference = Math.abs(paymentAmount - expectedFinal);
      
      // Recalculate quantity from baseTotalPrice if it doesn't match
      if (amountDifference > 0.01) {
        // Recalculate: quantity = baseTotalPrice / ticketPrice
        calculatedQuantity = Math.round(baseTotalPrice / ticketPrice);
        console.log('[QUANTITY CALC] Recalculated quantity from baseTotalPrice:', {
          originalQuantity: quantity,
          calculatedQuantity,
          baseTotalPrice,
          ticketPrice,
          calculation: `${baseTotalPrice} / ${ticketPrice} = ${calculatedQuantity}`
        });
      }
    } else {
      // Without promo code: paymentAmount = ticketPrice * quantity
      // So: quantity = paymentAmount / ticketPrice
      const calculatedFromAmount = Math.round(paymentAmount / ticketPrice);
      
      if (calculatedFromAmount !== quantity) {
        console.log('[QUANTITY CALC] Quantity mismatch, recalculating from amount:', {
          metadataQuantity: quantity,
          calculatedFromAmount,
          paymentAmount,
          ticketPrice,
          calculation: `${paymentAmount} / ${ticketPrice} = ${calculatedFromAmount}`
        });
        calculatedQuantity = calculatedFromAmount;
      }
    }
    
    // Ensure quantity is at least 1
    calculatedQuantity = Math.max(1, calculatedQuantity);
    
    // Calculate price per ticket (for individual ticket records)
    const pricePerTicket = ticketPrice;
    
    // Verification object
    const verification = {
      metadataQuantity: quantity,
      calculatedQuantity,
      ticketPrice,
      paymentAmount,
      baseTotalPrice,
      discountAmount,
      finalAmount,
      expectedFinal: baseTotalPrice - discountAmount,
      amountMatches: Math.abs(paymentAmount - (baseTotalPrice - discountAmount)) <= 0.01,
      quantityMatches: calculatedQuantity === quantity,
      hasPromoCode: !!metadata.promo_code
    };
    
    console.log('[QUANTITY CALC] Final calculation:', verification);
    
    return {
      quantity: calculatedQuantity,
      pricePerTicket,
      calculatedTotal: calculatedQuantity * pricePerTicket,
      verification
    };
  };

  /**
   * Create multiple tickets for a payment based on quantity
   * @param {Object} client - Database client
   * @param {Object} payment - Payment object
   * @returns {Array} - Array of created ticket objects
   */
  createTicketForPayment = async (client, payment) => {
    try {
      // Log the incoming payment data for debugging
      console.log('Creating tickets for payment:', {
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
      
      // Calculate quantity from payment metadata (considering promo codes)
      const quantityInfo = this.calculateTicketQuantity(payment, ticketType);
      const quantity = quantityInfo.quantity;
      const pricePerTicket = quantityInfo.pricePerTicket;
      
      console.log('[TICKET CREATION] Quantity calculation result:', {
        quantity,
        pricePerTicket,
        verification: quantityInfo.verification
      });
      
      // Get buyer/user details if available
      // Note: Database uses 'buyers' table, not 'users' table
      let userDetails = {};
      if (payment.user_id) {
        const userResult = await client.query(
          'SELECT id, email, full_name FROM buyers WHERE id = $1',
          [payment.user_id]
        );
        if (userResult.rows.length > 0) {
          const buyer = userResult.rows[0];
          // Map buyers table structure (full_name) to expected format
          const nameParts = (buyer.full_name || '').split(' ');
          userDetails = {
            id: buyer.id,
            email: buyer.email,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || ''
          };
        }
      }
      
      // Prepare customer information
      const customerName = payment.metadata?.customer_name || 
                          `${userDetails.first_name || ''} ${userDetails.last_name || ''}`.trim() ||
                          payment.email?.split('@')[0] ||
                          'Customer';
      const customerEmail = payment.metadata?.customer_email || 
                           userDetails.email || 
                           payment.email;
      
      // Create multiple tickets
      const createdTickets = [];
      const hasUserId = payment.user_id !== null && payment.user_id !== undefined;
      
      console.log(`[TICKET CREATION] Creating ${quantity} ticket(s) for payment ${payment.id}`);
      
      for (let i = 0; i < quantity; i++) {
        // Generate unique ticket number for each ticket
        const ticketNumber = `TKT-${Date.now()}-${Math.floor(Math.random() * 10000)}-${i + 1}`;
        
        const ticketData = {
          ticket_number: ticketNumber,
          ticket_type_id: payment.ticket_type_id,
          event_id: payment.event_id,
          organizer_id: ticketType.organizer_id,
          status: 'paid', // ticket_status enum: 'pending', 'paid', 'cancelled', 'refunded'
          price: pricePerTicket, // Price per individual ticket
          payment_id: payment.id,
          customer_name: customerName,
          customer_email: customerEmail,
          ticket_type_name: ticketType.name,
          user_id: payment.user_id || null, // Include user_id if available
          metadata: {
            ...(payment.metadata || {}),
            customer_name: customerName,
            customer_email: customerEmail,
            ticket_type_name: ticketType.name,
            event_name: ticketType.event_name,
            purchase_date: new Date().toISOString(),
            ticket_index: i + 1, // Track which ticket in the batch (1-based)
            total_tickets: quantity,
            quantity_info: quantityInfo.verification
          },
          created_at: new Date(),
          updated_at: new Date()
        };
        
        console.log(`[TICKET CREATION] Creating ticket ${i + 1}/${quantity}:`, {
          ticketNumber,
          pricePerTicket,
          paymentId: payment.id
        });

        // Create the ticket
        const insertColumns = hasUserId
          ? `ticket_number, ticket_type_id, event_id, organizer_id, status, 
             price, payment_id, metadata, customer_name, customer_email, ticket_type_name, user_id, created_at, updated_at`
          : `ticket_number, ticket_type_id, event_id, organizer_id, status, 
             price, payment_id, metadata, customer_name, customer_email, ticket_type_name, created_at, updated_at`;
        
        const insertValues = hasUserId
          ? `$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14`
          : `$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13`;
        
        const insertParams = hasUserId
          ? [
              ticketData.ticket_number,
              ticketData.ticket_type_id,
              ticketData.event_id,
              ticketData.organizer_id,
              ticketData.status,
              ticketData.price,
              ticketData.payment_id,
              JSON.stringify(ticketData.metadata),
              ticketData.customer_name || payment.metadata?.customer_name || payment.email,
              ticketData.customer_email || payment.email,
              ticketData.ticket_type_name || 'General Admission',
              ticketData.user_id,
              ticketData.created_at,
              ticketData.updated_at
            ]
          : [
              ticketData.ticket_number,
              ticketData.ticket_type_id,
              ticketData.event_id,
              ticketData.organizer_id,
              ticketData.status,
              ticketData.price,
              ticketData.payment_id,
              JSON.stringify(ticketData.metadata),
              ticketData.customer_name || payment.metadata?.customer_name || payment.email,
              ticketData.customer_email || payment.email,
              ticketData.ticket_type_name || 'General Admission',
              ticketData.created_at,
              ticketData.updated_at
            ];

        const ticketResult = await client.query(
          `INSERT INTO tickets (${insertColumns})
           VALUES (${insertValues})
           RETURNING *`,
          insertParams
        );
        
        if (ticketResult.rows.length === 0) {
          throw new Error(`Failed to create ticket ${i + 1}/${quantity}: No data returned from insert`);
        }
        
        const ticket = ticketResult.rows[0];
        createdTickets.push(ticket);
        
        console.log(`[TICKET CREATION] Successfully created ticket ${i + 1}/${quantity}:`, {
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          paymentId: payment.id
        });
      }
      
      // Update payment with first ticket ID (for backward compatibility) and all ticket IDs in metadata
      const firstTicketId = createdTickets[0]?.id;
      const allTicketIds = createdTickets.map(t => t.id);
      const allTicketNumbers = createdTickets.map(t => t.ticket_number);
      
      // Update payment metadata with ticket IDs array
      const ticketIdsMetadata = {
        ...(payment.metadata || {}),
        ticket_ids: allTicketIds,
        ticket_numbers: allTicketNumbers,
        ticket_count: createdTickets.length,
        quantity_verified: quantityInfo.verification
      };
      
      await client.query(
        `UPDATE payments 
         SET ticket_id = $1, 
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $3`,
        [firstTicketId, JSON.stringify(ticketIdsMetadata), payment.id]
      );
      
      console.log('Successfully created all tickets:', {
        ticketCount: createdTickets.length,
        ticketIds: allTicketIds,
        ticketNumbers: allTicketNumbers,
        paymentId: payment.id,
        eventId: payment.event_id,
        ticketTypeId: payment.ticket_type_id
      });
      
      // Return array of tickets (for backward compatibility, also return first ticket)
      // But the method now returns an array
      return createdTickets;
      
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
          status: payment?.status,
          metadata: payment?.metadata
        },
        stack: error.stack
      };
      
      console.error('Error in createTicketForPayment:', errorDetails);
      
      // Rethrow with more context
      const enhancedError = new Error(`Failed to create tickets: ${error.message}`);
      enhancedError.details = errorDetails;
      throw enhancedError;
    }
  };

  handleWebhook = async (req, res) => {
    const client = await pool.connect();
    
    try {
      const webhookData = req.body;
      console.log('[WEBHOOK] Step 1: Webhook received', {
        event: webhookData.event,
        hasData: !!webhookData.data,
        timestamp: new Date().toISOString()
      });
      console.log('[WEBHOOK] Step 1: Full webhook payload', JSON.stringify(webhookData, null, 2));
  
      // Verify Paystack webhook signature
      console.log('[WEBHOOK] Step 2: Verifying webhook signature');
      const paystackSignature = req.headers['x-paystack-signature'];
      let signatureValid = false;
      
      if (paystackSignature) {
        const paystackService = (await import('../services/paystack.service.js')).default;
        signatureValid = paystackService.verifyWebhookSignature(paystackSignature, webhookData);
        if (!signatureValid) {
          console.warn('[WEBHOOK] Step 2: Invalid Paystack webhook signature - processing anyway but logging security concern', {
            signature: paystackSignature.substring(0, 20) + '...',
            event: webhookData.event
          });
          // Note: According to Paystack docs, we should still return 200 OK to acknowledge receipt
          // but log the security concern. In production, you may want to reject invalid signatures.
        } else {
          console.log('[WEBHOOK] Step 2: Paystack webhook signature verified successfully');
        }
      } else {
        console.warn('[WEBHOOK] Step 2: Missing Paystack webhook signature header');
      }
  
      // Extract relevant data from webhook - handle Paystack format
      // Paystack webhook structure: event (e.g., "charge.success"), data.transaction with reference, status, etc.
      const { 
        event,                // Paystack event type (e.g., "charge.success", "charge.failed")
        data: transactionData = {}, // Transaction data
        // Legacy IntaSend fields for backward compatibility
        invoice_id,
        state,
        status,
        api_ref,
        mpesa_reference,
        failed_reason,
        failed_code,
        failed_code_link,
        reference,
        transaction_id,
        payment_id
      } = webhookData;
      
      // Extract transaction details from Paystack webhook
      console.log('[WEBHOOK] Step 3: Extracting transaction data from webhook');
      const paystackTransaction = transactionData.transaction || transactionData;
      const paystackReference = paystackTransaction?.reference || reference || transaction_id;
      const paystackStatus = paystackTransaction?.status || status; // "success", "failed", "pending"
      const paystackAmount = paystackTransaction?.amount; // Amount in kobo
      const paystackCurrency = paystackTransaction?.currency;
      const paystackGatewayResponse = paystackTransaction?.gateway_response;
      const paystackPaidAt = paystackTransaction?.paid_at;
      
      console.log('[WEBHOOK] Step 3: Transaction data extracted - Full details', {
        paystackReference: paystackReference || 'NOT SET',
        paystackReferenceType: typeof paystackReference,
        paystackReferenceLength: paystackReference ? String(paystackReference).length : 0,
        paystackStatus: paystackStatus || 'NOT SET',
        paystackAmount: paystackAmount || 'NOT SET',
        paystackAmountInKES: paystackAmount ? paystackAmount / 100 : null,
        paystackCurrency: paystackCurrency || 'NOT SET',
        paystackGatewayResponse: paystackGatewayResponse || 'NOT SET',
        paystackPaidAt: paystackPaidAt || 'NOT SET',
        transactionId: paystackTransaction?.id || 'NOT SET',
        transactionDataStructure: {
          hasTransaction: !!transactionData.transaction,
          hasDirectData: !!transactionData.reference,
          transactionKeys: transactionData.transaction ? Object.keys(transactionData.transaction) : [],
          dataKeys: Object.keys(transactionData)
        },
        rawWebhookReference: reference || 'NOT SET',
        rawTransactionId: transaction_id || 'NOT SET',
        note: 'paystackReference will be used to find payment in database'
      });
      
      // Determine effective state/status
      // Paystack: "success" = completed, "failed" = failed, "pending" = pending
      // Map Paystack event to status
      // Supported Paystack events for payments:
      // - charge.success: Payment successful
      // - charge.failed: Payment failed
      // - Other events (refunds, disputes, etc.) are logged but may not update payment status
      let effectiveState = 'UNKNOWN';
      if (event === 'charge.success') {
        effectiveState = 'COMPLETE';
      } else if (event === 'charge.failed' || paystackStatus === 'failed') {
        effectiveState = 'FAILED';
      } else if (paystackStatus === 'success') {
        effectiveState = 'COMPLETE';
      } else if (paystackStatus === 'pending') {
        effectiveState = 'PROCESSING';
      } else if (state) {
        // Fallback to IntaSend format for backward compatibility
        effectiveState = state;
      } else if (status) {
        effectiveState = status;
      } else if (event && !event.startsWith('charge.')) {
        // Log other Paystack events (refunds, disputes, etc.) but don't update payment status
        console.log('Received non-payment Paystack event:', { event, transactionData });
        // Return 200 OK but don't process as payment update
        await client.release();
        return res.status(200).json({ 
          success: true, 
          message: 'Webhook received (non-payment event, acknowledged)',
          event 
        });
      }
      
      // Use Paystack reference (which is our invoice_id) or fallback to other identifiers
      // Priority: Paystack reference > api_ref (IntaSend) > other references
      console.log('[WEBHOOK] Step 4: Determining effective identifiers', {
        availableIdentifiers: {
          paystackReference: paystackReference || 'NOT SET',
          api_ref: api_ref || 'NOT SET',
          reference: reference || 'NOT SET',
          transaction_id: transaction_id || 'NOT SET',
          payment_id: payment_id || 'NOT SET',
          invoice_id: invoice_id || 'NOT SET'
        }
      });
      
      const effectiveApiRef = paystackReference || api_ref || reference || transaction_id || payment_id || '';
      const effectiveInvoiceId = paystackReference || invoice_id || effectiveApiRef || '';
      
      console.log('[WEBHOOK] Step 4: Effective identifiers determined', {
        effectiveApiRef: effectiveApiRef || 'EMPTY',
        effectiveInvoiceId: effectiveInvoiceId || 'EMPTY',
        paystackReference: paystackReference || 'NOT SET',
        api_ref: api_ref || 'NOT SET',
        reference: reference || 'NOT SET',
        transaction_id: transaction_id || 'NOT SET',
        payment_id: payment_id || 'NOT SET',
        invoice_id: invoice_id || 'NOT SET',
        willUseForSearch: {
          primary: effectiveApiRef || effectiveInvoiceId,
          fallback: effectiveInvoiceId || effectiveApiRef
        }
      });
      
      // Log the raw state/status for debugging
      console.log('[WEBHOOK] Step 5: Processing webhook status', {
        event: event,
        state: state,
        status: status,
        paystackStatus: paystackStatus,
        effectiveState: effectiveState,
        paystackReference: paystackReference,
        paystackAmount: paystackAmount,
        paystackAmountInKES: paystackAmount ? paystackAmount / 100 : null,
        paystackCurrency: paystackCurrency,
        paystackGatewayResponse: paystackGatewayResponse,
        paystackPaidAt: paystackPaidAt,
        paystackTransactionId: paystackTransaction?.id,
        webhookDataKeys: Object.keys(webhookData),
        transactionDataKeys: transactionData ? Object.keys(transactionData) : [],
        fullTransactionData: process.env.NODE_ENV === 'development' ? {
          reference: paystackTransaction?.reference,
          status: paystackTransaction?.status,
          amount: paystackTransaction?.amount,
          currency: paystackTransaction?.currency,
          id: paystackTransaction?.id
        } : undefined
      });
      
      // Start transaction early to ensure all queries are within it
      console.log('[WEBHOOK] Step 6: Starting database transaction', { effectiveInvoiceId });
      await client.query('BEGIN');
      
      try {
        // First, attempt to match a product transaction directly by invoice id
        if (effectiveInvoiceId) {
          console.log('[WEBHOOK] Step 7: Checking for product transaction', { effectiveInvoiceId });
          try {
            const prodRes = await client.query(
              'SELECT * FROM product_transactions WHERE invoice_id = $1 FOR UPDATE',
              [effectiveInvoiceId]
            );
            console.log('[WEBHOOK] Step 7: Product transaction lookup result', {
              found: prodRes.rows.length > 0,
              count: prodRes.rows.length
            });
            if (prodRes.rows.length > 0) {
              const prodTx = prodRes.rows[0];
              const mapped = this.mapPaymentStatus(effectiveState);
              const mappedEnum = (mapped === 'completed' || mapped === 'failed' || mapped === 'cancelled') ? mapped : 'pending';

              const providerRef = paystackReference || mpesa_reference || reference || transaction_id || prodTx.provider_reference;
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
                    console.error('Failed to mark product as sold:', { error: e.message, productId: productIdInt });
                  }
                }
              }

              await client.query('COMMIT');
              await client.release();
              return res.json({ success: true, message: 'Product transaction updated from webhook', invoice_id: effectiveInvoiceId, status: mappedEnum });
            }
          } catch (e) {
            // Handle product_transactions table not existing gracefully
            if (e.message && e.message.includes('relation "product_transactions" does not exist')) {
              console.log('[WEBHOOK] Step 7: product_transactions table does not exist, skipping product transaction lookup', {
                invoiceId: effectiveInvoiceId
              });
            } else {
              console.error('[WEBHOOK] Step 7: Error processing product transaction webhook path:', { 
                error: e.message,
                errorName: e.name,
                stack: e.stack,
                invoiceId: effectiveInvoiceId,
                reference: paystackReference,
                event: event,
                paystackStatus: paystackStatus,
                effectiveState: effectiveState,
                webhookData: {
                  event: webhookData.event,
                  reference: paystackReference,
                  status: paystackStatus
                }
              });
            }
            // Rollback and continue to payment path
            await client.query('ROLLBACK');
            await client.query('BEGIN'); // Start new transaction for payment lookup
          }
        }

        // Try to find payment by multiple identifiers
        // Priority: Paystack reference (our invoice_id) > api_ref > other references
        console.log('[WEBHOOK] Step 8: Preparing payment search', { effectiveInvoiceId, effectiveApiRef });
        
        // Get unique search values (remove duplicates)
        const allSearchValues = [
          effectiveApiRef,         // Try Paystack reference first (our invoice ID - this is what we store)
          effectiveInvoiceId,      // Then invoice ID
          paystackReference,       // Paystack reference
          reference,               // Generic reference
          transaction_id,          // Transaction ID
          payment_id               // Payment ID
        ].filter(Boolean); // Remove any empty values
        
        // Get unique values only (for query parameters)
        const uniqueSearchValues = [...new Set(allSearchValues)];
        // Query uses $1 and $2, so we need exactly 2 values
        // If we only have 1 unique value, duplicate it to match query parameters
        const searchValues = uniqueSearchValues.length >= 2 
          ? uniqueSearchValues.slice(0, 2)
          : uniqueSearchValues.length === 1
          ? [uniqueSearchValues[0], uniqueSearchValues[0]] // Duplicate single value for $1 and $2
          : [effectiveInvoiceId || '', effectiveApiRef || '']; // Fallback to ensure we have 2 values
        
        // Log the search parameters
        console.log('[WEBHOOK] Step 8: Searching for payment with identifiers', { 
          effectiveInvoiceId,
          effectiveApiRef,
          paystackReference,
          reference,
          transaction_id,
          payment_id,
          allSearchValues,
          uniqueSearchValues,
          allSearchValues,
          uniqueSearchValues,
          searchValues,
          event: event,
          paystackStatus: paystackStatus,
          effectiveState: effectiveState
        });

        // Find payment by invoice_id or api_ref
        // Include ticket_type_id and metadata explicitly
        // Query uses $1 and $2 - we ensure we always pass 2 values (may be duplicates)
        const queryText = `
          SELECT p.*, 
                 p.ticket_type_id as ticket_type_id,
                 p.metadata as payment_metadata
          FROM payments p
          WHERE 
            (p.invoice_id = $1 OR p.invoice_id = $2 OR 
             p.api_ref = $1 OR p.api_ref = $2)
          ORDER BY p.created_at DESC
          LIMIT 1
          FOR UPDATE
        `;

        console.log('[WEBHOOK] Step 8: Executing payment lookup query - Full search details', { 
          query: queryText,
          allSearchValues: allSearchValues,
          uniqueSearchValues: uniqueSearchValues,
          searchValues: searchValues.map((v, i) => ({ 
            index: i + 1, 
            value: v || 'EMPTY',
            valueString: v ? String(v) : 'EMPTY',
            type: typeof v,
            length: v ? String(v).length : 0,
            isEmpty: !v || v === ''
          })),
          searchValuesCount: searchValues.length,
          queryParams: searchValues,
          note: 'Query uses $1 and $2, ensuring exactly 2 values are passed (may be duplicates if only 1 unique value)'
        });
        
        const result = await client.query(queryText, searchValues);
        
        console.log('[WEBHOOK] Step 8: Payment lookup result', {
          found: result.rows.length > 0,
          count: result.rows.length,
          payments: result.rows.map(r => ({
            id: r.id,
            invoice_id: r.invoice_id,
            api_ref: r.api_ref,
            provider_reference: r.provider_reference,
            status: r.status,
            amount: r.amount,
            created_at: r.created_at,
            matchesSearch: {
              matchesInvoiceId: r.invoice_id === effectiveInvoiceId || r.invoice_id === effectiveApiRef,
              matchesApiRef: r.api_ref === effectiveApiRef || r.api_ref === effectiveInvoiceId,
              matchesPaystackRef: r.invoice_id === paystackReference || r.api_ref === paystackReference
            }
          })),
          searchedFor: {
            effectiveInvoiceId,
            effectiveApiRef,
            paystackReference
          }
        });

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
          
          console.error('[WEBHOOK] Step 8: Payment not found for webhook', {
            invoice_id: effectiveInvoiceId,
            api_ref: effectiveApiRef,
            paystackReference: paystackReference,
            search_values: searchValues,
            event: event,
            paystackStatus: paystackStatus,
            effectiveState: effectiveState,
            recent_payments: recentPayments.rows.map(p => ({
              id: p.id,
              invoice_id: p.invoice_id,
              api_ref: p.api_ref,
              status: p.status,
              provider_reference: p.provider_reference,
              created_at: p.created_at
            })),
            webhookData: {
              event: webhookData.event,
              reference: paystackReference,
              status: paystackStatus,
              amount: paystackAmount,
              currency: paystackCurrency
            }
          });
          
          console.log('[WEBHOOK] Step 8: Returning 404 - Payment not found');
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
        console.log('[WEBHOOK] Step 9: Payment found - Full payment data with matching analysis', {
          paymentId: payment.id,
          invoiceId: payment.invoice_id || 'NULL',
          invoiceIdType: typeof payment.invoice_id,
          invoiceIdLength: payment.invoice_id ? String(payment.invoice_id).length : 0,
          apiRef: payment.api_ref || 'NULL',
          apiRefType: typeof payment.api_ref,
          apiRefLength: payment.api_ref ? String(payment.api_ref).length : 0,
          providerReference: payment.provider_reference || 'NULL',
          providerReferenceType: typeof payment.provider_reference,
          providerReferenceLength: payment.provider_reference ? String(payment.provider_reference).length : 0,
          currentStatus: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          email: payment.email,
          phoneNumber: payment.phone_number,
          hasTicket: !!payment.ticket_id,
          ticketId: payment.ticket_id,
          eventId: payment.event_id,
          ticketTypeId: payment.ticket_type_id,
          organizerId: payment.organizer_id,
          userId: payment.user_id,
          paymentMethod: payment.payment_method,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at,
          metadata: payment.metadata ? {
            keys: Object.keys(payment.metadata),
            hasPromoCode: !!payment.metadata.promo_code,
            quantity: payment.metadata.quantity,
            baseTotalPrice: payment.metadata.base_total_price,
            finalAmount: payment.metadata.final_amount,
            invoice_id: payment.metadata.invoice_id,
            event_id: payment.metadata.event_id,
            ticket_type_id: payment.metadata.ticket_type_id
          } : null,
          matchingAnalysis: {
            paystackReference: paystackReference || 'NOT SET',
            invoiceIdMatchesPaystackRef: payment.invoice_id === paystackReference,
            apiRefMatchesPaystackRef: payment.api_ref === paystackReference,
            providerRefMatchesPaystackRef: payment.provider_reference === paystackReference,
            invoiceIdMatchesEffectiveInvoiceId: payment.invoice_id === effectiveInvoiceId,
            apiRefMatchesEffectiveApiRef: payment.api_ref === effectiveApiRef,
            exactMatch: payment.invoice_id === paystackReference || payment.api_ref === paystackReference,
            stringComparison: {
              invoiceIdEquals: String(payment.invoice_id) === String(paystackReference),
              apiRefEquals: String(payment.api_ref) === String(paystackReference),
              invoiceIdTrimmedEquals: payment.invoice_id?.trim() === paystackReference?.trim(),
              apiRefTrimmedEquals: payment.api_ref?.trim() === paystackReference?.trim()
            }
          }
        });
        
        // Map the status using the effective state we determined earlier
        const mappedStatus = this.mapPaymentStatus(effectiveState);
        
        // Log the status mapping for debugging
        console.log('[WEBHOOK] Step 9: Mapping payment status', {
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          currentStatus: payment.status,
          newStatus: mappedStatus,
          providerStatus: effectiveState,
          paystackStatus: paystackStatus,
          event: event,
          hasTicket: !!payment.ticket_id,
          rawState: state,
          rawStatus: status
        });

        // Always update payment to record webhook receipt, even if status hasn't changed
        // This ensures we have a record of all webhook events
        console.log('[WEBHOOK] Step 10: Updating payment status', {
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          statusChange: `${payment.status} -> ${mappedStatus}`,
          willChange: payment.status !== mappedStatus
        });

        // Declare updateQuery and updateParams in outer scope for error handling
        let updateQuery = null;
        let updateParams = null;

        try {
          // Update payment status with additional logging
          console.log('[WEBHOOK] Step 10: Preparing payment update query');
          updateQuery = `
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
          
          // Extract failure details from Paystack or legacy format
          const failureReason = paystackGatewayResponse || failed_reason || null;
          const failureCode = paystackTransaction?.gateway_response || failed_code || null;
          
          webhookHistory.push({
            received_at: new Date().toISOString(),
            event: event || null, // Paystack event type
            status: effectiveState,
            mapped_status: mappedStatus,
            provider_reference: paystackReference || mpesa_reference || reference || transaction_id,
            failed_reason: failureReason,
            failed_code: failureCode,
            full_payload: webhookData
          });
          
          const metadataUpdate = {
            ...existingMetadata,
            last_webhook_status: effectiveState,
            last_webhook_received: new Date().toISOString(),
            webhook_history: webhookHistory.slice(-10), // Keep last 10 webhooks for audit trail
            provider_data: {
              event: event || null, // Paystack event
              state: effectiveState,
              status: paystackStatus || status,
              reference: paystackReference || reference,
              transaction_id: paystackTransaction?.id || transaction_id,
              amount: paystackAmount ? paystackAmount / 100 : null, // Convert from kobo
              currency: paystackCurrency || 'KES',
              gateway_response: paystackGatewayResponse,
              paid_at: paystackPaidAt,
              failed_reason: failureReason,
              failed_code: failureCode,
              failed_code_link: failed_code_link || null
            },
            // Initialize ticket_creation tracking if not exists (will be updated during ticket creation)
            ticket_creation: existingMetadata.ticket_creation || {
              status: 'not_started',
              note: 'Ticket creation will be attempted when payment status is completed'
            }
          };
          
          updateParams = [
            mappedStatus,
            paystackReference || mpesa_reference || payment.provider_reference || reference || transaction_id,
            JSON.stringify(metadataUpdate),
            payment.id
          ];
          
          console.log('[WEBHOOK] Step 10: Payment update parameters - Full details', { 
            paymentId: payment.id,
            invoiceId: payment.invoice_id,
            currentStatus: payment.status,
            newStatus: mappedStatus,
            statusWillChange: payment.status !== mappedStatus,
            providerReference: updateParams[1] || 'NOT SET',
            providerReferenceType: typeof updateParams[1],
            providerReferenceLength: updateParams[1] ? String(updateParams[1]).length : 0,
            metadataUpdateSize: JSON.stringify(updateParams[2]).length,
            updateParams: process.env.NODE_ENV === 'development' ? {
              param1_status: updateParams[0],
              param2_providerRef: updateParams[1],
              param3_metadataSize: JSON.stringify(updateParams[2]).length,
              param4_paymentId: updateParams[3]
            } : '[REDACTED]',
            comparison: {
              paystackRef: paystackReference,
              paymentInvoiceId: payment.invoice_id,
              paymentApiRef: payment.api_ref,
              paymentProviderRef: payment.provider_reference,
              willUpdateProviderRef: updateParams[1] && updateParams[1] !== payment.provider_reference
            }
          });
          
          try {
            console.log('[WEBHOOK] Step 10: Executing payment update query', {
              paymentId: payment.id,
              invoiceId: payment.invoice_id,
              query: updateQuery.substring(0, 200)
            });
            
            const updateResult = await client.query(updateQuery, updateParams);
            
            console.log('[WEBHOOK] Step 10: Payment update query executed', {
              paymentId: payment.id,
              rowsAffected: updateResult.rowCount,
              hasResult: updateResult.rows.length > 0
            });
            
            if (updateResult.rows.length === 0) {
              console.error('[WEBHOOK] Step 10: Payment update failed - no rows affected', {
                paymentId: payment.id,
                invoiceId: payment.invoice_id,
                updateQuery: updateQuery.substring(0, 300),
                updateParams: process.env.NODE_ENV === 'development' ? {
                  status: updateParams[0],
                  providerRef: updateParams[1],
                  metadataSize: JSON.stringify(updateParams[2]).length,
                  paymentId: updateParams[3]
                } : '[REDACTED]'
              });
              throw new Error('Failed to update payment status - no rows affected');
            }
            
            const updatedPayment = updateResult.rows[0];
            
            console.log('[WEBHOOK] Step 10: Payment update result - Before/After comparison', {
              paymentId: updatedPayment.id,
              invoiceId: updatedPayment.invoice_id,
              status: {
                before: payment.status,
                after: updatedPayment.status,
                changed: payment.status !== updatedPayment.status
              },
              providerReference: {
                before: payment.provider_reference,
                after: updatedPayment.provider_reference,
                changed: payment.provider_reference !== updatedPayment.provider_reference
              },
              apiRef: {
                before: payment.api_ref,
                after: updatedPayment.api_ref,
                changed: payment.api_ref !== updatedPayment.api_ref
              },
              updatedAt: updatedPayment.updated_at
            });
            
            // Update local payment object with latest data from database
            Object.assign(payment, updatedPayment);
            
            console.log(`Payment ${payment.id} updated successfully from webhook:`, {
              paymentId: payment.id,
              oldStatus: payment.status,
              newStatus: updatedPayment.status,
              updatedAt: updatedPayment.updated_at,
              providerReference: updatedPayment.provider_reference,
              statusChanged: payment.status !== updatedPayment.status
            });
            
          } catch (updateError) {
            console.error('Error executing payment status update query:', {
              error: updateError.message,
              stack: updateError.stack,
              query: updateQuery,
              params: updateParams,
              paymentId: payment.id
            });
            throw updateError;
          }

          // Create tickets if payment is completed
          // Track ticket creation lifecycle in payment metadata
          if (mappedStatus === 'completed') {
            // Check if tickets already exist (check both ticket_id and ticket_ids array)
            const existingTicketIds = payment.metadata?.ticket_ids || [];
            const hasExistingTickets = payment.ticket_id || (existingTicketIds.length > 0);
            
            if (hasExistingTickets) {
              const existingTicketId = payment.ticket_id || existingTicketIds[0];
              console.log(`Payment ${payment.id} already has ${existingTicketIds.length || 1} ticket(s), skipping ticket creation`, {
                ticketId: existingTicketId,
                ticketIds: existingTicketIds,
                ticketCount: existingTicketIds.length || 1
              });
              
              // Update metadata to reflect existing tickets
              const existingTicketMetadata = {
                ...(payment.metadata || {}),
                ticket_creation: {
                  status: 'completed',
                  ticket_id: existingTicketId, // First ticket for backward compatibility
                  ticket_ids: existingTicketIds.length > 0 ? existingTicketIds : [existingTicketId],
                  ticket_count: existingTicketIds.length || 1,
                  completed_at: payment.updated_at || new Date().toISOString(),
                  note: 'Tickets already existed when webhook processed'
                }
              };
              
              await client.query(
                'UPDATE payments SET metadata = COALESCE(metadata, \'{}\'::jsonb) || $1::jsonb WHERE id = $2',
                [JSON.stringify(existingTicketMetadata), payment.id]
              );
            } else {
              console.log(`Creating tickets for completed payment ${payment.id}`);
              
              // Track ticket creation start in metadata BEFORE attempting creation
              const ticketCreationStartMetadata = {
                ...(payment.metadata || {}),
                ticket_creation: {
                  status: 'in_progress',
                  started_at: new Date().toISOString(),
                  payment_id: payment.id,
                  event_id: payment.event_id,
                  ticket_type_id: payment.ticket_type_id,
                  quantity: payment.metadata?.quantity || 1
                }
              };
              
              // Update metadata to track ticket creation start
              await client.query(
                'UPDATE payments SET metadata = COALESCE(metadata, \'{}\'::jsonb) || $1::jsonb WHERE id = $2',
                [JSON.stringify(ticketCreationStartMetadata), payment.id]
              );
              
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
                  throw new Error('Payment is missing ticket_type_id. Cannot create tickets.');
                }
                
                if (!ticketData.event_id) {
                  throw new Error('Payment is missing event_id. Cannot create tickets.');
                }
                
                console.log('Creating tickets with data:', {
                  ...ticketData,
                  quantity: ticketData.metadata?.quantity || 1
                });
                
                // Create tickets within the same transaction (returns array)
                const tickets = await this.createTicketForPayment(client, ticketData);
                
                // Extract ticket information
                const ticketIds = tickets.map(t => t.id);
                const ticketNumbers = tickets.map(t => t.ticket_number);
                const firstTicketId = ticketIds[0];
                
                // Update payment with ticket_ids array and success status
                const ticketCreationSuccessMetadata = {
                  ...(payment.metadata || {}),
                  ticket_creation: {
                    status: 'completed',
                    ticket_id: firstTicketId, // First ticket for backward compatibility
                    ticket_ids: ticketIds, // Array of all ticket IDs
                    ticket_numbers: ticketNumbers, // Array of all ticket numbers
                    ticket_count: tickets.length,
                    completed_at: new Date().toISOString(),
                    started_at: ticketCreationStartMetadata.ticket_creation.started_at,
                    quantity: tickets.length
                  }
                };
                
                await client.query(
                  `UPDATE payments 
                   SET ticket_id = $1, 
                       metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                       updated_at = NOW()
                   WHERE id = $3`,
                  [firstTicketId, JSON.stringify(ticketCreationSuccessMetadata), payment.id]
                );
                
                // Refresh payment data
                const refreshedPayment = await client.query(
                  'SELECT * FROM payments WHERE id = $1',
                  [payment.id]
                );
                
                if (refreshedPayment.rows.length > 0) {
                  Object.assign(payment, refreshedPayment.rows[0]);
                  console.log(`Successfully created ${tickets.length} ticket(s) for payment ${payment.id}:`, {
                    ticketIds,
                    ticketNumbers,
                    ticketCount: tickets.length
                  });
                } else {
                  console.warn(`Could not refresh payment data after ticket creation for payment ${payment.id}`);
                }
              } catch (ticketError) {
                // Log the error with full context
                const errorMessage = ticketError.message || 'Unknown error creating tickets';
                const isMissingData = errorMessage.includes('missing') || errorMessage.includes('required');
                
                console.error(`Error creating tickets for payment ${payment.id}:`, {
                  error: errorMessage,
                  stack: ticketError.stack,
                  paymentId: payment.id,
                  paymentStatus: payment.status,
                  mappedStatus,
                  isMissingData,
                  paymentData: {
                    hasTicketTypeId: !!payment.ticket_type_id,
                    hasEventId: !!payment.event_id,
                    quantity: payment.metadata?.quantity || 1,
                    metadataKeys: payment.metadata ? Object.keys(payment.metadata) : []
                  }
                });
                
                // Update payment metadata with failure details
                // This happens within the same transaction - no nested transaction needed
                const ticketCreationFailureMetadata = {
                  ...(payment.metadata || {}),
                  ticket_creation: {
                    status: 'failed',
                    error: errorMessage,
                    error_type: isMissingData ? 'missing_data' : 'creation_error',
                    failed_at: new Date().toISOString(),
                    started_at: ticketCreationStartMetadata.ticket_creation.started_at,
                    retryable: !isMissingData, // Can retry if not a data validation error
                    missing_fields: {
                      ticket_type_id: !payment.ticket_type_id,
                      event_id: !payment.event_id
                    },
                    attempted_quantity: payment.metadata?.quantity || 1
                  }
                };
                
                await client.query(
                  `UPDATE payments 
                   SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                       updated_at = NOW()
                   WHERE id = $2`,
                  [JSON.stringify(ticketCreationFailureMetadata), payment.id]
                );
                
                // Log failure but don't throw - payment status update should still succeed
                // This allows the webhook to return 200 OK to Paystack
                console.warn(`Payment ${payment.id} completed but ticket creation failed. Error logged in payment metadata.`);
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

          console.log('[WEBHOOK] Step 12: Committing database transaction', { paymentId: payment.id });
          await client.query('COMMIT');
          console.log('[WEBHOOK] Step 12: Database transaction committed successfully', {
            paymentId: payment.id,
            invoiceId: payment.invoice_id,
            finalStatus: payment.status
          });

          // Broadcast payment status update to connected SSE clients
          const invoiceId = payment.invoice_id;
          if (invoiceId) {
            // Extract failure details from Paystack webhook if payment failed or cancelled
            const failureReason = paystackGatewayResponse || failed_reason || null;
            const failureCode = paystackTransaction?.gateway_response || failed_code || null;
            
            const failureDetails = (mappedStatus === 'failed' || mappedStatus === 'cancelled') ? {
              failed_reason: failureReason,
              failed_code: failureCode,
              failed_code_link: failed_code_link || null
            } : null;

            sseService.broadcast(invoiceId, {
              type: 'payment_status_update',
              invoiceId: invoiceId,
              status: mappedStatus,
              payment: this.formatPaymentResponse(payment),
              failureDetails: failureDetails,
              timestamp: new Date().toISOString()
            });
            console.log(`SSE: Broadcasted payment status update for invoice ${invoiceId} to ${sseService.getConnectionCount(invoiceId)} client(s)`);
          }

        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error updating payment from webhook:', {
            error: error.message,
            errorName: error.name,
            paymentId: payment?.id,
            invoiceId: payment?.invoice_id,
            currentStatus: payment?.status,
            newStatus: mappedStatus,
            effectiveState: effectiveState,
            paystackReference: paystackReference,
            stack: error.stack,
            updateQuery: updateQuery || 'NOT SET',
            updateParams: updateParams && process.env.NODE_ENV === 'development' ? updateParams : '[REDACTED]'
          });
          throw error;
        }
        
        console.log('[WEBHOOK] Step 13: Webhook processing completed successfully', {
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          finalStatus: payment.status,
          hasTicket: !!payment.ticket_id,
          ticketId: payment.ticket_id
        });
        
        return res.json({ 
          success: true, 
          message: 'Webhook processed successfully',
          payment: this.formatPaymentResponse(payment)
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('[WEBHOOK] Error in payment webhook transaction:', {
          error: error.message,
          errorName: error.name,
          stack: error.stack,
          event: event,
          paystackReference: paystackReference,
          effectiveInvoiceId: effectiveInvoiceId,
          effectiveApiRef: effectiveApiRef,
          effectiveState: effectiveState,
          paystackStatus: paystackStatus,
          webhookData: {
            event: webhookData.event,
            reference: paystackReference,
            status: paystackStatus,
            amount: paystackAmount,
            currency: paystackCurrency
          }
        });
        throw error;
      }

    } catch (error) {
      console.error('Error in payment webhook handler:', {
        error: error.message,
        errorName: error.name,
        stack: error.stack,
        event: req.body?.event,
        webhookBody: {
          event: req.body?.event,
          data: req.body?.data ? {
            reference: req.body.data.reference || req.body.data.transaction?.reference,
            status: req.body.data.status || req.body.data.transaction?.status,
            amount: req.body.data.amount || req.body.data.transaction?.amount,
            currency: req.body.data.currency || req.body.data.transaction?.currency
          } : null
        },
        headers: {
          'x-paystack-signature': req.headers['x-paystack-signature'] ? 'present' : 'missing',
          'x-paystack-integration-id': req.headers['x-paystack-integration-id'],
          'user-agent': req.headers['user-agent']
        },
        fullError: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: error.cause
        } : undefined
      });
      
      // Always return 200 OK to acknowledge receipt (prevents Paystack retries)
      // According to Paystack docs: "Without a 200 OK in the response header, 
      // events are sent for the next 72 hours"
      // In live mode: retried every 3 minutes for first 4 tries, then hourly for 72 hours
      // In test mode: retried hourly for 10 hours
      return res.status(200).json({ 
        success: false, 
        message: 'Error processing webhook (acknowledged)',
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
    console.log('Mapping payment status:', { providerStatus, normalizedStatus });
    
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

