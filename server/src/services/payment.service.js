import logger from '../utils/logger.js';
import axios from 'axios';
import crypto from 'crypto';
import PaymentCompletionService from './paymentCompletion.service.js';
import Payment from '../models/payment.model.js';
import Order from '../models/order.model.js';
import { pool } from '../config/database.js';
import {
  sendProductOrderConfirmationEmail,
  sendNewOrderNotificationEmail
} from '../utils/email.js';
import whatsappService from './whatsapp.service.js';

class PaymentService {
  async initiatePayment(paymentData) {
    try {
      console.log('=== PAYMENT SERVICE INITIATE PAYMENT (PAYD) ===');
      console.log('Payment data:', paymentData);

      const username = process.env.PAYD_USERNAME;
      const password = process.env.PAYD_PASSWORD;
      let networkCode = process.env.PAYD_NETWORK_CODE;
      const channelId = process.env.PAYD_CHANNEL_ID;

      if (!username || !password || !channelId) {
        throw new Error('PAYD credentials (USERNAME, PASSWORD, CHANNEL_ID) not fully configured');
      }

      // If network code is missing, try to fetch it dynamically
      if (!networkCode) {
        try {
          console.log('PAYD_NETWORK_CODE not set, attempting to fetch from API...');
          const networks = await this.getPaymentNetworks(username, password);

          let mpesaNetwork;
          const networkGroups = networks.mobile || networks['Mobile Money'] || networks;

          if (Array.isArray(networkGroups)) {
            mpesaNetwork = networkGroups.find(n => n.name?.toLowerCase().includes('mpesa') || n.network_name?.toLowerCase().includes('mpesa'));
          }

          if (mpesaNetwork && mpesaNetwork.network_code) {
            networkCode = mpesaNetwork.network_code;
            console.log(`Dynamically resolved M-PESA Network Code: ${networkCode}`);
          }
        } catch (netError) {
          console.error('Failed to fetch networks:', netError.message);
        }
      }

      if (!networkCode) {
        throw new Error('PAYD_NETWORK_CODE is missing and could not be resolved dynamically.');
      }

      let phoneNumber = paymentData.phone;
      if (phoneNumber.startsWith('7') || phoneNumber.startsWith('1')) {
        phoneNumber = '0' + phoneNumber;
      }

      const paydData = {
        username: "payd",
        network_code: networkCode,
        account_name: `${paymentData.firstName} ${paymentData.lastName}`.trim(),
        account_number: phoneNumber,
        amount: parseFloat(paymentData.amount),
        phone_number: phoneNumber,
        channel_id: channelId,
        narration: paymentData.narrative || 'Ticket Purchase',
        currency: 'KES',
        currency: 'KES',
        callback_url: `${process.env.BACKEND_URL || process.env.API_URL || 'https://api.byblos.com'}/api/payments/webhook/payd`,
        transaction_channel: 'mobile',
        transaction_channel: 'mobile',
        customer_info: {
          name: `${paymentData.firstName} ${paymentData.lastName}`.trim(),
          email: paymentData.email,
          phone: phoneNumber,
          country: "Kenya"
        }
      };

      console.log('Sending request to PAYD:', JSON.stringify(paydData, null, 2));

      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      const response = await axios.post('https://api.mypayd.app/api/v3/payments', paydData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        }
      });

      console.log('PAYD Response:', response.data);

