import Order from '../models/order.model.js';
import logger from '../utils/logger.js';
import { sendEmail } from './email.service.js';
import NotificationService from './notification.service.js';

class OrderService {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @param {number} orderData.buyerId - ID of the buyer
   * @param {number} orderData.sellerId - ID of the seller
   * @param {string} orderData.paymentMethod - Payment method (mpesa, card, etc.)
   * @param {string} orderData.buyerName - Name of the buyer
   * @param {string} orderData.buyerEmail - Email of the buyer
   * @param {string} orderData.buyerPhone - Phone number of the buyer
   * @param {Object} orderData.shippingAddress - Shipping address
   * @param {string} orderData.notes - Order notes
   * @param {Array} orderData.items - Array of order items
   * @returns {Promise<Object>} Created order
   */
  async createOrder(orderData) {
    try {
      // Validate order items
      if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        throw new Error('Order must contain at least one item');
      }

      // Create order in database
      const order = await Order.createOrder(orderData);

      // Send order confirmation email
      await this.sendOrderConfirmationEmail(order);

      // Send notification to seller
      await this.notificationService.sendNotification({
        userId: order.sellerId,
        type: 'new_order',
        title: 'New Order Received',
        message: `You have a new order #${order.order_number}`,
        metadata: { orderId: order.id }
      });

      return order;
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   * @param {number} orderId - ID of the order
   * @param {string} status - New status
   * @param {string} [notes] - Optional notes
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, status, notes = null) {
    try {
      const order = await Order.updateOrderStatus(orderId, status, notes);
      
      // Send notification to buyer
      await this.notificationService.sendNotification({
        userId: order.buyerId,
        type: 'order_status_update',
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your order #${order.order_number} is now ${status}`,
        metadata: { orderId: order.id, status }
      });

      return order;
    } catch (error) {
      logger.error(`Error updating order ${orderId} status:`, error);
      throw error;
    }
  }

