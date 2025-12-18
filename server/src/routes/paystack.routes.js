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
        SELECT id, name, price, quantity
        FROM event_ticket_types 
        WHERE id = $1 AND event_id = $2
      `;
      const ticketResult = await client.query(ticketQuery, [ticketTypeId, eventId]);

      if (ticketResult.rows.length === 0) {
        throw new Error('Ticket type not found');
      }

      const ticket = ticketResult.rows[0];

      // Calculate availability manually since available column doesn't exist
      const soldResult = await client.query('SELECT COUNT(*) FROM tickets WHERE ticket_type_id = $1 AND status = \'paid\'', [ticketTypeId]);
      const soldCount = parseInt(soldResult.rows[0].count, 10);
      const available = ticket.quantity - soldCount;

      if (available < quantity) {
        throw new Error('Insufficient tickets available');
      }

      // Record the payment details in the payments table instead of non-existent ticket_purchases
      // We'll update the metadata with additional purchase info
      const paymentMetadata = {
        quantity,
        customerName,
        phoneNumber,
        ticketTypeName,
        discountCode,
        discountAmount,
        customerEmail
      };

      const updatePaymentQuery = `
        UPDATE payments 
        SET status = 'success',
            metadata = $1,
            provider_reference = $2,
            updated_at = NOW()
        WHERE invoice_id = $2
        RETURNING id
      `;

      let paymentResult = await client.query(updatePaymentQuery, [JSON.stringify(paymentMetadata), reference]);

      // If payment record wasn't found (e.g. created by different flow), create it
      if (paymentResult.rows.length === 0) {
        const insertPaymentQuery = `
          INSERT INTO payments (
            invoice_id, amount, status, payment_method, email, 
            event_id, metadata, provider_reference, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $1, NOW(), NOW())
          RETURNING id
        `;
        paymentResult = await client.query(insertPaymentQuery, [
          reference, amount, 'success', 'card', customerEmail, eventId, JSON.stringify(paymentMetadata)
        ]);
      }

      const paymentId = paymentResult.rows[0].id;

      // Generate tickets
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const qrCode = crypto.randomBytes(32).toString('hex');

        const ticketQuery = `
          INSERT INTO tickets (
            payment_id, event_id, organizer_id, ticket_type_id, ticket_type_name,
            customer_name, customer_email, price, ticket_number, qr_code, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING id
        `;

        const ticketResult = await client.query(ticketQuery, [
          paymentId,
          eventId,
          null, // organizer_id should be fetched if needed, but keeping it null for now or fetch it
          ticketTypeId,
          ticketTypeName,
          customerName,
          customerEmail,
          amount / quantity, // approximate unit price
          ticketNumber,
          qrCode,
          'paid'
        ]);

        tickets.push({
          id: ticketResult.rows[0].id,
          ticketNumber,
          qrCode
        });
      }

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
