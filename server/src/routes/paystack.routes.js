const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../config/database');
const crypto = require('crypto');

// Verify Paystack payment and create ticket
router.post('/verify-paystack', authMiddleware, async (req, res) => {
  try {
    const {
      reference,
      eventId,
      ticketTypeId,
      quantity,
      customerName,
      customerEmail,
      phoneNumber,
      amount,
      ticketTypeName,
      discountCode,
      discountAmount
    } = req.body;

    console.log('=== PAYSTACK PAYMENT VERIFICATION ===');
    console.log('Payment data:', { reference, eventId, ticketTypeId, quantity, amount });

    // Verify payment with Paystack
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({
        success: false,
        message: 'Paystack secret key not configured'
      });
    }

    const https = require('https');
    const verificationUrl = `https://api.paystack.co/transaction/verify/${reference}`;

    const verificationResponse = await new Promise((resolve, reject) => {
      const req = https.request(verificationUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      }, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log('Paystack verification response:', verificationResponse);

    if (!verificationResponse.status || verificationResponse.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Verify amount matches
    const paidAmount = verificationResponse.data.amount / 100; // Convert from kobo to KES
    if (Math.abs(paidAmount - amount) > 1) { // Allow small difference due to rounding
      return res.status(400).json({
        success: false,
        message: 'Payment amount mismatch'
      });
    }

    // Start transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Check ticket availability
      const ticketQuery = `
        SELECT id, name, price, available, quantity_available, max_per_order, min_per_order
        FROM event_ticket_types 
        WHERE id = $1 AND event_id = $2
      `;
      const ticketResult = await client.query(ticketQuery, [ticketTypeId, eventId]);
      
      if (ticketResult.rows.length === 0) {
        throw new Error('Ticket type not found');
      }

      const ticket = ticketResult.rows[0];
      const available = ticket.available !== null ? ticket.available : ticket.quantity_available;

      if (available < quantity) {
        throw new Error('Insufficient tickets available');
      }

      // Create ticket purchase record
      const purchaseQuery = `
        INSERT INTO ticket_purchases (
          event_id, ticket_type_id, quantity, customer_name, customer_email, 
          phone_number, amount_paid, payment_method, payment_reference, 
          purchase_status, discount_code, discount_amount, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING id
      `;
      
      const purchaseResult = await client.query(purchaseQuery, [
        eventId,
        ticketTypeId,
        quantity,
        customerName,
        customerEmail,
        phoneNumber,
        amount,
        'paystack',
        reference,
        'completed',
        discountCode || null,
        discountAmount || null
      ]);

      const purchaseId = purchaseResult.rows[0].id;

      // Generate tickets
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const qrCode = crypto.randomBytes(32).toString('hex');
        
        const ticketQuery = `
          INSERT INTO tickets (
            purchase_id, ticket_number, qr_code, status, created_at
          ) VALUES ($1, $2, $3, $4, NOW())
          RETURNING id
        `;
        
        const ticketResult = await client.query(ticketQuery, [
          purchaseId,
          ticketNumber,
          qrCode,
          'active'
        ]);
        
        tickets.push({
          id: ticketResult.rows[0].id,
          ticketNumber,
          qrCode
        });
      }

      // Update ticket availability
      const updateQuery = `
        UPDATE event_ticket_types 
        SET available = available - $1, sold = COALESCE(sold, 0) + $1
        WHERE id = $2
      `;
      await client.query(updateQuery, [quantity, ticketTypeId]);

      // Update event statistics
      const eventStatsQuery = `
        UPDATE events 
        SET tickets_sold = COALESCE(tickets_sold, 0) + $1
        WHERE id = $2
      `;
      await client.query(eventStatsQuery, [quantity, eventId]);

      await client.query('COMMIT');

      console.log('Paystack payment processed successfully:', {
        purchaseId,
        reference,
        ticketCount: tickets.length
      });

      // Send confirmation email (this would be implemented separately)
      // await sendConfirmationEmail(customerEmail, tickets, event);

      res.json({
        success: true,
        message: 'Payment verified and tickets created successfully',
        data: {
          purchaseId,
          reference,
          tickets,
          ticketCount: tickets.length
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Paystack payment verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
});

module.exports = router;
