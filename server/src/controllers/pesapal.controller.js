import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import pesapalService from '../services/pesapal.service.js';


class PesapalController {
  // Initialize Pesapal (register IPN)
  initialize = async (req, res) => {
    try {
      const publicUrl = process.env.PUBLIC_BASE_URL;
      if (!publicUrl) {
        throw new Error('PUBLIC_BASE_URL is not set in environment variables');
      }

      const ipnUrl = `${publicUrl}/api/pesapal/ipn`;
      logger.info('Using IPN URL:', ipnUrl);
      
      const result = await pesapalService.registerIPN(ipnUrl);
      
      res.json({
        success: true,
        data: result,
        message: 'Pesapal IPN registered successfully'
      });
    } catch (error) {
      logger.error('Error initializing Pesapal:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize Pesapal',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  };

  // Process checkout
  checkout = async (req, res) => {
    const client = await pool.connect();
    
    try {
      // Log complete request details for debugging
      logger.info('=== PESAPAL CHECKOUT REQUEST ===');
      logger.info('Request Method:', req.method);
      logger.info('Request Headers:', JSON.stringify(req.headers, null, 2));
      logger.info('Request Body:', JSON.stringify(req.body, null, 2));
      
      const { amount, description, customer, items } = req.body;
      
      // Validate required fields
      if (!amount || !description || !customer || !items || !Array.isArray(items) || items.length === 0) {
        logger.error('Invalid request payload:', { amount, description, customer, items });
        return res.status(400).json({
          success: false,
          message: 'Invalid request. Please provide amount, description, customer, and items.'
        });
      }
      
      // Log the items array structure
      logger.info(`Items array contains: ${items.length} items`);
      items.forEach((item, index) => {
        logger.info(`Item ${index + 1} keys:`, Object.keys(item));
        logger.info(`Item ${index + 1} data:`, JSON.stringify(item, null, 2));
      });
      
      // Basic validation
      if (!amount || !description || !customer || !customer.email || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, description, customer with email, and a non-empty items array are required'
        });
      }

      await client.query('BEGIN');
      
      // Generate a unique reference
      const merchantReference = `ORD-${uuidv4()}`;
      
      // Prepare the order payload for Pesapal
      // Ensure we're using the API URL for the callback, not the frontend URL
      const apiBaseUrl = process.env.VITE_API_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      const callbackUrl = new URL('/api/pesapal/callback', apiBaseUrl).toString();
      
      logger.info('Using callback URL:', callbackUrl);
      logger.info('VITE_API_URL:', process.env.VITE_API_URL);
      logger.info('PUBLIC_BASE_URL:', process.env.PUBLIC_BASE_URL);
      
      const orderPayload = {
        id: merchantReference,
        currency: 'KES',
        amount: parseFloat(amount).toFixed(2),
        description: description.substring(0, 100), // Max 100 chars
        callback_url: callbackUrl,
        notification_id: process.env.PESAPAL_NOTIFICATION_ID,
        billing_address: {
          email_address: customer.email,
          phone_number: customer.phone || '',
          country_code: customer.countryCode || 'KE',
          first_name: customer.firstName || 'Customer',
          last_name: customer.lastName || 'Byblos',
        },
        // Optional: Add more details that might be useful for your business logic
        // Pass the items in the metadata for later use in the IPN handler
        metadata: {
          items: items, // Pass the whole items array
          customer_id: customer.id,
        },
      };

      // Save the order to the database with all required fields
      const orderQuery = `
        INSERT INTO orders (
          merchant_reference, total_amount, currency, status, 
          customer_email, customer_phone, payment_method, metadata,
          order_tracking_id, customer_id, customer_first_name, customer_last_name,
          description, callback_url, notification_id, ipn_notification_type,
          billing_address, payment_method_description, buyer_id, status_updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'pesapal', $7,
          $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19
        )
        RETURNING id, merchant_reference, total_amount as amount, currency, status, created_at
      `;
      
      const orderValues = [
        merchantReference,                    // $1
        orderPayload.amount,                 // $2
        orderPayload.currency,               // $3
        'PENDING',                           // $4
        customer.email,                      // $5
        customer.phone || null,              // $6
        JSON.stringify(orderPayload.metadata), // $7
        orderPayload.id,                     // $8 - order_tracking_id (using the same as merchant reference for now)
        customer.id || null,                 // $9 - customer_id
        customer.firstName || 'Customer',    // $10 - customer_first_name
        customer.lastName || 'Byblos',       // $11 - customer_last_name
        orderPayload.description,            // $12 - description
        orderPayload.callback_url,           // $13 - call_back_url
        orderPayload.notification_id,        // $14 - notification_id
        'POST',                             // $15 - ipn_notification_type
        JSON.stringify(orderPayload.billing_address) || null, // $16 - billing_address
        'PesaPal Payment',                  // $17 - payment_method_description
        customer.id || null,                 // $18 - buyer_id (same as customer_id)
        'system'                            // $19 - status_updated_by
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // Now, insert the order items with a 'PENDING' status
      for (const item of items) {
        try {
          // Safely get values with fallbacks
          const productId = item.productId || item.id || null;
          const productName = item.productName || item.name || 'Unnamed Product';
          const productDescription = item.productDescription || item.description || null;
          const price = parseFloat(item.price) || 0;
          const quantity = parseInt(item.quantity, 10) || 1;
          const subtotal = parseFloat((price * quantity).toFixed(2));
          
          // Log the final values being inserted
          logger.info('Inserting order item with values:', {
            order_id: order.id,
            product_id: productId,
            product_name: productName,
            product_description: productDescription,
            price: price,
            quantity: quantity,
            subtotal: subtotal
          });

          // Ensure we have a valid product_id
          if (!productId) {
            logger.error('Missing product_id in item:', JSON.stringify(item, null, 2));
            throw new Error('Product ID is required for all order items');
          }

          await client.query(
            `INSERT INTO order_items 
             (order_id, product_id, product_name, product_description, product_price, quantity, subtotal, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
            [
              order.id,
              productId,
              productName,
              productDescription,
              price,
              quantity,
              subtotal
            ]
          );
          
          logger.info(`Successfully inserted order item for product ${productId}`);
          
        } catch (error) {
          logger.error('Error inserting order item:', {
            error: error.message,
            item: JSON.stringify(item, null, 2),
            stack: error.stack
          });
          throw error; // Re-throw to trigger transaction rollback
        }
      }

      logger.info(`Created order ${order.id} and its pending items.`);

      // Submit the order to Pesapal
      const pesapalResponse = await pesapalService.submitOrder(orderPayload);
      
      // Update the order with the Pesapal tracking ID
      await client.query(
        'UPDATE orders SET payment_reference = $1 WHERE id = $2',
        [pesapalResponse.order_tracking_id, order.id]
      );

      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {
          redirect_url: pesapalResponse.redirect_url,
          order_tracking_id: pesapalResponse.order_tracking_id,
          merchant_reference: merchantReference,
          order_id: order.id,
        },
        message: 'Order created successfully. Redirect to payment.'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      // Log the specific error
      logger.error('Checkout error causing rollback:', {
        message: error.message,
        stack: error.stack,
        // Log Pesapal-specific error details if available
        pesapalError: error.response?.data 
      });
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process checkout',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      client.release();
    }
  };

  // Handle Pesapal callback
  callback = async (req, res) => {
    try {
      const { OrderTrackingId, OrderMerchantReference } = req.query;
      const frontendUrl = process.env.VITE_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      
      if (!OrderTrackingId || !OrderMerchantReference) {
        return res.redirect(`${frontendUrl}/checkout?status=error&message=Missing required parameters`);
      }

      // Get the latest status from Pesapal
      const status = await pesapalService.getOrderStatus(OrderTrackingId);
      
      // Ensure status is uppercase for consistency
      const upperStatus = status.payment_status_description 
        ? status.payment_status_description.toUpperCase() 
        : 'PENDING';
      
      // Update the order status and payment status in the database
      await pool.query(
        'UPDATE orders SET status = $1, payment_status = $1, payment_reference = $2, updated_at = NOW() WHERE merchant_reference = $3 RETURNING id',
        [upperStatus, OrderTrackingId, OrderMerchantReference]
      );
      
      // Determine the status parameter based on Pesapal status
      let statusParam = 'pending';
      if (upperStatus === 'COMPLETED' || upperStatus === 'PAID') {
        statusParam = 'success';
      } else if (upperStatus === 'FAILED' || upperStatus === 'INVALID' || upperStatus === 'CANCELLED') {
        statusParam = 'error';
      }
      
      // Build the redirect URL with query parameters
      const redirectUrl = new URL(`${frontendUrl}/checkout`);
      redirectUrl.searchParams.append('status', statusParam);
      redirectUrl.searchParams.append('reference', OrderMerchantReference);
      
      if (statusParam === 'error') {
        redirectUrl.searchParams.append('message', status.payment_status_description || 'Payment processing failed');
      }
      
      logger.info(`Redirecting to frontend: ${redirectUrl.toString()}`);
      return res.redirect(redirectUrl.toString());
      
    } catch (error) {
      logger.error('Callback error:', error);
      const frontendUrl = process.env.VITE_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      const redirectUrl = new URL(`${frontendUrl}/checkout`);
      redirectUrl.searchParams.append('status', 'error');
      redirectUrl.searchParams.append('message', error.message || 'An unexpected error occurred');
      return res.redirect(redirectUrl.toString());
    }
  };

  // Handle Pesapal IPN (Instant Payment Notification)
  ipnHandler = async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { OrderNotificationType, OrderTrackingId, OrderMerchantReference } = req.body;
      
      if (OrderNotificationType !== 'IPN' || !OrderTrackingId || !OrderMerchantReference) {
        return res.status(400).json({
          success: false,
          message: 'Invalid IPN data'
        });
      }

      // Start a transaction
      await client.query('BEGIN');
      
      // Get the order first to check current status
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE merchant_reference = $1 FOR UPDATE',
        [OrderMerchantReference]
      );
      
      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      const order = orderResult.rows[0];
      
      // Get the latest status from Pesapal
      const status = await pesapalService.getOrderStatus(OrderTrackingId);
      
      // Ensure status is uppercase for consistency
      const upperStatus = status.payment_status_description 
        ? status.payment_status_description.toUpperCase() 
        : 'PENDING';
      
      // Update the order status and payment status in the database, and capture the result
      const updatedOrderResult = await client.query(
        `UPDATE orders 
         SET status = $1, 
             payment_status = $1, 
             payment_reference = $2, 
             updated_at = NOW(),
             status_updated_at = NOW(),
             status_updated_by = 'system',
             payment_date = CASE WHEN $1 IN ('COMPLETED', 'PAID') THEN NOW() ELSE payment_date END
         WHERE merchant_reference = $3
         RETURNING *`,
        [upperStatus, OrderTrackingId, OrderMerchantReference]
      );
      const updatedOrder = updatedOrderResult.rows[0];
      
      // If the payment is completed, update the status of the order items as well
      if (upperStatus === 'COMPLETED' || upperStatus === 'PAID') {
        await client.query(
          "UPDATE order_items SET status = 'COMPLETED', updated_at = NOW() WHERE order_id = $1",
          [updatedOrder.id] // Use the ID from the updated order
        );
        logger.info(`Updated order items to COMPLETED for order ${updatedOrder.id}`);
        logger.info(`Updated order items to COMPLETED for order ${order.id}`);
      }
      
      await client.query('COMMIT');
      
      // Respond to Pesapal to acknowledge receipt of the IPN
      res.json({
        orderNotificationType: 'IPN',
        orderTrackingId: OrderTrackingId,
        orderMerchantReference: OrderMerchantReference,
        status: 200
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('IPN handler error:', error);
      res.status(500).json({
        orderNotificationType: 'IPN',
        orderTrackingId: req.body.OrderTrackingId,
        orderMerchantReference: req.body.OrderMerchantReference,
        status: 500,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  };

  // Check order status
  checkStatus = async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Get order from database
      const orderResult = await pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      const order = orderResult.rows[0];
      
      // If we have a payment reference, check with Pesapal for the latest status
      if (order.payment_reference) {
        try {
          const status = await pesapalService.getOrderStatus(order.payment_reference);
          
          // Ensure status is uppercase for consistency
          const upperStatus = status.payment_status_description 
            ? status.payment_status_description.toUpperCase() 
            : 'PENDING';
          
          // Update the order status in the database if it has changed
          if (upperStatus !== order.status) {
            await pool.query(
              'UPDATE orders SET status = $1, payment_status = $1, updated_at = NOW() WHERE id = $2',
              [upperStatus, order.id]
            );
            order.status = upperStatus;
            order.payment_status = upperStatus;
          }
          
          return res.json({
            success: true,
            data: {
              ...order,
              pesapal_status: status
            }
          });
          
        } catch (error) {
          logger.error('Error checking status with Pesapal:', error);
          // Continue to return the order with the current status from the database
        }
      }
      
      // Return the order with the current status from the database
      res.json({
        success: true,
        data: order
      });
      
    } catch (error) {
      logger.error('Check status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check order status'
      });
    }
  };
}

export default new PesapalController();
