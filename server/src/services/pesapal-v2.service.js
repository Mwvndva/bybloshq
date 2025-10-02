import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import Order from '../models/order.model.js';

class PesapalV2Service {
  constructor() {
    this.config = this.initializePesapal();
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  initializePesapal() {
    const config = {
      consumerKey: process.env.PESAPAL_CONSUMER_KEY,
      consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
      env: process.env.PESAPAL_ENV || 'sandbox',
      baseUrl: process.env.PESAPAL_BASE_URL || 
        (process.env.PESAPAL_ENV === 'live' 
          ? 'https://pay.pesapal.com/v3' 
          : 'https://cybqa.pesapal.com/pesapalv3'),
      ipnUrl: process.env.PESAPAL_IPN_URL || `${process.env.BACKEND_URL}/api/payments/pesapal/ipn`,
      callbackUrl: process.env.PESAPAL_CALLBACK_URL || `${process.env.FRONTEND_URL}/checkout/callback`,
      cancellationUrl: process.env.PESAPAL_CANCELLATION_URL || `${process.env.FRONTEND_URL}/checkout/cancelled`
    };

    if (!config.consumerKey || !config.consumerSecret) {
      logger.warn('Pesapal credentials not fully configured');
      config.enabled = false;
    } else {
      config.enabled = true;
      logger.info('PesapalV2 service initialized', { env: config.env });
    }

    return config;
  }

  /**
   * Generate a unique reference for payments
   * @returns {string} Unique reference
   */
  generateReference(prefix = 'BYB') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get or refresh Pesapal access token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    // Return cached token if it's still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > Date.now() + 300000) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/Auth/RequestToken`,
        null,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64')}`
          }
        }
      );

      if (response.data && response.data.token) {
        this.accessToken = response.data.token;
        // Set token expiry (usually 1 hour)
        this.tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
        return this.accessToken;
      }

      throw new Error('Invalid token response from Pesapal');
    } catch (error) {
      logger.error('Error getting Pesapal access token:', {
        error: error.message,
        response: error.response?.data
      });
      throw new Error('Failed to authenticate with Pesapal');
    }
  }

  /**
   * Register IPN (Instant Payment Notification) URL
   * @returns {Promise<Object>} IPN registration response
   */
  async registerIPN() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.config.baseUrl}/api/URLSetup/RegisterIPN`,
        {
          url: this.config.ipnUrl,
          ipn_notification_type: 'POST'
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error registering IPN:', {
        error: error.message,
        response: error.response?.data
      });
      throw new Error('Failed to register IPN with Pesapal');
    }
  }

  /**
   * Submit payment request to Pesapal
   * @param {Object} order - Order details
   * @param {string} order.id - Order ID
   * @param {string} order.reference - Order reference
   * @param {number} order.amount - Order amount
   * @param {string} order.currency - Currency code (e.g., KES)
   * @param {string} order.description - Order description
   * @param {Object} customer - Customer details
   * @param {string} customer.firstName - Customer first name
   * @param {string} customer.lastName - Customer last name
   * @param {string} customer.email - Customer email
   * @param {string} customer.phone - Customer phone number
   * @param {Object} billingAddress - Billing address
   * @param {string} billingAddress.firstName - First name
   * @param {string} billingAddress.lastName - Last name
   * @param {string} billingAddress.email - Email
   * @param {string} billingAddress.phone - Phone number
   * @param {string} billingAddress.countryCode - Country code (e.g., KE)
   * @param {string} billingAddress.postalCode - Postal code
   * @param {string} billingAddress.address - Street address
   * @returns {Promise<Object>} Payment submission response
   */
  async submitPayment(order, customer, billingAddress) {
    try {
      const token = await this.getAccessToken();
      
      const paymentData = {
        id: order.reference,
        currency: order.currency || 'KES',
        amount: parseFloat(order.amount).toFixed(2),
        description: order.description || `Payment for order ${order.reference}`,
        callback_url: this.config.callbackUrl,
        cancellation_url: this.config.cancellationUrl,
        notification_id: this.config.ipnId, // Should be obtained after registering IPN
        billing_address: {
          email_address: billingAddress.email || customer.email,
          phone_number: billingAddress.phone || customer.phone || '',
          country_code: billingAddress.countryCode || 'KE',
          first_name: billingAddress.firstName || customer.firstName,
          middle_name: '',
          last_name: billingAddress.lastName || customer.lastName,
          line_1: billingAddress.address || 'N/A',
          line_2: '',
          city: billingAddress.city || 'Nairobi',
          state: billingAddress.state || 'Nairobi',
          postal_code: billingAddress.postalCode || '00100',
          zip_code: billingAddress.postalCode || '00100'
        }
      };

      const response = await axios.post(
        `${this.config.baseUrl}/api/Transactions/SubmitOrderRequest`,
        paymentData,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error submitting payment to Pesapal:', {
        error: error.message,
        response: error.response?.data,
        orderId: order.id,
        reference: order.reference
      });
      throw new Error('Failed to submit payment to Pesapal');
    }
  }

  /**
   * Verify payment status from Pesapal
   * @param {string} orderTrackingId - Order tracking ID from Pesapal
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(orderTrackingId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.config.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error verifying Pesapal payment:', {
        error: error.message,
        response: error.response?.data,
        orderTrackingId
      });
      throw new Error('Failed to verify payment status');
    }
  }

  /**
   * Handle IPN (Instant Payment Notification) from Pesapal
   * @param {Object} notification - IPN data
   * @param {string} notification.order_tracking_id - Order tracking ID
   * @param {string} notification.order_notification_type - Notification type
   * @returns {Promise<Object>} IPN handling result
   */
  async handleIPN(notification) {
    try {
      const { order_tracking_id: orderTrackingId, order_notification_type: notificationType } = notification;
      
      logger.info('Received IPN from Pesapal:', { orderTrackingId, notificationType });

      // Verify the payment status
      const paymentStatus = await this.verifyPayment(orderTrackingId);
      
      // Find the order by the tracking ID (reference)
      const order = await Order.findByReference(orderTrackingId);
      
      if (!order) {
        logger.error('Order not found for IPN:', { orderTrackingId });
        return { success: false, error: 'Order not found' };
      }

      // Update order status based on payment status
      let orderStatus = order.status;
      let paymentStatusValue = order.payment_status;

      switch (paymentStatus.payment_status_description?.toUpperCase()) {
        case 'COMPLETED':
          paymentStatusValue = 'COMPLETED';
          orderStatus = 'PENDING'; // Set to PENDING instead of PAID
          break;
        case 'FAILED':
          paymentStatusValue = 'FAILED';
          orderStatus = 'CANCELLED';
          break;
        case 'PENDING':
          paymentStatusValue = 'PENDING';
          orderStatus = 'PENDING';
          break;
        default:
          logger.warn('Unknown payment status:', paymentStatus.payment_status_description);
          paymentStatusValue = 'PENDING';
          orderStatus = 'PENDING';
      }

      // Update order in database
      const updatedOrder = await Order.updatePaymentStatus(order.id, paymentStatusValue, orderTrackingId);
      
      if (orderStatus !== order.status) {
        await Order.updateOrderStatus(order.id, orderStatus, 'Payment status updated via IPN');
      }

      logger.info('Order updated from IPN:', {
        orderId: order.id,
        reference: order.reference,
        previousStatus: order.status,
        newStatus: orderStatus,
        paymentStatus: paymentStatusValue
      });

      return { success: true, order: updatedOrder };
    } catch (error) {
      logger.error('Error handling Pesapal IPN:', {
        error: error.message,
        notification,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate platform fee and seller payout
   * @param {number} amount - Order amount
   * @returns {Object} Fee and payout details
   */
  calculateFees(amount) {
    const platformFee = parseFloat((amount * 0.09).toFixed(2)); // 9% platform fee
    const sellerPayout = parseFloat((amount - platformFee).toFixed(2));
    
    return {
      platformFee,
      sellerPayout,
      originalAmount: amount
    };
  }
}

export default new PesapalV2Service();
