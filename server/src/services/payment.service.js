import IntaSend from 'intasend-node';
import logger from '../utils/logger.js';

class PaymentService {
  constructor() {
    // Debug log environment variables (don't log full tokens in production)
    logger.info('IntaSend Configuration:', {
      hasToken: !!process.env.INTASEND_API_TOKEN,
      hasPubKey: !!process.env.INTASEND_PUB_KEY,
      env: process.env.NODE_ENV,
      backendUrl: process.env.BACKEND_URL,
      frontendUrl: process.env.FRONTEND_URL
    });

    if (!process.env.INTASEND_API_TOKEN || !process.env.INTASEND_PUB_KEY) {
      const error = new Error('IntaSend API credentials not configured');
      logger.error('Missing IntaSend credentials:', {
        hasToken: !!process.env.INTASEND_API_TOKEN,
        hasPubKey: !!process.env.INTASEND_PUB_KEY
      });
      throw error;
    }

    try {
      this.intaSend = new IntaSend(
        process.env.INTASEND_PUB_KEY,
        process.env.INTASEND_API_TOKEN,
        process.env.NODE_ENV !== 'production'
      );
      
      this.collection = this.intaSend.collection();
      logger.info('IntaSend client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize IntaSend client:', error);
      throw new Error(`Failed to initialize payment service: ${error.message}`);
    }
  }

  /**
   * Initiate M-Pesa STK push payment
   * @param {Object} paymentData - Payment details
   * @param {string} paymentData.phone - Phone number in 2547xxxxxxx format
   * @param {string} paymentData.email - Customer email
   * @param {number} paymentData.amount - Amount to charge
   * @param {string} paymentData.narrative - Payment description
   * @returns {Promise<Object>} Payment response
   */
  async initiateMpesaPayment({ phone, email, amount, narrative, firstName = 'Customer', lastName = '', invoice_id }) {
    try {
      logger.info(`Initiating M-Pesa payment for ${email}, amount: ${amount}`);
      
      // Construct the webhook URL - using the same host as the API but with /api/payments/webhook path
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
      const webhookUrl = new URL('/api/payments/webhook', backendUrl).toString();
      
      logger.info(`Using webhook URL: ${webhookUrl} (Backend URL: ${backendUrl})`);
      
      // Prepare payment data
      const paymentData = {
        first_name: firstName,
        last_name: lastName,
        email,
        amount,
        phone_number: phone,
        api_ref: invoice_id || `ticket_${Date.now()}`,
        host: process.env.FRONTEND_URL || 'http://localhost:3000',
        webhook: webhookUrl,
        ...(narrative && { narrative })
      };
      
      logger.info('Sending payment request to IntaSend:', {
        ...paymentData,
        // Don't log sensitive data in production
        email: process.env.NODE_ENV === 'production' ? '[REDACTED]' : email,
        phone_number: process.env.NODE_ENV === 'production' ? '[REDACTED]' : phone,
      });
      
      let response;
      try {
        response = await this.collection.mpesaStkPush(paymentData);
      } catch (apiError) {
        logger.error('IntaSend API Error:', {
          message: apiError.message,
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data,
          config: {
            url: apiError.config?.url,
            method: apiError.config?.method,
            headers: apiError.config?.headers ? {
              ...apiError.config.headers,
              // Don't log full authorization header
              Authorization: apiError.config.headers.Authorization ? '[REDACTED]' : undefined
            } : undefined
          }
        });
        throw new Error(`Payment API error: ${apiError.message}`);
      }

      // Log the full response for debugging
      logger.info('M-Pesa payment initiated', { 
        email,
        invoiceId: response.invoice_id || invoice_id,
        response: JSON.stringify(response, null, 2)
      });
      
      return {
        success: true,
        data: response,
        invoiceId: response.invoice_id || invoice_id  // Use the one from response if available, otherwise use the one we generated
      };
    } catch (error) {
      // Log the full error object and response if available
      logger.error('Error initiating M-Pesa payment:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      // Extract a more helpful error message if available
      let errorMessage = error.message;
      if (error.response?.data) {
        errorMessage = error.response.data.detail || JSON.stringify(error.response.data);
      }
      
      throw new Error(`Payment initiation failed: ${errorMessage}`);
    }
  }

  /**
   * Check payment status
   * @param {string} invoiceId - Invoice ID to check
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(invoiceId) {
    try {
      logger.info(`Checking payment status for invoice: ${invoiceId}`);
      const response = await this.collection.status(invoiceId);
      
      // Log the raw response for debugging
      const responseString = JSON.stringify(response, null, 2);
      logger.info('Raw payment status response:', responseString);
      
      // Handle different response formats
      let status, state, mpesaReference, invoiceData;
      
      // First try to get the invoice data from the response
      if (response && typeof response === 'object') {
        // Check if the response has an 'invoice' property
        if (response.invoice) {
          invoiceData = response.invoice;
        } 
        // If no invoice but has state, use the root object
        else if (response.state) {
          invoiceData = response;
        }
        // Check for array response (some API versions return an array)
        else if (Array.isArray(response) && response.length > 0) {
          invoiceData = response[0];
        }
        // Check for data property
        else if (response.data) {
          invoiceData = Array.isArray(response.data) ? response.data[0] : response.data;
        }
      }
      
      // Extract status and reference from the invoice data
      if (invoiceData) {
        status = invoiceData.state || invoiceData.status;
        state = invoiceData.state;
        mpesaReference = invoiceData.mpesa_reference || invoiceData.reference;
        
        // Handle case where status might be in a nested 'status' object
        if (!status && invoiceData.status && typeof invoiceData.status === 'object') {
          status = invoiceData.status.state || invoiceData.status.status;
        }
      }
      
      // If we still don't have a status, check the raw response
      if (!status && response) {
        status = response.state || response.status;
        mpesaReference = response.mpesa_reference || response.reference;
      }
      
      // Normalize status to lowercase for consistency
      status = (status || 'pending').toLowerCase();
      state = (state || status || 'pending').toLowerCase();
      
      // Log the extracted values
      logger.info(`Extracted status: ${status}, state: ${state} for invoice ${invoiceId}`, {
        hasInvoiceData: !!invoiceData,
        mpesaReference,
        responseKeys: response ? Object.keys(response) : 'no response'
      });
      
      return {
        success: true,
        status,
        state,
        mpesa_reference: mpesaReference,
        data: response,
        // Include common fields at the top level for easier access
        invoice_id: response?.invoice_id || invoiceId,
        amount: response?.amount || response?.data?.amount,
        currency: response?.currency || response?.data?.currency,
        provider_reference: mpesaReference || response?.provider_reference || response?.data?.provider_reference
      };
    } catch (error) {
      logger.error(`Error checking payment status for invoice ${invoiceId}:`, {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      return {
        success: false,
        status: 'error',
        error: error.message,
        invoice_id: invoiceId
      };
    }
  }
}

export default new PaymentService();
