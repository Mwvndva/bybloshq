import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import pesapalV2Service from '../services/pesapal-v2.service.js';
import Order from '../models/order.model.js';
import { pool } from '../config/database.js';

class PesapalV2Controller {
  /**
   * Initiate Pesapal payment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  initiatePayment = async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors in initiatePayment:', { errors: errors.array() });
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        orderId,
        amount,
        currency = 'KES',
        description,
        customer,
        billingAddress,
        items,
        sellerId
      } = req.body;

      // Get user ID from auth middleware
      const buyerId = req.user?.id;

      if (!buyerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Start database transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Create order in database
        const orderData = {
          buyerId,
          sellerId,
          paymentMethod: 'pesapal',
          buyerName: `${customer.firstName} ${customer.lastName}`.trim(),
          buyerEmail: customer.email,
          buyerPhone: customer.phone,
          shippingAddress: billingAddress, // Using billing as shipping for simplicity
          notes: description,
          metadata: {
            items,
            billingAddress,
            sellerId
          }
        };

        // Create order in database
        const order = await Order.createOrder(orderData);

        // Prepare payment data for Pesapal
        const paymentData = {
          id: order.order_number,
          reference: order.order_number,
          amount,
          currency,
          description: description || `Payment for order ${order.order_number}`
        };

        // Submit payment to Pesapal
        const paymentResponse = await pesapalV2Service.submitPayment(
          paymentData,
          customer,
          billingAddress
        );

        // Update order with payment reference
        await Order.updatePaymentStatus(
          order.id,
          'pending',
          paymentResponse.order_tracking_id || order.order_number
        );

        await client.query('COMMIT');

        // Return payment URL to redirect user to Pesapal
        return res.status(200).json({
          success: true,
          message: 'Payment initiated successfully',
          data: {
            paymentUrl: paymentResponse.redirect_url,
            orderId: order.id,
            orderNumber: order.order_number,
            reference: paymentResponse.order_tracking_id || order.order_number
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error in initiatePayment transaction:', error);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error in initiatePayment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate payment',
        error: error.message
      });
    }
  };

  /**
   * Handle Pesapal callback
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  handleCallback = async (req, res) => {
    try {
      const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.query;
      
      logger.info('Received Pesapal callback:', {
        OrderTrackingId,
        OrderMerchantReference,
        OrderNotificationType
      });

      // Redirect to frontend with status
      const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
      frontendUrl.pathname = '/checkout/status';
      frontendUrl.searchParams.append('reference', OrderMerchantReference);
      frontendUrl.searchParams.append('status', OrderNotificationType?.toLowerCase() || 'pending');
      
      return res.redirect(frontendUrl.toString());
    } catch (error) {
      logger.error('Error in handleCallback:', error);
      // Still redirect to frontend but with error status
      const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
      frontendUrl.pathname = '/checkout/status';
      frontendUrl.searchParams.append('status', 'error');
      frontendUrl.searchParams.append('message', 'Error processing payment');
      
      return res.redirect(frontendUrl.toString());
    }
  };

  /**
   * Handle Pesapal IPN (Instant Payment Notification)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  handleIPN = async (req, res) => {
    try {
      const notification = req.body;
      
      logger.info('Received Pesapal IPN:', notification);
      
      // Process the IPN
      const result = await pesapalV2Service.handleIPN(notification);
      
      if (result.success) {
        return res.status(200).json({
          status: 'success',
          message: 'IPN processed successfully'
        });
      } else {
        return res.status(400).json({
          status: 'error',
          message: result.error || 'Failed to process IPN'
        });
      }
    } catch (error) {
      logger.error('Error in handleIPN:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  };

  /**
   * Check payment status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  checkStatus = async (req, res) => {
    try {
      const { reference } = req.params;
      
      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Reference is required'
        });
      }

      // First check our database
      const order = await Order.findByReference(reference);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // If payment is already completed, no need to check with Pesapal
      if (order.payment_status === 'COMPLETED') {
        return res.status(200).json({
          success: true,
          status: 'COMPLETED',
          order: {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            paymentStatus: order.payment_status,
            amount: order.total_amount,
            currency: order.currency,
            createdAt: order.created_at
          }
        });
      }

      // Otherwise, check with Pesapal
      const paymentStatus = await pesapalV2Service.verifyPayment(reference);
      
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
          paymentStatusValue = 'PENDING';
          orderStatus = 'PENDING';
      }

      // Update order in database if status changed
      if (paymentStatusValue !== order.payment_status) {
        await Order.updatePaymentStatus(order.id, paymentStatusValue, reference);
        
        if (orderStatus !== order.status) {
          await Order.updateOrderStatus(order.id, orderStatus, 'Payment status updated via status check');
        }
      }

      return res.status(200).json({
        success: true,
        status: paymentStatusValue,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: orderStatus,
          paymentStatus: paymentStatusValue,
          amount: order.total_amount,
          currency: order.currency,
          createdAt: order.created_at
        },
        paymentDetails: paymentStatus
      });
    } catch (error) {
      logger.error('Error in checkStatus:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check payment status',
        error: error.message
      });
    }
  };
}

export default new PesapalV2Controller();
