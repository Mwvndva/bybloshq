import paystackService from './paystack.service.js';
import logger from '../utils/logger.js';

class PaymentService {
  constructor() {
    logger.info('Payment Service initialized with Paystack');
  }

  /**
   * Initiate Paystack payment
   * @param {Object} paymentData - Payment details
   * @param {string} paymentData.email - Customer email
   * @param {number} paymentData.amount - Amount to charge (in main currency unit, e.g., KES)
   * @param {string} paymentData.reference - Transaction reference (invoice_id)
   * @param {string} paymentData.callback_url - Callback URL after payment
   * @param {Object} paymentData.metadata - Additional metadata
   * @returns {Promise<Object>} Payment response with access_code
   */
  async initiatePayment({ email, amount, reference, callback_url, metadata = {} }) {
    try {
      logger.info(`Initiating Paystack payment for ${email}, amount: ${amount}, reference: ${reference}`);
      
      const response = await paystackService.initializeTransaction({
        email,
        amount,
        reference,
        callback_url,
        metadata
      });
      
      logger.info('Paystack payment initiated successfully', {
        reference: response.data.reference,
        access_code: response.data.access_code
      });
      
      return {
        success: true,
        data: response.data,
        access_code: response.data.access_code,
        authorization_url: response.data.authorization_url,
        reference: response.data.reference
      };
    } catch (error) {
      logger.error('Error initiating Paystack payment:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      throw new Error(`Payment initiation failed: ${error.message}`);
    }
  }

  /**
   * Legacy method name for backward compatibility
   * @deprecated Use initiatePayment instead
   */
  async initiateMpesaPayment(paymentData) {
    return this.initiatePayment(paymentData);
  }

  /**
   * Check payment status using Paystack verify transaction
   * @param {string} reference - Transaction reference (invoice_id)
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(reference) {
    try {
      logger.info(`Checking Paystack payment status for reference: ${reference}`);
      
      const response = await paystackService.verifyTransaction(reference);
      
      return {
        success: response.success,
        status: response.status,
        state: response.status, // For backward compatibility
        data: response.data,
        reference: response.data?.reference || reference,
        amount: response.data?.amount,
        currency: response.data?.currency,
        provider_reference: response.data?.reference
      };
    } catch (error) {
      logger.error(`Error checking Paystack payment status for reference ${reference}:`, {
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        status: 'error',
        error: error.message,
        reference
      };
    }
  }
}

export default new PaymentService();
