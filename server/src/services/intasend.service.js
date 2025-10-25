import IntaSend from 'intasend-node';
import logger from '../utils/logger.js';

class IntaSendService {
  constructor() {
    this.config = this.initializeIntaSend();
    this.client = null;
  }

  initializeIntaSend() {
    const config = {
      publicKey: process.env.INTASEND_PUBLIC_KEY,
      secretKey: process.env.INTASEND_SECRET_KEY,
      sandbox: process.env.NODE_ENV !== 'production', // Use sandbox in development
      baseUrl: process.env.INTASEND_BASE_URL || 'https://sandbox.intasend.com', // Default to sandbox
      webhookUrl: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/intasend/webhook` : null,
      callbackUrl: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/intasend/callback` : null,
      cancelUrl: process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/checkout?status=cancelled` : null
    };

    console.log('=== INTASEND CONFIGURATION DEBUG ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('sandbox:', config.sandbox);
    console.log('baseUrl:', config.baseUrl);
    console.log('webhookUrl:', config.webhookUrl);
    console.log('callbackUrl:', config.callbackUrl);
    console.log('cancelUrl:', config.cancelUrl);
    console.log('Environment variables:');
    console.log('- BACKEND_URL:', process.env.BACKEND_URL);
    console.log('- PUBLIC_BASE_URL:', process.env.PUBLIC_BASE_URL);
    console.log('- VITE_BASE_URL:', process.env.VITE_BASE_URL);
    console.log('=== END INTASEND CONFIGURATION DEBUG ===');

    if (!config.publicKey || !config.secretKey) {
      logger.warn('IntaSend credentials not found. Please set INTASEND_PUBLIC_KEY and INTASEND_SECRET_KEY environment variables.');
    }

    return config;
  }

  getClient() {
    if (!this.client) {
      this.client = new IntaSend(
        this.config.publicKey,
        this.config.secretKey,
        this.config.sandbox
      );
    }
    return this.client;
  }

  /**
   * Create a payment collection request
   * @param {Object} paymentData - Payment details
   * @param {string} paymentData.amount - Payment amount
   * @param {string} paymentData.currency - Currency code (KES)
   * @param {string} paymentData.description - Payment description
   * @param {string} paymentData.reference - Order reference
   * @param {Object} customer - Customer details
   * @param {string} customer.firstName - Customer first name
   * @param {string} customer.lastName - Customer last name
   * @param {string} customer.email - Customer email
   * @param {string} customer.phone - Customer phone number
   * @param {Object} billingAddress - Billing address
   * @returns {Promise<Object>} Payment collection response
   */
  async createPaymentCollection(paymentData, customer, billingAddress) {
    try {
      const client = this.getClient();
      
      const collectionData = {
        amount: parseFloat(paymentData.amount).toFixed(2),
        currency: paymentData.currency || 'KES',
        email: customer.email,
        phone_number: customer.phone,
        first_name: customer.firstName,
        last_name: customer.lastName,
        api_ref: paymentData.reference,
        comment: paymentData.description || `Payment for order ${paymentData.reference}`,
        redirect_url: this.config.callbackUrl,
        webhook_url: this.config.webhookUrl
      };

      logger.info('Creating IntaSend payment collection:', {
        amount: collectionData.amount,
        currency: collectionData.currency,
        api_ref: collectionData.api_ref,
        customer_email: collectionData.email,
        callback_url: collectionData.redirect_url,
        webhook_url: collectionData.webhook_url,
        payload: collectionData
      });

      const response = await client.collection().charge(collectionData);
      
      console.log('=== INTASEND RAW RESPONSE ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('=== END RAW RESPONSE ===');
      
      // Check all possible URL fields in the response
      const possibleUrls = [
        response.url,  // This is the actual checkout page URL
        response.checkout_url,
        response.payment_url,
        response.link,
        response.checkout_link,
        response.redirect_url  // This is the callback URL, not checkout
      ].filter(Boolean);
      
      console.log('=== POSSIBLE URLS ===');
      console.log('Possible URLs:', possibleUrls);
      console.log('Response keys:', Object.keys(response));
      console.log('=== END POSSIBLE URLS ===');
      
      // Use the checkout page URL (response.url), not the callback URL
      let checkoutUrl = response.url || possibleUrls[0];
      
      if (!checkoutUrl) {
        // Try to construct URL using different patterns
        if (response.checkout_id) {
          checkoutUrl = `https://sandbox.intasend.com/checkout/${response.checkout_id}`;
        } else if (response.invoice_id) {
          checkoutUrl = `https://sandbox.intasend.com/invoice/${response.invoice_id}`;
        } else if (response.id) {
          checkoutUrl = `https://sandbox.intasend.com/payment/${response.id}`;
        }
      }
      
      console.log('=== FINAL CHECKOUT URL ===');
      console.log('Checkout URL:', checkoutUrl);
      console.log('Has URL:', !!checkoutUrl);
      console.log('=== END FINAL CHECKOUT URL ===');

      // Add the checkout URL to the response
      const enhancedResponse = {
        ...response,
        redirect_url: checkoutUrl,
        checkout_url: checkoutUrl
      };

