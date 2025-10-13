import { pool } from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../utils/errorHandler.js';
import { sendEmail } from '../../utils/email.js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Purchase tickets for an event
 */
export const purchaseTickets = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    const { 
      eventId, 
      ticketTypeId, 
      quantity, 
      customerName, 
      customerEmail, 
      phoneNumber 
    } = req.body;

    // Validate required fields
    if (!eventId || !customerName || !customerEmail || !phoneNumber) {
      return next(new AppError('Missing required fields', 400));
    }

    if (!quantity || quantity < 1) {
      return next(new AppError('Invalid quantity', 400));
    }

    console.log('Starting transaction for ticket purchase...');
    await client.query('BEGIN');

    try {
      // 1. Get and validate event
      console.log('Fetching event details for ID:', eventId);
      const eventQuery = `
        SELECT e.*, o.id as organizer_id 
        FROM events e
        JOIN organizers o ON e.organizer_id = o.id
        WHERE e.id = $1 AND e.status = 'published'
        FOR UPDATE`;
        
      const eventResult = await client.query(eventQuery, [eventId]);
      const event = eventResult.rows[0];
      
      if (!event) {
        console.log('Event not found or not published');
        await client.query('ROLLBACK');
        return next(new AppError('Event not found or not available for ticket sales', 404));
      }
      console.log('Found event:', event.name);

      // 2. Handle ticket type if specified
      let ticketType = null;
      if (ticketTypeId) {
        console.log('Fetching ticket type details for ID:', ticketTypeId);
        const ticketTypeQuery = `
          SELECT * FROM ticket_types 
          WHERE id = $1 
            AND event_id = $2 
            AND (sales_start_date IS NULL OR sales_start_date <= NOW())
            AND (sales_end_date IS NULL OR sales_end_date >= NOW())
          FOR UPDATE`;
          
        const ticketTypeResult = await client.query(ticketTypeQuery, [ticketTypeId, eventId]);
        
        if (ticketTypeResult.rows.length === 0) {
          console.log('Invalid or inactive ticket type');
          await client.query('ROLLBACK');
          return next(new AppError('Invalid or inactive ticket type', 400));
        }
        
        ticketType = ticketTypeResult.rows[0];
        console.log('Found ticket type:', ticketType.name);
      }

      // 3. Check ticket availability
      console.log('Checking ticket availability...');
      console.log('Event ID:', eventId);
      console.log('Ticket Type ID:', ticketTypeId);
      
      // Log the ticket type and event details for debugging
      console.log('Ticket Type:', ticketType);
      console.log('Event Details:', {
        eventId: event.id,
        eventName: event.name,
        eventTicketQuantity: event.ticket_quantity,
        hasTicketType: !!ticketType,
        ticketTypeQuantity: ticketType?.quantity
      });
      
      // Build and log the query
      const availabilityQuery = ticketTypeId
        ? `SELECT COUNT(*) as sold FROM tickets WHERE event_id = $1 AND ticket_type_id = $2`
        : `SELECT COUNT(*) as sold FROM tickets WHERE event_id = $1 AND (ticket_type_id IS NULL OR ticket_type_id = $2)`;
      
      const availabilityParams = ticketTypeId ? [eventId, ticketTypeId] : [eventId];
      
      console.log('Running query:', availabilityQuery);
      console.log('With params:', availabilityParams);
      
      const availabilityResult = await client.query(availabilityQuery, availabilityParams);
      
      const ticketsSold = parseInt(availabilityResult.rows[0].sold, 10);
      const maxTickets = ticketType ? ticketType.quantity : event.ticket_quantity;
      const availableTickets = Math.max(0, maxTickets - ticketsSold);
      
      console.log('Ticket count results:', {
        ticketsSold,
        maxTickets,
        availableTickets,
        requestedQuantity: quantity
      });
      
      if (availableTickets < quantity) {
        console.log(`Not enough tickets available. Requested: ${quantity}, Available: ${availableTickets}`);
        await client.query('ROLLBACK');
        return next(new AppError(`Only ${availableTickets} ticket${availableTickets !== 1 ? 's' : ''} available`, 400));
      }

      // 4. Calculate total price
      // Use the price from the request if provided, otherwise calculate from ticket type or event
      const unitPrice = req.body.unitPrice || (ticketType ? ticketType.price : event.ticket_price);
      const totalPrice = req.body.totalPrice || (unitPrice * quantity);
      const transactionId = uuidv4();
      
      console.log('Processing purchase with prices:', {
        quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        ticketTypePrice: ticketType ? ticketType.price : undefined,
        eventPrice: event.ticket_price,
        requestBodyPrice: req.body.price,
        requestBodyUnitPrice: req.body.unitPrice,
        requestBodyTotalPrice: req.body.totalPrice,
        transactionId
      });
      
      // Ensure unitPrice is a number
      const numericUnitPrice = Number(unitPrice) || 0;
      const numericTotalPrice = Number(totalPrice) || 0;

      // 5. Create tickets
      console.log('Creating tickets...');
      const ticketNumbers = [];
      const ticketInserts = [];
      
      for (let i = 0; i < quantity; i++) {
        const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        ticketNumbers.push(ticketNumber);
        
        const metadata = JSON.stringify({
          phoneNumber,
          transactionId,
          purchaseDate: new Date().toISOString()
        });
        
        const insertQuery = `
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid', $9::jsonb, NOW(), NOW())
          RETURNING id, ticket_number`;
          
        const insertParams = [
          ticketNumber,
          eventId,
          event.organizer_id,
          customerName,
          customerEmail,
          ticketTypeId,
          ticketType ? ticketType.name : 'General Admission',
          numericUnitPrice, // price per ticket
          metadata
        ];
        
        console.log('Inserting ticket with price:', {
          ticketNumber,
          price: numericUnitPrice
        });
        
        ticketInserts.push(client.query(insertQuery, insertParams));
      }
      
      // Execute all ticket inserts in parallel
      const ticketResults = await Promise.all(ticketInserts);
      const tickets = ticketResults.map(result => result.rows[0]);
      
      console.log(`Successfully created ${tickets.length} tickets`);

      // 6. Update ticket counts
      if (ticketType) {
        await client.query(
          'UPDATE ticket_types SET quantity = quantity - $1 WHERE id = $2',
          [quantity, ticketTypeId]
        );
      } else {
        await client.query(
          'UPDATE events SET ticket_quantity = ticket_quantity - $1 WHERE id = $2',
          [quantity, eventId]
        );
      }

      // 7. Record the sale
      await client.query(
        `INSERT INTO recent_sales (
          organizer_id, 
          transaction_id, 
          customer_name, 
          customer_email, 
          event_id, 
          ticket_type, 
          quantity, 
          amount, 
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', NOW())
        RETURNING *`,
        [
          event.organizer_id,
          transactionId,
          customerName,
          customerEmail,
          eventId,
          ticketType ? ticketType.name : 'General Admission',
          quantity,
          totalPrice
        ]
      );

      // 8. Commit the transaction
      await client.query('COMMIT');
      console.log('Transaction committed successfully');

      // 9. Send email with ticket details
      try {
        console.log('Preparing to send email to:', customerEmail);
        
        // Verify email configuration
        if (!process.env.EMAIL_HOST || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
          console.error('Email configuration is missing. Please check your .env file');
          console.log('Current email config:', {
            EMAIL_HOST: process.env.EMAIL_HOST ? 'Set' : 'Missing',
            EMAIL_USERNAME: process.env.EMAIL_USERNAME ? 'Set' : 'Missing',
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'Set' : 'Missing'
          });
        } else {
          console.log('Email configuration verified');
        }
        
        const emailTemplatePath = path.join(__dirname, '../../../email-templates/ticket-confirmation.ejs');
        console.log('Email template path:', emailTemplatePath);
        
        try {
          const fs = await import('fs');
          const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf-8');
          console.log('Successfully read email template');
          
          // Format prices for display
          const formatPrice = (amount) => {
            return new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(amount);
          };

          // Create template data with all required variables
          const templateData = {
            // Event information
            eventName: event.name,
            eventDate: new Date(event.start_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            venue: event.location,
            eventImage: event.image_url ? 'cid:event-image' : null,
            eventDescription: event.description || 'No description available',
            
            // Customer information
            customerName: customerName,
            
            // Ticket information
            ticketNumber: tickets[0].ticket_number,
            ticketType: ticketType ? ticketType.name : 'General Admission',
            quantity: quantity,
            
            // Price information - both raw and formatted
            price: numericUnitPrice,
            formattedPrice: formatPrice(numericUnitPrice),
            totalPrice: numericTotalPrice,
            formattedTotalPrice: formatPrice(numericTotalPrice),
            currency: 'KES',
            
            // App information
            appName: 'Byblos Experience'
          };
          
          // Initialize QR code generator
          const QRCode = (await import('qrcode')).default;
          let qrCodeDataUrl;
          let qrCodeBuffer;
          
          // Generate secure validation URL with event ID and ticket number
          const getBaseUrl = () => {
            // In production, always use the production domain
            if (process.env.NODE_ENV === 'production') {
              return 'https://byblosexperience.vercel.app';
            }
            
            // For development, check environment variables or default to localhost
            const url = process.env.FRONTEND_URL || 'http://localhost:3000';
                        
            // Ensure the base URL doesn't end with a slash
            return url.endsWith('/') ? url.slice(0, -1) : url;
          };
          
          const baseUrl = getBaseUrl();
          console.log('Using base URL for validation:', baseUrl);
          const ticketNumber = encodeURIComponent(tickets[0].ticket_number);
          // Ensure we have a valid event ID
          const eventId = tickets[0].event_id || req.body.eventId;
          if (!eventId) {
            console.error('Missing event ID for ticket validation URL');
            throw new Error('Missing event ID for ticket validation');
          }
          
          // Generate the validation URL that matches our frontend route
          // The frontend expects: /tickets/validate/:ticketNumber
          const validationUrl = `${baseUrl}/tickets/validate/${ticketNumber}?v=${Date.now()}`;
          
          try {
            // Generate QR code with the validation URL as the data
            // This ensures scanning the QR code will directly open the validation URL
            qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
              errorCorrectionLevel: 'H',
              type: 'image/png',
              margin: 1,
              scale: 4
            });
            
            // Convert data URL to buffer for attachment
            const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
            qrCodeBuffer = Buffer.from(base64Data, 'base64');
            
            // Add QR code and validation URL to template data
            templateData.qrCode = qrCodeDataUrl;
            templateData.qrCodeData = validationUrl; // Store the validation URL as QR code data
            templateData.validationUrl = validationUrl;
            
          } catch (qrError) {
            console.error('Error generating QR code:', qrError);
            // Continue without QR code if there's an error
          }
          
          // Log the template data for debugging
          console.log('Template data being passed to email template:', {
            ...templateData,
            qrCode: templateData.qrCode ? '***[QR_CODE_DATA_URL]***' : 'MISSING',
            validationUrl: templateData.validationUrl || 'MISSING',
            // Don't log the entire template data to avoid cluttering the logs
            _priceInfo: 'Price data included',
            _hasTicketData: !!tickets[0]
          });
          
          // Render the email template with the data
          const emailHtml = ejs.render(emailTemplate, templateData);
          console.log('Successfully rendered email template');

          console.log('Sending email...');
          const emailOptions = {
            to: customerEmail,
            subject: `Your Tickets for ${event.name}`,
            html: emailHtml,
            text: `Thank you for your purchase! Here are your ticket details for ${event.name}.`,
            attachments: []
          };
          
          // Add QR code as an attachment if generated successfully
          if (qrCodeBuffer) {
            emailOptions.attachments.push({
              filename: `ticket-${tickets[0].ticket_number}.png`,
              content: qrCodeBuffer,
              cid: 'qrcode' // Content ID to reference in the HTML
            });
          }
          
          // Add event image as an attachment if available
          if (event.image_url) {
            try {
              // Fetch the image from the URL
              const response = await axios.get(event.image_url, { responseType: 'arraybuffer' });
              if (response.status === 200) {
                emailOptions.attachments.push({
                  filename: 'event-image.png',
                  content: response.data,
                  cid: 'event-image', // This should match the cid used in the template
                  contentType: 'image/png'
                });
                console.log('Successfully added event image to email attachments');
              }
            } catch (imageError) {
              console.error('Error adding event image to email:', imageError);
              // Continue without the image if there's an error
            }
          }        
          console.log('Email options:', {
            to: customerEmail,
            subject: emailOptions.subject,
            hasHtml: true,
            hasAttachments: emailOptions.attachments ? emailOptions.attachments.length : 0,
            attachmentName: qrCodeBuffer ? `ticket-${tickets[0].ticket_number}.png` : 'none'
          });
          
          await sendEmail(emailOptions);
          console.log('Confirmation email sent successfully to:', customerEmail);
          
        } catch (templateError) {
          console.error('Error processing email template:', templateError);
          throw templateError;
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', {
          message: emailError.message,
          stack: emailError.stack,
          code: emailError.code,
          response: emailError.response
        });
        // Don't fail the request if email sending fails
      }

      // 10. Prepare response with detailed price information
      const responseData = {
        status: 'success',
        data: {
          message: 'Tickets purchased successfully',
          transactionId,
          tickets: await Promise.all(tickets.map(async t => {
            // Generate QR code data URL
            const QRCode = (await import('qrcode')).default;
            const qrCodeData = `TICKET:${t.ticket_number}:${eventId}:${t.id}`;
            const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
              errorCorrectionLevel: 'H',
              type: 'image/png',
              margin: 1,
              scale: 4
            });
            
            return {
              id: t.id,
              ticketNumber: t.ticket_number,
              eventId,
              eventName: event.name,
              customerName,
              customerEmail,
              ticketType: ticketType ? ticketType.name : 'General Admission',
              price: numericUnitPrice,
              unitPrice: numericUnitPrice,
              totalPrice: numericTotalPrice,
              quantity: quantity,
              purchaseDate: new Date().toISOString(),
              qrCode: qrCodeDataUrl, // Pass the data URL directly
              qrCodeData: qrCodeData // Keep the raw data as well
            };
          })),
          summary: {
            unitPrice: numericUnitPrice,
            quantity: quantity,
            totalPrice: numericTotalPrice,
            currency: 'KES',
            formattedUnitPrice: new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(numericUnitPrice),
            formattedTotalPrice: new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(numericTotalPrice)
          }
        }
      };

      console.log('Sending response with purchase data:', {
        unitPrice: responseData.data.summary.unitPrice,
        totalPrice: responseData.data.summary.totalPrice,
        currency: responseData.data.summary.currency
      });

      return res.status(201).json(responseData);

    } catch (error) {
      console.error('Error processing ticket purchase:', error);
      await client.query('ROLLBACK');
      
      if (error.code === '23505') { // Unique violation
        return next(new AppError('A ticket with this number already exists', 409));
      } else if (error.code === '23503') { // Foreign key violation
        return next(new AppError('Invalid reference in ticket data', 400));
      }
      
      return next(new AppError('Failed to process ticket purchase', 500));
    }
    
  } catch (error) {
    console.error('Unexpected error in purchaseTickets:', error);
    return next(new AppError('An unexpected error occurred', 500));
    
  } finally {
    client.release();
  }
};

/**
 * Get ticket types for an event
 */
export const getEventTicketTypes = async (req, res, next) => {
  const { eventId } = req.params;
  
  try {
    console.log('Fetching ticket types for event ID:', eventId);
    
    const query = `
      SELECT * FROM ticket_types 
      WHERE event_id = $1 
        AND (sales_start_date IS NULL OR sales_start_date <= NOW())
        AND (sales_end_date IS NULL OR sales_end_date >= NOW())
      ORDER BY price ASC`;
      
    console.log('Executing query:', query, 'with params:', [eventId]);
    const result = await pool.query(query, [eventId]);
    
    console.log(`Found ${result.rows.length} ticket types for event ${eventId}`);
    
    res.status(200).json({
      status: 'success',
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching ticket types:', error);
    next(new AppError('Failed to fetch ticket types: ' + error.message, 500));
  }
};