  /**
   * Update payment status for an order
   * @param {number} orderId - ID of the order
   * @param {string} status - Payment status (pending, completed, failed, etc.)
   * @param {string} [paymentReference] - Payment reference number
   * @returns {Promise<Object>} Updated order
   */
  async updatePaymentStatus(orderId, status, paymentReference = null) {
    try {
      const order = await Order.updatePaymentStatus(orderId, status, paymentReference);
      
      if (status === 'completed') {
        // Send payment confirmation email
        await this.sendPaymentConfirmationEmail(order);
        
        // Send notification to buyer
        await this.notificationService.sendNotification({
          userId: order.buyerId,
          type: 'payment_received',
          title: 'Payment Received',
          message: `Your payment for order #${order.order_number} has been received`,
          metadata: { orderId: order.id }
        });
      }

      return order;
    } catch (error) {
      logger.error(`Error updating payment status for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Mark order as shipped
   * @param {number} orderId - ID of the order
   * @param {string} [trackingNumber] - Tracking number
   * @returns {Promise<Object>} Updated order
   */
  async markAsShipped(orderId, trackingNumber = null) {
    try {
      const order = await Order.markAsShipped(orderId, trackingNumber);
      
      // Send shipping confirmation email
      await this.sendShippingConfirmationEmail(order);
      
      // Send notification to buyer
      await this.notificationService.sendNotification({
        userId: order.buyerId,
        type: 'order_shipped',
        title: 'Order Shipped',
        message: `Your order #${order.order_number} has been shipped`,
        metadata: { 
          orderId: order.id,
          trackingNumber
        }
      });

      return order;
    } catch (error) {
      logger.error(`Error marking order ${orderId} as shipped:`, error);
      throw error;
    }
  }

  /**
   * Mark order as delivered
   * @param {number} orderId - ID of the order
   * @returns {Promise<Object>} Updated order
   */
  async markAsDelivered(orderId) {
    try {
      const order = await Order.markAsDelivered(orderId);
      
      // Send delivery confirmation email
      await this.sendDeliveryConfirmationEmail(order);
      
      // Send notification to buyer and seller
      await Promise.all([
        // Buyer notification
        this.notificationService.sendNotification({
          userId: order.buyerId,
          type: 'order_delivered',
          title: 'Order Delivered',
          message: `Your order #${order.order_number} has been delivered`,
          metadata: { orderId: order.id }
        }),
        
        // Seller notification
        this.notificationService.sendNotification({
          userId: order.sellerId,
          type: 'order_delivered_seller',
          title: 'Order Delivered',
          message: `Order #${order.order_number} has been delivered to the customer`,
          metadata: { orderId: order.id }
        })
      ]);

      return order;
    } catch (error) {
      logger.error(`Error marking order ${orderId} as delivered:`, error);
      throw error;
    }
  }

  /**
   * Cancel an order
   * @param {number} orderId - ID of the order
   * @param {string} [reason] - Reason for cancellation
   * @returns {Promise<Object>} Cancelled order
   */
  async cancelOrder(orderId, reason = null) {
    try {
      const order = await Order.cancelOrder(orderId, reason);
      
      // Send cancellation email
      await this.sendCancellationEmail(order, reason);
      
      // Send notification to buyer and seller
      await Promise.all([
        // Buyer notification
        this.notificationService.sendNotification({
          userId: order.buyerId,
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `Your order #${order.order_number} has been cancelled`,
          metadata: { 
            orderId: order.id,
            reason: reason || 'No reason provided'
          }
        }),
        
        // Seller notification
        this.notificationService.sendNotification({
          userId: order.sellerId,
          type: 'order_cancelled_seller',
          title: 'Order Cancelled',
          message: `Order #${order.order_number} has been cancelled`,
          metadata: { 
            orderId: order.id,
            reason: reason || 'No reason provided'
          }
        })
      ]);

      return order;
    } catch (error) {
      logger.error(`Error cancelling order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order by ID
   * @param {number} orderId - ID of the order
   * @returns {Promise<Object>} Order details
   */
  async getOrderById(orderId) {
    try {
      return await Order.findById(orderId);
    } catch (error) {
      logger.error(`Error getting order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order by reference
   * @param {string} reference - Order number or payment reference
   * @returns {Promise<Object>} Order details
   */
  async getOrderByReference(reference) {
    try {
      return await Order.findByReference(reference);
    } catch (error) {
      logger.error(`Error getting order by reference ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Get orders for a buyer
   * @param {number} buyerId - ID of the buyer
   * @param {Object} [options] - Pagination and filtering options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @param {string} [options.status] - Filter by status
   * @returns {Promise<Object>} Paginated orders
   */
  async getBuyerOrders(buyerId, options = {}) {
    try {
      return await Order.findByBuyerId(buyerId, options);
    } catch (error) {
      logger.error(`Error getting orders for buyer ${buyerId}:`, error);
      throw error;
    }
  }

  /**
   * Get orders for a seller
   * @param {number} sellerId - ID of the seller
   * @param {Object} [options] - Pagination and filtering options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @param {string} [options.status] - Filter by status
   * @returns {Promise<Object>} Paginated orders
   */
  async getSellerOrders(sellerId, options = {}) {
    try {
      return await Order.findBySellerId(sellerId, options);
    } catch (error) {
      logger.error(`Error getting orders for seller ${sellerId}:`, error);
      throw error;
    }
  }

  /**
   * Get order statistics
   * @param {number} [sellerId] - Optional seller ID to filter by
   * @returns {Promise<Object>} Order statistics
   */
  async getOrderStats(sellerId = null) {
    try {
      return await Order.getOrderStats(sellerId);
    } catch (error) {
      logger.error('Error getting order stats:', error);
      throw error;
    }
  }

  // Email templates and sending methods

  /**
   * Send order confirmation email
   * @private
   * @param {Object} order - Order details
   */
  async sendOrderConfirmationEmail(order) {
    try {
      const subject = `Order Confirmation - #${order.order_number}`;
      const html = `
        <h1>Thank you for your order!</h1>
        <p>Your order #${order.order_number} has been received and is being processed.</p>
        <h2>Order Summary</h2>
        <p>Total Amount: KES ${order.total_amount}</p>
        <p>Payment Method: ${order.payment_method}</p>
        <p>Status: ${order.status}</p>
      `;

      await sendEmail({
        to: order.buyer_email,
        subject,
        html
      });
    } catch (error) {
      logger.error('Error sending order confirmation email:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Send payment confirmation email
   * @private
   * @param {Object} order - Order details
   */
  async sendPaymentConfirmationEmail(order) {
    try {
      const subject = `Payment Received - Order #${order.order_number}`;
      const html = `
        <h1>Payment Received</h1>
        <p>We've received your payment for order #${order.order_number}.</p>
        <h2>Payment Details</h2>
        <p>Amount: KES ${order.total_amount}</p>
        <p>Payment Method: ${order.payment_method}</p>
        <p>Transaction ID: ${order.payment_reference || 'N/A'}</p>
      `;

      await sendEmail({
        to: order.buyer_email,
        subject,
        html
      });
    } catch (error) {
      logger.error('Error sending payment confirmation email:', error);
    }
  }

  /**
   * Send shipping confirmation email
   * @private
   * @param {Object} order - Order details
   */
  async sendShippingConfirmationEmail(order) {
    try {
      const trackingNumber = order.metadata?.tracking?.number || 'Not available';
      const subject = `Your Order Has Shipped - #${order.order_number}`;
      const html = `
        <h1>Your Order is on the Way!</h1>
        <p>Your order #${order.order_number} has been shipped.</p>
        ${trackingNumber !== 'Not available' ? 
          `<p>Tracking Number: ${trackingNumber}</p>` : ''}
        <p>Expected Delivery: Within 3-5 business days</p>
      `;

      await sendEmail({
        to: order.buyer_email,
        subject,
        html
      });
    } catch (error) {
      logger.error('Error sending shipping confirmation email:', error);
    }
  }

  /**
   * Send delivery confirmation email
   * @private
   * @param {Object} order - Order details
   */
  async sendDeliveryConfirmationEmail(order) {
    try {
      const subject = `Your Order Has Been Delivered - #${order.order_number}`;
      const html = `
        <h1>Your Order Has Been Delivered!</h1>
        <p>Your order #${order.order_number} has been successfully delivered.</p>
        <p>We hope you're enjoying your purchase!</p>
        <p>If you have any questions about your order, please contact our support team.</p>
      `;

      await sendEmail({
        to: order.buyer_email,
        subject,
        html
      });
    } catch (error) {
      logger.error('Error sending delivery confirmation email:', error);
    }
  }

  /**
   * Send order cancellation email
   * @private
   * @param {Object} order - Order details
   * @param {string} reason - Reason for cancellation
   */
  async sendCancellationEmail(order, reason = 'No reason provided') {
    try {
      const subject = `Order #${order.order_number} Has Been Cancelled`;
      const html = `
        <h1>Order Cancelled</h1>
        <p>Your order #${order.order_number} has been cancelled.</p>
        <p>Reason: ${reason}</p>
        ${order.status === 'cancelled' && order.payment_status === 'completed' ? 
          `<p>Your refund will be processed within 5-7 business days.</p>` : ''}
      `;

      await sendEmail({
        to: order.buyer_email,
        subject,
        html
      });
    } catch (error) {
      logger.error('Error sending cancellation email:', error);
    }
  }
}

export default new OrderService();