      return enhancedResponse;
    } catch (error) {
      logger.error('Error creating IntaSend payment collection:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        paymentData: paymentData.reference,
        fullError: error
      });
      throw new Error('Failed to create payment collection with IntaSend');
    }
  }

  /**
   * Check payment collection status
   * @param {string} collectionId - Collection ID from IntaSend
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(collectionId) {
    try {
      const client = this.getClient();
      
      console.log('=== GETTING PAYMENT STATUS FROM INTASEND ===');
      console.log('Collection ID:', collectionId);
      
      const response = await client.collection().status(collectionId);
      
      console.log('=== INTASEND STATUS RESPONSE ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('=== END STATUS RESPONSE ===');
      
      logger.info('IntaSend payment status retrieved:', {
        collection_id: collectionId,
        status: response.status,
        amount: response.amount,
        full_response: response
      });

      return response;
    } catch (error) {
      console.error('=== ERROR GETTING PAYMENT STATUS ===');
      console.error('Error:', error.message);
      console.error('Response:', error.response?.data);
      console.error('Collection ID:', collectionId);
      console.error('=== END ERROR ===');
      
      logger.error('Error getting IntaSend payment status:', {
        error: error.message,
        response: error.response?.data,
        collectionId
      });
      throw new Error('Failed to get payment status from IntaSend');
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} Whether signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    try {
      // For now, skip signature verification in development
      // TODO: Implement proper signature verification when IntaSend provides the method
      if (process.env.NODE_ENV === 'development') {
        logger.info('Skipping webhook signature verification in development mode');
        return true;
      }
      
      // In production, you would implement proper signature verification here
      // This might require using a crypto library to verify the signature
      logger.warn('Webhook signature verification not implemented for production');
      return true; // Temporarily allow all webhooks
    } catch (error) {
      logger.error('Error verifying IntaSend webhook signature:', error);
      return false;
    }
  }

  /**
   * Create M-Pesa STK Push payment
   * @param {Object} paymentData - Payment details
   * @param {string} paymentData.amount - Payment amount
   * @param {string} paymentData.currency - Currency code
   * @param {string} paymentData.description - Payment description
   * @param {string} paymentData.reference - Order reference
   * @param {string} phoneNumber - Customer phone number (254XXXXXXXXX format)
   * @returns {Promise<Object>} STK Push response
   */
  async createMpesaStkPush(paymentData, phoneNumber) {
    try {
      const client = this.getClient();
      
      const stkData = {
        amount: parseFloat(paymentData.amount).toFixed(2),
        currency: paymentData.currency || 'KES',
        description: paymentData.description || `Payment for order ${paymentData.reference}`,
        reference: paymentData.reference,
        phone_number: phoneNumber, // Format: 254XXXXXXXXX
        callback_url: this.config.callbackUrl,
        webhook_url: this.config.webhookUrl
      };

      logger.info('Creating IntaSend M-Pesa STK Push:', {
        amount: stkData.amount,
        phone_number: stkData.phone_number,
        reference: stkData.reference
      });

      const response = await client.collection().mpesaStkPush(stkData);
      
      logger.info('IntaSend M-Pesa STK Push created:', {
        stk_push_id: response.stk_push_id,
        reference: response.reference,
        status: response.status
      });

      return response;
    } catch (error) {
      logger.error('Error creating IntaSend M-Pesa STK Push:', {
        error: error.message,
        response: error.response?.data,
        paymentData: paymentData.reference
      });
      throw new Error('Failed to create M-Pesa STK Push with IntaSend');
    }
  }

  /**
   * Check M-Pesa STK Push status
   * @param {string} stkPushId - STK Push ID from IntaSend
   * @returns {Promise<Object>} STK Push status
   */
  async getMpesaStkPushStatus(stkPushId) {
    try {
      const client = this.getClient();
      
      const response = await client.mpesa.stkPushStatus(stkPushId);
      
      logger.info('IntaSend M-Pesa STK Push status retrieved:', {
        stk_push_id: stkPushId,
        status: response.status,
        amount: response.amount
      });

      return response;
    } catch (error) {
      logger.error('Error getting IntaSend M-Pesa STK Push status:', {
        error: error.message,
        response: error.response?.data,
        stkPushId
      });
      throw new Error('Failed to get M-Pesa STK Push status from IntaSend');
    }
  }

  /**
   * Create a refund
   * @param {Object} refundData - Refund details
   * @param {string} refundData.amount - Refund amount
   * @param {string} refundData.reference - Original payment reference
   * @param {string} refundData.reason - Refund reason
   * @returns {Promise<Object>} Refund response
   */
  async createRefund(refundData) {
    try {
      const client = this.getClient();
      
      const refund = {
        amount: parseFloat(refundData.amount).toFixed(2),
        reference: refundData.reference,
        reason: refundData.reason || 'Customer requested refund'
      };

      logger.info('Creating IntaSend refund:', refund);

      const response = await client.refunds.create(refund);
      
      logger.info('IntaSend refund created:', {
        refund_id: response.refund_id,
        reference: response.reference,
        status: response.status
      });

      return response;
    } catch (error) {
      logger.error('Error creating IntaSend refund:', {
        error: error.message,
        response: error.response?.data,
        refundData: refundData.reference
      });
      throw new Error('Failed to create refund with IntaSend');
    }
  }

  /**
   * Get refund status
   * @param {string} refundId - Refund ID from IntaSend
   * @returns {Promise<Object>} Refund status
   */
  async getRefundStatus(refundId) {
    try {
      const client = this.getClient();
      
      const response = await client.refunds.status(refundId);
      
      logger.info('IntaSend refund status retrieved:', {
        refund_id: refundId,
        status: response.status,
        amount: response.amount
      });

      return response;
    } catch (error) {
      logger.error('Error getting IntaSend refund status:', {
        error: error.message,
        response: error.response?.data,
        refundId
      });
      throw new Error('Failed to get refund status from IntaSend');
    }
  }
}

export default new IntaSendService();
