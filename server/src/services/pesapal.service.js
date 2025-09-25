import axios from 'axios';
import logger from '../utils/logger.js';

class PesapalService {
  constructor() {
    this.baseUrl = process.env.PESAPAL_BASE_URL || 'https://cybqa.pesapal.com/pesapalv3';
    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY;
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
    this.token = null;
    this.tokenExpiry = 0;
  }

  async getToken() {
    const now = Date.now();
    
    // Return cached token if it's still valid (with 1-minute buffer)
    if (this.token && now < this.tokenExpiry - 60000) {
      return this.token;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/Auth/RequestToken`,
        {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      if (response.data && response.data.token) {
        this.token = response.data.token;
        // Set token expiry to 4.5 minutes from now (Pesapal tokens expire in 5 minutes)
        this.tokenExpiry = now + 270000;
        return this.token;
      }

      throw new Error('Failed to get token from Pesapal');
    } catch (error) {
      logger.error('Error getting Pesapal token:', error);
      throw new Error('Failed to authenticate with Pesapal');
    }
  }

  async registerIPN(ipnUrl, ipnNotificationType = 'POST') {
    try {
      const token = await this.getToken();
      
      const response = await axios.post(
        `${this.baseUrl}/api/URLSetup/RegisterIPN`,
        {
          url: ipnUrl,
          ipn_notification_type: ipnNotificationType,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error registering IPN:', error.response?.data || error.message);
      throw new Error('Failed to register IPN with Pesapal');
    }
  }

  async submitOrder(payload) {
    try {
      const token = await this.getToken();
      
      const response = await axios.post(
        `${this.baseUrl}/api/Transactions/SubmitOrderRequest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error submitting order to Pesapal:', error.response?.data || error.message);
      throw new Error('Failed to submit order to Pesapal');
    }
  }

  async getOrderStatus(orderTrackingId) {
    try {
      const token = await this.getToken();
      
      const response = await axios.get(
        `${this.baseUrl}/api/Transactions/GetTransactionStatus`,
        {
          params: { orderTrackingId },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error getting order status from Pesapal:', error.response?.data || error.message);
      throw new Error('Failed to get order status from Pesapal');
    }
  }

  async verifyPayment(merchantReference) {
    try {
      const token = await this.getToken();
      
      const response = await axios.get(
        `${this.baseUrl}/api/Transactions/GetTransactionStatus`,
        {
          params: { merchantReference },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error verifying payment with Pesapal:', error.response?.data || error.message);
      throw new Error('Failed to verify payment with Pesapal');
    }
  }
}

export default new PesapalService();