      if (response.data) {
        const paydRef = response.data.transaction_reference || response.data.ref || response.data.reference || paymentData.invoice_id;

        return {
          invoice_id: paymentData.invoice_id,
          reference: paydRef,
          authorization_url: null,
          status: 'pending',
          message: 'Payment initiated. Check your phone.'
        };
      } else {
        throw new Error('Invalid response from PAYD');
      }

    } catch (error) {
      if (error.response) {
        logger.error('PAYD API Error:', error.response.status, error.response.data);
      } else {
        logger.error('Error initiating PAYD payment:', error.message);
      }
      throw error;
    }
  }

  async getPaymentNetworks(username, password) {
    try {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      return (await axios.get('https://api.mypayd.app/api/v3/networks/grouped?dial_code=254&transaction_type=PAYMENT', {
        headers: { 'Authorization': `Basic ${auth}` }
      })).data;
    } catch (error) {
      logger.error('Error fetching PAYD networks:', error.response?.data || error.message);
      throw error;
    }
  }

  async checkPaymentStatus(paymentId) {
    try {
      let payment;
      if (String(paymentId).startsWith('INV-') || String(paymentId).startsWith('ORD-')) {
        payment = await Payment.findByInvoiceId(paymentId);
      } else {
        payment = await Payment.findByReference(paymentId) || await Payment.findById(paymentId);
      }

      if (payment) {
        return {
          state: payment.status === 'success' || payment.status === 'completed' ? 'completed' : 'pending',
          status: payment.status,
          invoice_id: payment.invoice_id,
          reference: payment.provider_reference,
          amount: payment.amount,
          message: `Payment ${payment.status}`
        };
      }

      return { state: 'pending', status: 'unknown', message: 'Payment not found or pending' };

    } catch (error) {
      logger.error('Error checking payment status:', error);
      throw error;
    }
  }

  async handlePaydWebhook(webhookData, headers, clientIp) {
    try {
      console.log('=== PAYD WEBHOOK RECEIVED ===');
      console.log('Data:', JSON.stringify(webhookData, null, 2));

      // PAYD Payload Mapping
      const ref = webhookData.transaction_reference || webhookData.ref || webhookData.reference || webhookData.transaction_id;
      const resultCode = webhookData.result_code; // 200 or 0 = Success
      const status = webhookData.status || ((resultCode === 200 || resultCode === 0) ? 'SUCCESS' : 'FAILED');

      if (!ref) {
        logger.warn('Webhook received without reference');
        return { status: 'ignored', message: 'No reference found' };
      }

      const txData = {
        reference: ref,
        amount: webhookData.amount,
        status: status,
        customer: { email: webhookData.email || webhookData.customer_email || 'unknown@payd.app' },
        paid_at: webhookData.transaction_date || new Date().toISOString(),
        metadata: webhookData.metadata || {}
      };

      if (status === 'SUCCESS' || status === 'successful' || status === 'COMPLETED' || resultCode === 200) {
        return this.handleSuccessfulPayment(txData);
      } else {
        return { ...txData, status: 'failed', message: webhookData.remarks || 'Payment failed' };
      }

    } catch (error) {
      logger.error('Error processing PAYD webhook:', error);
      throw error;
    }
  }

  async handleSuccessfulPayment(data) {
    logger.info('Payment successful', {
      reference: data.reference,
      amount: data.amount
    });

    await this.processPaymentCompletion(data);

    return {
      status: 'success',
      reference: data.reference
    };
  }

  async processPaymentCompletion(data) {
    try {
      logger.info('=== PAYMENT COMPLETION PROCESS START ===', {
        reference: data.reference,
        status: data.status
      });

      let payment = await Payment.findByReference(data.reference);

      if (!payment) {
        logger.error('Payment not found for reference:', data.reference);
        return;
      }

      if (payment.status === 'success') {
        logger.info('Payment already marked success. Skipping.');
        return;
      }

      await Payment.updateStatus(payment.invoice_id, 'success', {
        provider_data: data,
        completed_at: new Date().toISOString()
      });

      const metadata = payment.metadata || {};

      if (metadata.product_id || metadata.order_id) {
        await this.processProductOrderCompletion(payment, data);
      } else if (payment.ticket_id || payment.event_id) {
        await PaymentCompletionService.processSuccessfulPayment(payment);
      } else {
        logger.warn('Unknown payment type');
      }

      logger.info('Payment completion processed successfully');

    } catch (error) {
      logger.error('Error processing payment completion:', error);
    }
  }

  async processProductOrderCompletion(payment, providerData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const metadata = payment.metadata || {};
      let orderId = metadata.order_id;

      if (!orderId) {
        logger.error('No order_id found in payment metadata');
        await client.query('ROLLBACK');
        return;
      }

      const lockId = 200000 + parseInt(orderId);
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

      const orderQuery = `
        SELECT o.*, s.email as seller_email, s.full_name as seller_name, s.phone as seller_phone, s.location as seller_location, s.city as seller_city
        FROM product_orders o
        JOIN sellers s ON o.seller_id = s.id
        WHERE o.id = $1 FOR UPDATE
      `;
      const { rows } = await client.query(orderQuery, [orderId]);
      const order = rows[0];

      if (!order) {
        await client.query('ROLLBACK');
        return;
      }

      const itemsQuery = `
        SELECT oi.*, p.is_digital, p.product_type
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [orderId]);
      order.items = itemsResult.rows;

      if (order.payment_status === 'success') {
        await client.query('ROLLBACK');
        return;
      }

      let newStatus = 'DELIVERY_PENDING';
      const allDigital = order.items.every(item => (item.product_type || '').toLowerCase() === 'digital' || item.is_digital);
      const isService = order.items.some(item => (item.product_type || '').toLowerCase() === 'service');

      if (allDigital) newStatus = 'COMPLETED';
      else if (isService) newStatus = 'SERVICE_PENDING';

      await client.query(
        `UPDATE product_orders 
         SET payment_status = $1,
             payment_reference = $2,
             paid_at = NOW(),
             status = $3,
             updated_at = NOW()
         WHERE id = $4`,
        ['success', providerData.reference, newStatus, order.id]
      );

      await client.query(
        `UPDATE sellers 
         SET total_sales = total_sales + 1,
             net_revenue = net_revenue + $1,
             balance = balance + $2,
             updated_at = NOW()
         WHERE id = $3`,
        [order.total_amount, order.seller_payout_amount, order.seller_id]
      );

      await client.query('COMMIT');

      try {
        await sendProductOrderConfirmationEmail(order.buyer_email, order);
        if (order.seller_email) await sendNewOrderNotificationEmail(order.seller_email, order);

        if (whatsappService.isClientReady && whatsappService.isClientReady()) {
          await whatsappService.notifySellerNewOrder({
            seller: {
              phone: order.seller_phone,
              full_name: order.seller_name,
              location: order.seller_location,
              city: order.seller_city
            },
            order: {
              orderNumber: order.order_number,
              totalAmount: order.total_amount,
              metadata: order.metadata
            },
            items: order.items
          });

          const buyerPhone = order.buyer_phone || payment.phone_number || payment.metadata?.phone;
          if (buyerPhone) {
            await whatsappService.notifyBuyerOrderConfirmation({
              buyer: { phone: buyerPhone, full_name: order.buyer_name },
              seller: { location: order.seller_location, city: order.seller_city, shop_name: order.seller_name },
              order: { orderNumber: order.order_number, totalAmount: order.total_amount, metadata: order.metadata },
              items: order.items
            });
          }
        }
      } catch (e) {
        logger.error('Error triggering notifications:', e);
      }

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logger.error('Error processing product order completion:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new PaymentService();
