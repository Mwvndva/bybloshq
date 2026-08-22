import https from 'https';
import crypto from 'crypto';

class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = 'https://api.paystack.co';
    this.isLive = process.env.PAYSTACK_LIVE === 'true' || process.env.NODE_ENV === 'production';

    if (!this.secretKey) {
      const error = new Error('Paystack secret key not configured');
      console.error('Missing Paystack credentials:', {
        hasSecretKey: !!this.secretKey,
        hasPublicKey: !!this.publicKey
      });
      throw error;
    }

    console.log('Paystack Service initialized', {
      mode: this.isLive ? 'live' : 'test',
      hasSecretKey: !!this.secretKey,
      hasPublicKey: !!this.publicKey
    });
  }

  /**
   * Make HTTP request to Paystack API
   * @private
   */
  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: path,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (parsed.status) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || 'Paystack API error'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse Paystack response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Paystack request failed: ${error.message}`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Initialize a transaction
   * @param {Object} paymentData - Payment details
   * @param {string} paymentData.email - Customer email
   * @param {number} paymentData.amount - Amount in kobo (lowest currency unit)
   * @param {string} paymentData.reference - Transaction reference
   * @param {string} paymentData.callback_url - Callback URL
   * @param {Object} paymentData.metadata - Additional metadata
   * @returns {Promise<Object>} Transaction initialization response
   */
  async initializeTransaction({ email, amount, reference, callback_url, metadata = {} }) {
    try {
      console.log('[PAYSTACK] Step 1: Initializing transaction', {
        email: process.env.NODE_ENV === 'production' ? '[REDACTED]' : email,
        amount,
        amountInKobo: Math.round(amount * 100),
        reference,
        callback_url,
        hasMetadata: !!metadata && Object.keys(metadata).length > 0
      });

      const params = {
        email,
        amount: Math.round(amount * 100), // Convert to kobo (lowest currency unit)
        reference,
        callback_url,
        metadata
      };

      console.log('[PAYSTACK] Step 2: Sending request to Paystack API', {
        endpoint: '/transaction/initialize',
        reference,
        amountInKobo: params.amount
      });

      const response = await this.makeRequest('/transaction/initialize', 'POST', params);

      console.log('[PAYSTACK] Step 3: Paystack transaction initialized successfully', {
        reference: response.data.reference,
        access_code: response.data.access_code,
        authorization_url: response.data.authorization_url,
        status: response.status
      });

      return {
        success: true,
        data: {
          access_code: response.data.access_code,
          authorization_url: response.data.authorization_url,
          reference: response.data.reference
        }
      };
    } catch (error) {
      console.error('Error initializing Paystack transaction:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Payment initialization failed: ${error.message}`);
    }
  }

  /**
   * Verify a transaction
   * @param {string} reference - Transaction reference
   * @returns {Promise<Object>} Transaction verification response
   */
  async verifyTransaction(reference) {
    try {
      console.log(`Verifying Paystack transaction: ${reference}`);

      const response = await this.makeRequest(`/transaction/verify/${reference}`, 'GET');

      const transaction = response.data;
      const status = transaction.status === 'success' ? 'completed' : 
                    transaction.status === 'failed' ? 'failed' : 'pending';

      console.log('Paystack transaction verified:', {
        reference,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency
      });

      return {
        success: true,
        status,
        data: {
          reference: transaction.reference,
          amount: transaction.amount / 100, // Convert from kobo
          currency: transaction.currency,
          status: transaction.status,
          gateway_response: transaction.gateway_response,
          paid_at: transaction.paid_at,
          created_at: transaction.created_at,
          customer: transaction.customer,
          authorization: transaction.authorization
        }
      };
    } catch (error) {
      console.error(`Error verifying Paystack transaction ${reference}:`, {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Verify webhook signature
   * @param {string} signature - x-paystack-signature header value
   * @param {Object} body - Webhook body
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(signature, body) {
    if (!signature) {
      console.warn('Missing Paystack webhook signature');
      return false;
    }

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(body))
      .digest('hex');

    const isValid = hash === signature;
    
    if (!isValid) {
      console.warn('Invalid Paystack webhook signature');
    }

    return isValid;
  }
}

export default new PaystackService();

