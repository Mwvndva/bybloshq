import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import pesapalService from '../services/pesapal.service.js';
import whatsappService from '../services/whatsapp.service.js';


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
      
      // Get the first product to determine seller ID
      let sellerId = null;
      
      if (items.length === 0 || (!items[0].productId && !items[0].id)) {
        logger.error('No product items provided in the order or missing product ID:', { items });
        throw new Error('No product items provided in the order or missing product ID');
      }
      
      // Use either productId or id from the item
      const productId = items[0].productId || items[0].id;
      
      if (!productId) {
        logger.error('Product ID is missing from the first item:', { firstItem: items[0] });
        throw new Error('Product ID is missing from the order item');
      }
      
      // First, verify the product exists and get its seller_id
      const productQuery = `
        SELECT p.seller_id, s.id as seller_exists, s.status as seller_status
        FROM products p 
        LEFT JOIN sellers s ON p.seller_id = s.id 
        WHERE p.id = $1`;
        
      logger.info('Fetching seller ID for product:', productId);
      const productResult = await client.query(productQuery, [productId]);
      
      if (productResult.rows.length === 0) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      const row = productResult.rows[0];
      
      if (!row.seller_id) {
        throw new Error(`Product ${productId} is not associated with any seller`);
      }
      
      if (!row.seller_exists) {
        throw new Error(`Seller ID ${row.seller_id} for product ${productId} does not exist`);
      }
      
      if (row.seller_status !== 'active') {
        throw new Error(`Seller ID ${row.seller_id} is not active`);
      }
      
      sellerId = row.seller_id;
      logger.info(`Using seller ID ${sellerId} from product ${productId}`);
      
      // Verify the seller exists before proceeding
      const sellerCheck = await client.query('SELECT id FROM sellers WHERE id = $1', [sellerId]);
      if (sellerCheck.rows.length === 0) {
        logger.error(`Seller ID ${sellerId} does not exist in the database`);
        // If the seller ID doesn't exist, throw an error since we already validated the seller
        throw new Error(`Seller ID ${sellerId} not found in the database`);
      }
      
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
        INSERT INTO product_orders (
          order_number, total_amount, buyer_id, seller_id, 
          buyer_email, buyer_phone, payment_method, metadata,
          payment_reference, buyer_name, 
          notes, status, payment_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'card', $7,
          $8, $9, $10, 'PENDING', 'pending'
        )
        RETURNING id, order_number as merchant_reference, total_amount as amount, 'KES' as currency, status, created_at
      `;
      
      const orderValues = [
        merchantReference,                    // $1 - order_number
        parseFloat(orderPayload.amount),      // $2 - total_amount
        customer.id,                          // $3 - buyer_id
        sellerId,                              // $4 - seller_id (fetched from product or default to 1)
        customer.email,                       // $5 - buyer_email
        customer.phone || '',                 // $6 - buyer_phone
        JSON.stringify({
          ...orderPayload.metadata,
          callback_url: orderPayload.callback_url,
          notification_id: orderPayload.notification_id,
          billing_address: orderPayload.billing_address
        }),                                   // $7 - metadata
        orderPayload.id,                      // $8 - payment_reference
        `${customer.firstName || 'Customer'} ${customer.lastName || ''}`.trim(), // $9 - buyer_name
        orderPayload.description || 'Order from Byblos' // $10 - notes
      ];
      
      // Log the values being inserted
      logger.info('Inserting order with values:', JSON.stringify(orderValues, null, 2));

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];
      
      // Verify order was created successfully
      if (!order || !order.id) {
        logger.error('Order creation failed - no order ID returned:', JSON.stringify(orderResult, null, 2));
        throw new Error('Failed to create order - no order ID returned');
      }
      
      logger.info(`Order created successfully with ID: ${order.id} (type: ${typeof order.id})`);
      
      // Verify the order exists in the database before proceeding
      const verifyQuery = 'SELECT id FROM product_orders WHERE id = $1';
      const verifyResult = await client.query(verifyQuery, [order.id]);
      
      if (verifyResult.rows.length === 0) {
        logger.error(`CRITICAL: Order ${order.id} was created but cannot be found in product_orders table!`);
        throw new Error(`Order verification failed - order ${order.id} not found in database`);
      }
      
      logger.info(`Verified order ${order.id} exists in product_orders table`);
      
      // Check the foreign key constraint details
      const fkCheckQuery = `
        SELECT 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name='order_items'
          AND kcu.column_name='order_id';
      `;
      
      const fkCheckResult = await client.query(fkCheckQuery);
      logger.info('Foreign key constraint details for order_items.order_id:', JSON.stringify(fkCheckResult.rows, null, 2));
      
      // Also check what tables exist
      const tablesQuery = `
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('product_orders', 'order_items', 'orders')
        ORDER BY table_schema, table_name;
      `;
      
      const tablesResult = await client.query(tablesQuery);
      logger.info('Tables found in database:', JSON.stringify(tablesResult.rows, null, 2));

      // Now, insert the order items with a 'PENDING' status
      for (const item of items) {
        try {
          // Safely get values with fallbacks
          const productId = item.productId || item.id || null;
          const productName = item.productName || item.name || 'Unnamed Product';
          const productDescription = item.productDescription || item.description || null;
          
          // Log the raw item data for debugging
          logger.info('Raw item data:', JSON.stringify(item, null, 2));
          
          // Ensure we have a valid product ID
          if (!productId) {
            throw new Error('Product ID is required for all order items');
          }
          
          // Fetch product details from database if price is not provided
          let price = 0;
          if (item.price !== undefined) {
            // Use provided price if available
            if (typeof item.price === 'number') {
              price = item.price;
            } else if (typeof item.price === 'string') {
              price = parseFloat(item.price) || 0;
            } else if (item.price && typeof item.price === 'object' && 'amount' in item.price) {
              price = parseFloat(item.price.amount) || 0;
            }
          } else {
            // Fetch price from database if not provided
            try {
              const productQuery = 'SELECT price FROM products WHERE id = $1';
              const productResult = await client.query(productQuery, [productId]);
              
              if (productResult.rows.length > 0) {
                price = parseFloat(productResult.rows[0].price) || 0;
                logger.info(`Fetched price ${price} from database for product ${productId}`);
              } else {
                logger.warn(`Product ${productId} not found in database`);
              }
            } catch (dbError) {
              logger.error(`Error fetching price for product ${productId}:`, dbError);
              // Continue with price as 0, will be caught by validation
            }
          }
          
          // Safely parse quantity with fallback to 1
          let quantity = 1;
          if (typeof item.quantity === 'number') {
            quantity = Math.max(1, Math.floor(item.quantity));
          } else if (typeof item.quantity === 'string') {
            quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
          }
          

          
          // Calculate subtotal
          const subtotal = parseFloat((price * quantity).toFixed(2));
          
          // Log the final values being inserted
          logger.info('Inserting order item with values:', {
            order_id: order.id,
            product_id: productId,
            product_name: productName,
            price: price,
            quantity: quantity,
            subtotal: subtotal
          });

          // Log the parsed values for debugging
          logger.info(`Parsed values for product ${productId}:`, {
            originalPrice: item.price,
            parsedPrice: price,
            originalQuantity: item.quantity,
            parsedQuantity: quantity
          });
          
          // Validate price and quantity after parsing
          if (price <= 0) {
            throw new Error(`Invalid price (${price}) for product ${productId}. Please ensure the product has a valid price.`);
          }
          
          if (quantity <= 0) {
            throw new Error(`Invalid quantity (${quantity}) for product ${productId}. Quantity must be at least 1.`);
          }

          // Insert order item with explicit column types
          const insertQuery = `
            INSERT INTO order_items (
              order_id, 
              product_id, 
              product_name, 
              product_price, 
              quantity, 
              subtotal, 
              metadata, 
              created_at, 
              updated_at
            ) VALUES ($1, $2, $3, $4::numeric, $5, $6::numeric, $7::jsonb, NOW(), NOW())
            RETURNING id, product_price, subtotal
          `;
          
          const insertValues = [
            order.id,                     // order_id
            productId,                   // product_id
            productName,                 // product_name
            price.toFixed(2),            // product_price (as string to ensure proper numeric conversion)
            quantity,                    // quantity
            subtotal.toFixed(2),         // subtotal (as string to ensure proper numeric conversion)
            JSON.stringify({
              description: productDescription,
              original_price: price,
              original_quantity: quantity,
              original_item: item
            })
          ];
          
          logger.info('Executing order item insert with values:', JSON.stringify(insertValues, null, 2));
          logger.info(`Attempting to insert order_item with order_id: ${order.id} (type: ${typeof order.id}) for product_id: ${productId}`);
          
          const result = await client.query(insertQuery, insertValues);
          
          // Verify the inserted values
          const insertedItem = result.rows[0];
          logger.info('Successfully inserted order item:', {
            id: insertedItem.id,
            product_id: productId,
            product_price: insertedItem.product_price,
            quantity: quantity,
            subtotal: insertedItem.subtotal
          });
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
        'UPDATE product_orders SET payment_reference = $1, updated_at = NOW() WHERE id = $2',
        [pesapalResponse.order_tracking_id, order.id]
      );

      await client.query('COMMIT');
      
      // Note: WhatsApp notifications are sent AFTER payment is confirmed in the callback
      // See callback() method for notification logic
      
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
    const client = await pool.connect();
    try {
      const { OrderTrackingId, OrderMerchantReference } = req.query;
      const frontendUrl = process.env.VITE_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      
      if (!OrderTrackingId || !OrderMerchantReference) {
        return res.redirect(`${frontendUrl}/checkout?status=error&message=Missing required parameters`);
      }

      // Get the latest status from Pesapal
      const status = await pesapalService.getOrderStatus(OrderTrackingId);
      
      // Log the incoming status for debugging
      logger.info('Received payment status from Pesapal:', {
        rawStatus: status,
        payment_status_description: status.payment_status_description
      });

      // Start transaction
      await client.query('BEGIN');
      
      // First, get the current order to check its status
      const orderResult = await client.query(
        'SELECT id, status, payment_status FROM product_orders WHERE order_number = $1 FOR UPDATE',
        [OrderMerchantReference]
      );
      
      if (orderResult.rows.length === 0) {
        throw new Error(`Order not found: ${OrderMerchantReference}`);
      }
      
      const currentOrder = orderResult.rows[0];
      logger.info('Current order status:', currentOrder);
      
      // Get the actual enum values from the database
      const enumResult = await client.query(
        "SELECT unnest(enum_range(NULL::payment_status)) AS status"
      );
      
      const paymentStatusValues = enumResult.rows.map(row => row.status);
      logger.info('Available payment status values:', paymentStatusValues);
      
      // Determine the new status based on Pesapal status
      const upperStatus = status.payment_status_description 
        ? status.payment_status_description.toUpperCase() 
        : 'PENDING';
      
      let newStatus = 'PENDING';
      let newPaymentStatus = 'PENDING';
      
      // Log the available payment status values for debugging
      logger.info('Available payment status values:', paymentStatusValues);
      
      // Map status based on what's actually in the database
      if (upperStatus === 'COMPLETED' || upperStatus === 'PAID') {
        // Keep the order as PENDING even if payment is completed
        // The status will be updated to PROCESSING/COMPLETED later in the workflow
        newStatus = 'PENDING';
        newPaymentStatus = paymentStatusValues.includes('PAID') ? 'PAID' : 
                          paymentStatusValues.includes('COMPLETED') ? 'COMPLETED' :
                          paymentStatusValues[0]; // Fallback to first available status
      } else if (upperStatus === 'FAILED' || upperStatus === 'INVALID') {
        newStatus = 'FAILED';
        newPaymentStatus = paymentStatusValues.includes('FAILED') ? 'FAILED' : 
                          paymentStatusValues[0];
      } else if (upperStatus === 'CANCELLED') {
        newStatus = 'CANCELLED';
        newPaymentStatus = paymentStatusValues.includes('CANCELLED') ? 'CANCELLED' :
                          paymentStatusValues.includes('FAILED') ? 'FAILED' :
                          paymentStatusValues[0];
      }
      
      // Ensure we're using a valid payment status
      if (!paymentStatusValues.includes(newPaymentStatus)) {
        logger.warn(`Payment status '${newPaymentStatus}' not in allowed values, using first available`);
        newPaymentStatus = paymentStatusValues[0];
      }
      
      logger.info('Updating order with status:', { 
        newStatus, 
        newPaymentStatus,
        orderId: currentOrder.id 
      });
      
      // Update the order with the new status
      await client.query(
        `UPDATE product_orders 
         SET status = $1::order_status,
             payment_status = $2::payment_status,
             payment_reference = $3,
             updated_at = NOW(),
             paid_at = CASE WHEN $2::text = ANY(ARRAY['PAID', 'COMPLETED']::text[]) THEN COALESCE(paid_at, NOW()) ELSE paid_at END
         WHERE id = $4`,
        [newStatus, newPaymentStatus, OrderTrackingId, currentOrder.id]
      );
      
      logger.info('Successfully updated order status');
      
      await client.query('COMMIT');
      
      // Send WhatsApp notifications ONLY if payment is successful
      if (upperStatus === 'COMPLETED' || upperStatus === 'PAID') {
        logger.info('Payment successful - sending WhatsApp notifications');
        
        // Fetch full order details for notifications
        const fullOrderResult = await pool.query(
          `SELECT po.*, b.full_name as buyer_name, b.phone as buyer_phone, b.email as buyer_email
           FROM product_orders po
           LEFT JOIN buyers b ON po.buyer_id = b.id
           WHERE po.id = $1`,
          [currentOrder.id]
        );
        
        if (fullOrderResult.rows.length > 0) {
          const fullOrder = fullOrderResult.rows[0];
          
          // Fetch order items
          const itemsResult = await pool.query(
            `SELECT oi.*, p.name as product_name, p.seller_id
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [currentOrder.id]
          );
          
          const items = itemsResult.rows;
          const sellerId = items.length > 0 ? items[0].seller_id : null;
          
          // Prepare customer data
          const customer = {
            firstName: fullOrder.buyer_name?.split(' ')[0] || 'Customer',
            lastName: fullOrder.buyer_name?.split(' ').slice(1).join(' ') || '',
            phone: fullOrder.buyer_phone,
            email: fullOrder.buyer_email,
            countryCode: 'KE'
          };
          
          // Send notifications (non-blocking)
          this.sendOrderNotifications(fullOrder, items, customer, sellerId).catch(err => {
            logger.error('Error sending WhatsApp notifications after payment:', err);
          });
        }
      }
      
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
        'SELECT * FROM product_orders WHERE merchant_reference = $1 FOR UPDATE',
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
        `UPDATE product_orders 
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
      
      // If the payment is completed, update the payment status but keep order as PENDING
      // The order status will be updated to PROCESSING/COMPLETED later in the workflow
      if (upperStatus === 'COMPLETED' || upperStatus === 'PAID') {
        // Only update payment status, not order status
        await client.query(
          "UPDATE order_items SET status = 'PENDING', updated_at = NOW() WHERE order_id = $1",
          [updatedOrder.id] // Use the ID from the updated order
        );
        logger.info(`Updated order items to PENDING for order ${updatedOrder.id}`);
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
        'SELECT * FROM product_orders WHERE id = $1',
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
          
          // Update the payment status but keep the order as PENDING
          // The order status will be updated to PROCESSING/COMPLETED later in the workflow
          if (upperStatus !== order.payment_status) {
            await pool.query(
              'UPDATE product_orders SET payment_status = $1, updated_at = NOW() WHERE id = $2',
              [upperStatus, order.id]
            );
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

  /**
   * Send WhatsApp notifications for new order
   * @param {object} order - Order details
   * @param {array} items - Order items
   * @param {object} customer - Customer details
   * @param {number} sellerId - Seller ID
   */
  async sendOrderNotifications(order, items, customer, sellerId) {
    try {
      // Fetch seller and buyer details
      const sellerQuery = await pool.query(
        'SELECT id, full_name, phone, email FROM sellers WHERE id = $1',
        [sellerId]
      );
      
      if (sellerQuery.rows.length === 0) {
        logger.warn('Seller not found for order notifications');
        return;
      }
      
      const seller = sellerQuery.rows[0];
      
      // Prepare notification data
      const notificationData = {
        seller: {
          name: seller.full_name,
          phone: seller.phone,
          email: seller.email
        },
        buyer: {
          name: customer.firstName + ' ' + customer.lastName,
          phone: customer.phone,
          email: customer.email,
          location: customer.countryCode || 'Kenya'
        },
        order: {
          orderNumber: order.order_number,
          totalAmount: parseFloat(order.total_amount),
          status: order.status,
          createdAt: order.created_at
        },
        items: items.map(item => ({
          name: item.product_name || item.productName || 'Product',
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.product_price || item.price || 0)
        }))
      };
      
      // Send notifications to seller, buyer, and logistics partner
      await Promise.all([
        whatsappService.notifySellerNewOrder(notificationData),
        whatsappService.notifyBuyerOrderConfirmation(notificationData),
        whatsappService.sendLogisticsNotification(
          {
            id: order.id,
            order_id: order.order_number,
            total_amount: order.total_amount,
            amount: order.total_amount,
            items: items.map(item => ({
              name: item.product_name || item.productName || 'Product',
              product_name: item.product_name || item.productName || 'Product',
              quantity: parseInt(item.quantity) || 1,
              price: parseFloat(item.product_price || item.price || 0),
              product_price: parseFloat(item.product_price || item.price || 0)
            }))
          },
          {
            fullName: customer.firstName + ' ' + customer.lastName,
            full_name: customer.firstName + ' ' + customer.lastName,
            phone: customer.phone,
            email: customer.email,
            city: customer.countryCode || 'Kenya',
            location: customer.location || ''
          },
          {
            ...seller,
            shop_name: seller.business_name || seller.full_name,
            businessName: seller.business_name || seller.full_name
          }
        )
      ]);
      
      logger.info(`WhatsApp notifications sent for order ${order.order_number} (buyer, seller, and logistics)`);
      
    } catch (error) {
      logger.error('Error in sendOrderNotifications:', error);
      // Don't throw - notifications are not critical
    }
  }
}

export default new PesapalController();
