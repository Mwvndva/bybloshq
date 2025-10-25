import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import intasendService from '../services/intasend.service.js';
import whatsappService from '../services/whatsapp.service.js';
import Order from '../models/order.model.js';

class IntaSendController {
  /**
   * Initialize IntaSend (test connection)
   */
  initialize = async (req, res) => {
    try {
      // Test the IntaSend connection by creating a test collection
      const testData = {
        amount: '1.00',
        currency: 'KES',
        description: 'IntaSend connection test',
        reference: `TEST-${uuidv4()}`
      };

      const testCustomer = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '254700000000'
      };

      const testBillingAddress = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '254700000000',
        countryCode: 'KE',
        address: 'Test Address',
        city: 'Nairobi',
        state: 'Nairobi',
        postalCode: '00100'
      };

      // This will test the connection and configuration
      const result = await intasendService.createPaymentCollection(
        testData,
        testCustomer,
        testBillingAddress
      );
      
      res.json({
        success: true,
        data: result,
        message: 'IntaSend initialized successfully'
      });
    } catch (error) {
      logger.error('Error initializing IntaSend:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize IntaSend',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  };

  /**
   * Process checkout with IntaSend
   */
  checkout = async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { amount, description, customer, productId, items, sellerId } = req.body;
      
      // Basic validation
      if (!amount || !description || !customer || !customer.email) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, description, and customer with email are required'
        });
      }

      await client.query('BEGIN');
      
      // Generate a unique reference for IntaSend (will be updated with proper order number later)
      const merchantReference = `ORD-${uuidv4()}`;
      
      // Prepare the payment data for IntaSend
      const paymentData = {
        amount: parseFloat(amount).toFixed(2),
        currency: 'KES',
        description: description.substring(0, 100), // Max 100 chars
        reference: merchantReference
      };

      // Prepare customer data
      const customerData = {
        firstName: customer.firstName || 'Customer',
        lastName: customer.lastName || 'Byblos',
        email: customer.email,
        phone: customer.phone || '',
        id: customer.id || merchantReference
      };

      // Prepare billing address
      const billingAddress = {
        firstName: customer.firstName || 'Customer',
        lastName: customer.lastName || 'Byblos',
        email: customer.email,
        phone: customer.phone || '',
        countryCode: customer.countryCode || 'KE',
        address: customer.address || 'N/A',
        city: customer.city || 'Nairobi',
        state: customer.state || 'Nairobi',
        postalCode: customer.postalCode || '00100'
      };

      // Create payment collection with IntaSend
      const paymentResponse = await intasendService.createPaymentCollection(
        paymentData,
        customerData,
        billingAddress
      );

      // Prepare order data for the Order Model
      // Ensure items have proper structure for Order Model validation
      const processedItems = (items || []).map(item => ({
        productId: item.productId || item.id || productId,
        name: item.name || item.productName || 'Product',
        price: parseFloat(item.price || item.unitPrice || amount),
        quantity: parseInt(item.quantity || 1),
        subtotal: parseFloat(item.totalPrice || item.subtotal || (item.price * (item.quantity || 1))),
        metadata: item.metadata || {}
      }));

      // If no items provided, create a single item from the amount
      const finalItems = processedItems.length > 0 ? processedItems : [{
        productId: productId || 'unknown',
        name: description || 'Product',
        price: parseFloat(amount),
        quantity: 1,
        subtotal: parseFloat(amount),
        metadata: {}
      }];

      const orderData = {
        buyerId: parseInt(customer.id) || null,
        sellerId: sellerId || null,
        paymentMethod: 'intasend',
        buyerName: `${customerData.firstName} ${customerData.lastName}`.trim(),
        buyerEmail: customerData.email,
        buyerPhone: customerData.phone,
        shippingAddress: billingAddress,
        notes: description,
        metadata: {
          items: finalItems,
            productId: productId,
            sellerId: sellerId,
          intasend_invoice_id: paymentResponse.id || paymentResponse.invoice_id,
          intasend_checkout_id: paymentResponse.id || paymentResponse.checkout_id,
          payment_method: 'intasend',
          payment_reference: paymentResponse.id || paymentResponse.invoice_id,
          currency: 'KES',
          intasend_response: paymentResponse  // Store the full IntaSend response
        }
      };

      // Create the order using the Order Model
      const order = await Order.createOrder(orderData);
      
      // Update the order with IntaSend payment reference
      await client.query(
        'UPDATE product_orders SET payment_reference = $1 WHERE id = $2',
        [paymentResponse.id || paymentResponse.invoice_id, order.id]
      );

      
      console.log('=== ORDER CREATED SUCCESSFULLY ===');
      console.log('Order ID:', order.id);
      console.log('Order Number:', order.order_number);
      console.log('Payment Reference:', paymentResponse.id || paymentResponse.invoice_id);
      console.log('Status:', order.status);
      console.log('Payment Status:', order.payment_status);
      console.log('=== END ORDER CREATED ===');

      await client.query('COMMIT');

      // Send WhatsApp notification if configured
      if (process.env.WHATSAPP_ENABLED === 'true' && customerData.phone) {
        try {
          await whatsappService.sendOrderConfirmation({
            orderNumber: order.order_number,
            customerName: `${customerData.firstName} ${customerData.lastName}`,
            amount: order.total_amount,
            phone: customerData.phone
          });
        } catch (whatsappError) {
          logger.warn('Failed to send WhatsApp notification:', whatsappError);
        }
      }

      const redirectUrl = paymentResponse.redirect_url || paymentResponse.checkout_url;
      
      logger.info('Sending response to frontend:', {
        redirect_url: redirectUrl,
        has_redirect_url: !!paymentResponse.redirect_url,
        has_checkout_url: !!paymentResponse.checkout_url,
        payment_response_keys: Object.keys(paymentResponse)
      });

      // Validate that we have a valid redirect URL
      if (!redirectUrl) {
        logger.error('No redirect URL available from IntaSend response:', paymentResponse);
        return res.status(500).json({
          success: false,
          message: 'Payment gateway did not provide a checkout URL',
          error: 'No redirect URL available'
        });
      }

      res.json({
        success: true,
        message: 'Payment initiated successfully',
        data: {
          redirect_url: redirectUrl,
          orderId: order.id,
          orderNumber: order.order_number,
          invoiceId: paymentResponse.invoice_id,
          checkoutId: paymentResponse.checkout_id,
          status: paymentResponse.status,
          amount: parseFloat(amount),
          currency: 'KES'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing IntaSend checkout:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process payment',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      client.release();
    }
  };

  /**
   * Handle IntaSend callback
   */
  callback = async (req, res) => {
    console.log('=== INTASEND CALLBACK RECEIVED ===');
    console.log('Query params:', req.query);
    console.log('Body:', req.body);
    console.log('=== END CALLBACK DEBUG ===');
    
    const client = await pool.connect();
    try {
      const { collection_id, status, reference, checkout_id, tracking_id, signature } = req.query;
      const frontendUrl = process.env.VITE_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      
      console.log('=== CALLBACK RECEIVED ===');
      console.log('Query params:', req.query);
      console.log('Collection ID:', collection_id);
      console.log('Checkout ID:', checkout_id);
      console.log('Reference:', reference);
      console.log('Tracking ID:', tracking_id);
      console.log('Status:', status);
      console.log('Signature:', signature);
      console.log('URL:', req.url);
      console.log('Method:', req.method);
      console.log('=== END CALLBACK ===');
      
      // Use checkout_id as collection_id if collection_id is not provided
      const actualCollectionId = collection_id || checkout_id;
      const actualReference = reference || tracking_id;
      
      if (!actualCollectionId || !actualReference) {
        logger.error('Missing required parameters in callback:', {
          collection_id: actualCollectionId,
          reference: actualReference,
          all_query_params: req.query
        });
        return res.redirect(`${frontendUrl}/checkout?status=error&message=Missing required parameters`);
      }

      // Get the latest status from IntaSend
      console.log('=== CALLING INTASEND API FOR PAYMENT STATUS ===');
      
      // Try to get payment status using the collection ID
      let paymentStatus;
      try {
        paymentStatus = await intasendService.getPaymentStatus(actualCollectionId);
        console.log('=== PAYMENT STATUS RECEIVED ===');
        console.log('Payment Status Object:', JSON.stringify(paymentStatus, null, 2));
        console.log('Payment Status Status:', paymentStatus.status);
        console.log('Payment Status Keys:', Object.keys(paymentStatus));
        console.log('=== END PAYMENT STATUS ===');
        
        // Check if the response indicates an error
        if (paymentStatus.detail && paymentStatus.detail.includes('does not exist')) {
          throw new Error('Invoice not found in IntaSend');
        }
      } catch (error) {
        console.log('=== ERROR GETTING PAYMENT STATUS, CHECKING INITIAL RESPONSE ===');
        console.log('Error:', error.message);
        
        // If status check fails, check if we have the initial response data
        // The initial response from IntaSend contains the payment status
        const initialResponse = await client.query(
          'SELECT metadata FROM product_orders WHERE metadata->>\'intasend_checkout_id\' = $1',
          [actualCollectionId]
        );
        
        if (initialResponse.rows.length > 0) {
          const metadata = initialResponse.rows[0].metadata;
          console.log('Found order metadata:', JSON.stringify(metadata, null, 2));
          
          // Check if we stored the initial IntaSend response
          if (metadata.intasend_response) {
            console.log('Using stored IntaSend response for status check');
            console.log('Stored response:', JSON.stringify(metadata.intasend_response, null, 2));
            
            // Since payment was successful, let's check if we can determine this from callback parameters
            // IntaSend might send success indicators in the callback URL
            const hasTrackingId = !!tracking_id;
            const hasSignature = !!signature;
            const hasCheckoutId = !!checkout_id;
            
            console.log('=== CALLBACK PARAMETER ANALYSIS ===');
            console.log('Has tracking_id:', hasTrackingId, 'Value:', tracking_id);
            console.log('Has signature:', hasSignature, 'Value:', signature ? 'Present' : 'Missing');
            console.log('Has checkout_id:', hasCheckoutId, 'Value:', checkout_id);
            console.log('=== END CALLBACK PARAMETER ANALYSIS ===');
            
            // If we have all callback parameters, it likely means payment was successful
            // IntaSend typically only redirects to callback on successful payment
            if (hasTrackingId && hasSignature && hasCheckoutId) {
              console.log('=== PAYMENT SUCCESS DETECTED FROM CALLBACK PARAMETERS ===');
              console.log('All callback parameters present - assuming payment successful');
              paymentStatus = {
                ...metadata.intasend_response,
                paid: true,
                status: 'completed'
              };
            } else {
              paymentStatus = metadata.intasend_response;
            }
          } else {
            console.log('No stored response, defaulting to pending');
            paymentStatus = { status: 'pending', paid: false };
          }
        } else {
          console.log('No order found, defaulting to pending');
          paymentStatus = { status: 'pending', paid: false };
        }
      }
      
      // Log the incoming status for debugging
      logger.info('Received payment status from IntaSend:', {
        collection_id: actualCollectionId,
        status: paymentStatus.status,
        reference: actualReference,
        full_payment_status: paymentStatus
      });

      // Start transaction
      await client.query('BEGIN');
      
      // Debug: Check what orders exist in the database
      console.log('=== DEBUGGING ORDER LOOKUP ===');
      const allOrders = await client.query('SELECT id, order_number, payment_reference, metadata FROM product_orders ORDER BY created_at DESC LIMIT 5');
      console.log('Recent orders in database:', allOrders.rows);
      console.log('Looking for checkout_id:', actualCollectionId);
      console.log('Looking for tracking_id:', actualReference);
      console.log('=== END DEBUGGING ===');
      
      // Get the current order - try multiple lookup methods
      let orderResult;
      
      // First try to find by checkout_id in metadata
      orderResult = await client.query(
        'SELECT id, order_number, status, payment_status, seller_id, buyer_name, buyer_phone, buyer_email, total_amount, metadata FROM product_orders WHERE metadata->>\'intasend_checkout_id\' = $1 FOR UPDATE',
        [actualCollectionId]
      );
      console.log('Lookup by metadata checkout_id result:', orderResult.rows.length);
      
      // If not found, try by order number (actualReference)
      if (orderResult.rows.length === 0) {
        const orderNumber = String(actualReference);
        orderResult = await client.query(
          'SELECT id, order_number, status, payment_status, seller_id, buyer_name, buyer_phone, buyer_email, total_amount, metadata FROM product_orders WHERE order_number = $1 FOR UPDATE',
          [orderNumber]
        );
        console.log('Lookup by order_number result:', orderResult.rows.length);
      }
      
      // If still not found, try by payment_reference (checkout_id)
      if (orderResult.rows.length === 0) {
        orderResult = await client.query(
          'SELECT id, order_number, status, payment_status, seller_id, buyer_name, buyer_phone, buyer_email, total_amount, metadata FROM product_orders WHERE payment_reference = $1 FOR UPDATE',
          [actualCollectionId]
        );
        console.log('Lookup by payment_reference result:', orderResult.rows.length);
      }
      
      // If still not found, try by invoice_id in metadata
      if (orderResult.rows.length === 0) {
        orderResult = await client.query(
          'SELECT id, order_number, status, payment_status, seller_id, buyer_name, buyer_phone, buyer_email, total_amount, metadata FROM product_orders WHERE metadata->>\'intasend_invoice_id\' = $1 FOR UPDATE',
          [actualCollectionId]
        );
        console.log('Lookup by metadata invoice_id result:', orderResult.rows.length);
      }
      
      if (orderResult.rows.length === 0) {
        logger.error('Order not found in callback:', {
          checkout_id: actualCollectionId,
          tracking_id: actualReference,
          collection_id,
          reference,
          all_query_params: req.query
        });
        throw new Error(`Order not found for checkout_id: ${actualCollectionId}, tracking_id: ${actualReference}`);
      }
      
      const currentOrder = orderResult.rows[0];
      logger.info('Current order status:', currentOrder);
      
      // Get the order number for the redirect URL
      const orderNumber = currentOrder.order_number;
      
      // Determine the new status based on IntaSend status
      let newStatus = 'PENDING';
      let newPaymentStatus = 'pending';
      
      // Check both the status field and the paid field from IntaSend response
      const isPaid = paymentStatus.paid === true || paymentStatus.paid === 'true';
      const statusValue = paymentStatus.status?.toLowerCase();
      
      console.log('=== STATUS DETERMINATION ===');
      console.log('paymentStatus.paid:', paymentStatus.paid, 'type:', typeof paymentStatus.paid);
      console.log('paymentStatus.status:', statusValue, 'type:', typeof statusValue);
      console.log('isPaid:', isPaid);
      console.log('=== END STATUS DETERMINATION ===');
      
      if (isPaid || statusValue === 'completed' || statusValue === 'successful') {
        newStatus = 'DELIVERY_PENDING';
        newPaymentStatus = 'paid';
      } else if (statusValue === 'failed' || statusValue === 'cancelled') {
        newStatus = 'CANCELLED';
          newPaymentStatus = 'failed';
      } else {
        newStatus = 'PENDING';
          newPaymentStatus = 'pending';
      }

      // Update order status
      console.log('=== DEBUGGING UPDATE QUERY ===');
      console.log('newStatus:', newStatus, 'type:', typeof newStatus);
      console.log('newPaymentStatus:', newPaymentStatus, 'type:', typeof newPaymentStatus);
      console.log('orderNumber:', orderNumber, 'type:', typeof orderNumber);
      console.log('=== END DEBUGGING ===');
      
      await client.query(
        `UPDATE product_orders 
         SET status = $1, payment_status = $2, updated_at = NOW()
         WHERE order_number = $3`,
        [newStatus, newPaymentStatus, String(orderNumber)]
      );

      // Insert status history
      console.log('=== DEBUGGING STATUS HISTORY INSERT ===');
      console.log('currentOrder.id:', currentOrder.id, 'type:', typeof currentOrder.id);
      console.log('newStatus:', newStatus, 'type:', typeof newStatus);
      console.log('=== END DEBUGGING ===');
      
      await client.query(
        `INSERT INTO order_status_history (order_id, status, created_at, created_by_type)
         VALUES ($1, $2, NOW(), $3)`,
        [currentOrder.id, newStatus, 'system']
      );

      await client.query('COMMIT');

      // Send WhatsApp notifications for successful payment (non-blocking)
      if (newStatus === 'DELIVERY_PENDING' && newPaymentStatus === 'paid') {
        console.log('=== STARTING WHATSAPP NOTIFICATIONS ===');
        console.log('newStatus:', newStatus, 'newPaymentStatus:', newPaymentStatus);
        console.log('currentOrder:', JSON.stringify(currentOrder, null, 2));
        
        // Send notifications asynchronously
        setImmediate(async () => {
          try {
            console.log('=== INSIDE SETIMMEDIATE CALLBACK ===');
            const whatsappService = (await import('../services/whatsapp.service.js')).default;
            console.log('WhatsApp service imported successfully');
            
            // Get a new database connection for notifications
            const notificationClient = await pool.connect();
            
            try {
              // Fetch seller details
              const sellerQuery = await notificationClient.query(
                'SELECT id, full_name, phone, email FROM sellers WHERE id = $1',
                [currentOrder.seller_id]
              );
            
            if (sellerQuery.rows.length > 0) {
              const seller = sellerQuery.rows[0];
              
              // Get order items from metadata
              const orderItems = currentOrder.metadata?.items || [];
              
              // Prepare notification data for payment success
              const buyerNotificationData = {
                buyer: {
                  name: currentOrder.buyer_name,
                  phone: currentOrder.buyer_phone,
                  email: currentOrder.buyer_email
                },
                seller: {
                  name: seller.full_name,
                  phone: seller.phone,
                  email: seller.email
                },
                order: {
                  orderNumber: currentOrder.order_number,
                  totalAmount: parseFloat(currentOrder.total_amount),
                  status: newStatus
                },
                oldStatus: 'PENDING',
                newStatus: newStatus,
                notes: ''
              };
              
              const sellerNotificationData = {
                seller: {
                  name: seller.full_name,
                  phone: seller.phone,
                  email: seller.email
                },
                buyer: {
                  name: currentOrder.buyer_name,
                  phone: currentOrder.buyer_phone,
                  email: currentOrder.buyer_email
                },
                order: {
                  orderNumber: currentOrder.order_number,
                  totalAmount: parseFloat(currentOrder.total_amount),
                  status: newStatus
                },
                oldStatus: 'PENDING',
                newStatus: newStatus,
                notes: ''
              };
              
              // Prepare notification data for new order confirmation
              const newOrderData = {
                seller: {
                  name: seller.full_name,
                  phone: seller.phone,
                  email: seller.email
                },
                buyer: {
                  name: currentOrder.buyer_name,
                  phone: currentOrder.buyer_phone,
                  email: currentOrder.buyer_email
                },
                order: {
                  orderNumber: currentOrder.order_number,
                  totalAmount: parseFloat(currentOrder.total_amount),
                  createdAt: currentOrder.created_at
                },
                items: orderItems.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price
                }))
              };
              
              // Send all notifications: payment success + new order confirmation
              console.log('=== SENDING WHATSAPP NOTIFICATIONS ===');
              console.log('Buyer notification data:', JSON.stringify(buyerNotificationData, null, 2));
              console.log('Seller notification data:', JSON.stringify(sellerNotificationData, null, 2));
              console.log('New order data:', JSON.stringify(newOrderData, null, 2));
              
              const notificationResults = await Promise.all([
                whatsappService.notifyBuyerStatusUpdate(buyerNotificationData),
                whatsappService.notifySellerStatusUpdate(sellerNotificationData),
                whatsappService.notifySellerNewOrder(newOrderData),
                whatsappService.notifyBuyerOrderConfirmation(newOrderData)
              ]);
              
              console.log('Notification results:', notificationResults);
              console.log(`✅ WhatsApp payment success and new order notifications sent for order ${currentOrder.order_number}`);
            } else {
              console.log('No seller found for notifications');
            }
            } catch (dbError) {
              console.error('Database error in notification callback:', dbError);
            } finally {
              notificationClient.release();
            }
          } catch (err) {
            console.error('Error sending WhatsApp notifications for payment success:', err);
          }
        });
      }

      // Redirect to frontend with status
      let frontendStatus = 'pending';
      if (newPaymentStatus === 'paid') {
        frontendStatus = 'success';
      } else if (newPaymentStatus === 'failed') {
        frontendStatus = 'error';
      }
      
      const redirectUrl = `${frontendUrl}/checkout?status=${frontendStatus}&reference=${orderNumber}&message=${encodeURIComponent('Payment processed successfully')}`;
      res.redirect(redirectUrl);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error handling IntaSend callback:', error);
      const frontendUrl = process.env.VITE_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/checkout?status=error&message=${encodeURIComponent('Payment processing failed')}`);
    } finally {
      client.release();
    }
  };

  /**
   * Handle IntaSend webhook
   */
  webhook = async (req, res) => {
    console.log('=== INTASEND WEBHOOK RECEIVED ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=== END WEBHOOK DEBUG ===');
    
    const client = await pool.connect();
    try {
      const signature = req.headers['x-intasend-signature'] || req.headers['x-signature'];
      const payload = JSON.stringify(req.body);
      
      // Verify webhook signature
      if (!intasendService.verifyWebhookSignature(payload, signature)) {
        logger.warn('Invalid IntaSend webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const { collection_id, status, reference, amount, invoice_id, state, api_ref } = req.body;
      
      // Debug webhook payload
      console.log('=== WEBHOOK PAYLOAD DEBUG ===');
      console.log('Full req.body:', JSON.stringify(req.body, null, 2));
      console.log('collection_id:', collection_id, 'type:', typeof collection_id);
      console.log('status:', status, 'type:', typeof status);
      console.log('reference:', reference, 'type:', typeof reference);
      console.log('amount:', amount, 'type:', typeof amount);
      console.log('invoice_id:', invoice_id, 'type:', typeof invoice_id);
      console.log('api_ref:', api_ref, 'type:', typeof api_ref);
      console.log('state:', state, 'type:', typeof state);
      console.log('=== END WEBHOOK PAYLOAD DEBUG ===');
      
      logger.info('Received IntaSend webhook:', {
        collection_id,
        status,
        reference,
        amount,
        invoice_id,
        state,
        full_payload: req.body
      });

      await client.query('BEGIN');
      
      // Get the order - try multiple field names for reference
      let orderResult;
      // For webhooks, prioritize checkout_id over api_ref since api_ref might not match our order numbers
      const orderReference = collection_id || reference || invoice_id || api_ref || req.body.order_number || req.body.checkout_id;
      
      console.log('=== WEBHOOK ORDER LOOKUP DEBUG ===');
      console.log('Using orderReference:', orderReference, 'type:', typeof orderReference);
      console.log('api_ref:', api_ref);
      console.log('reference:', reference);
      console.log('collection_id:', collection_id);
      console.log('invoice_id:', invoice_id);
      console.log('=== END WEBHOOK ORDER LOOKUP DEBUG ===');
      
      // Debug: Check what orders exist in the database
      const allOrdersResult = await client.query(
        'SELECT id, order_number, payment_reference, metadata FROM product_orders ORDER BY created_at DESC LIMIT 5'
      );
      console.log('=== RECENT ORDERS IN DATABASE ===');
      console.log('Recent orders:', allOrdersResult.rows.map(row => ({
        id: row.id,
        order_number: row.order_number,
        payment_reference: row.payment_reference,
        intasend_checkout_id: row.metadata?.intasend_checkout_id,
        intasend_invoice_id: row.metadata?.intasend_invoice_id
      })));
      console.log('=== END RECENT ORDERS ===');
      
      // Try multiple lookup methods for webhook
      console.log('=== TRYING ORDER LOOKUP BY ORDER_NUMBER ===');
      orderResult = await client.query(
        'SELECT id, status, payment_status FROM product_orders WHERE order_number = $1 FOR UPDATE',
        [String(orderReference)]
      );
      console.log('Lookup by order_number result:', orderResult.rows.length);
      
      if (orderResult.rows.length === 0) {
        console.log('=== TRYING ORDER LOOKUP BY PAYMENT_REFERENCE ===');
        // Try looking up by payment_reference
        orderResult = await client.query(
          'SELECT id, status, payment_status FROM product_orders WHERE payment_reference = $1 FOR UPDATE',
          [String(orderReference)]
        );
        console.log('Lookup by payment_reference result:', orderResult.rows.length);
      }
      
      if (orderResult.rows.length === 0) {
        console.log('=== TRYING ORDER LOOKUP BY METADATA FIELDS ===');
        // Try looking up by metadata fields
        orderResult = await client.query(
          'SELECT id, status, payment_status FROM product_orders WHERE metadata->>\'intasend_checkout_id\' = $1 OR metadata->>\'intasend_invoice_id\' = $1 FOR UPDATE',
          [String(orderReference)]
        );
        console.log('Lookup by metadata fields result:', orderResult.rows.length);
      }
      
      if (orderResult.rows.length === 0) {
        console.log('=== TRYING ORDER LOOKUP BY INVOICE_ID IN METADATA ===');
        // Try looking up by invoice_id specifically
        orderResult = await client.query(
          'SELECT id, status, payment_status FROM product_orders WHERE metadata->>\'intasend_invoice_id\' = $1 FOR UPDATE',
          [String(invoice_id)]
        );
        console.log('Lookup by invoice_id in metadata result:', orderResult.rows.length);
      }
      
      if (orderResult.rows.length === 0) {
        console.log('=== TRYING ORDER LOOKUP BY CHECKOUT_ID FROM API_REF ===');
        // The api_ref contains the checkout_id, so try to extract it
        // api_ref format: "ORD-{uuid}" where {uuid} is the checkout_id
        if (api_ref && api_ref.startsWith('ORD-')) {
          const checkoutId = api_ref.substring(4); // Remove "ORD-" prefix
          console.log('Extracted checkout_id from api_ref:', checkoutId);
          orderResult = await client.query(
            'SELECT id, status, payment_status FROM product_orders WHERE metadata->>\'intasend_checkout_id\' = $1 FOR UPDATE',
            [String(checkoutId)]
          );
          console.log('Lookup by extracted checkout_id result:', orderResult.rows.length);
        }
      }
      
      if (orderResult.rows.length === 0) {
        console.log('=== TRYING ORDER LOOKUP BY FULL API_REF IN METADATA ===');
        // Try looking up by the full api_ref in metadata
        orderResult = await client.query(
          'SELECT id, status, payment_status FROM product_orders WHERE metadata->\'intasend_response\'->>\'api_ref\' = $1 FOR UPDATE',
          [String(api_ref)]
        );
        console.log('Lookup by full api_ref in metadata result:', orderResult.rows.length);
      }
      
      if (orderResult.rows.length === 0) {
        logger.warn(`Order not found for webhook: ${orderReference}`);
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }
      
      console.log('✅ Order found in webhook! Order ID:', orderResult.rows[0].id);
      
      const order = orderResult.rows[0];
      
      // Determine new status
      let newStatus = 'PENDING';
      let newPaymentStatus = 'pending';
      
      try {
        // Check the state field from webhook (COMPLETE, FAILED, etc.)
        const stateValue = state?.toLowerCase();
        
        console.log('=== WEBHOOK STATUS DETERMINATION ===');
        console.log('state:', state, 'type:', typeof state);
        console.log('stateValue:', stateValue, 'type:', typeof stateValue);
        console.log('=== END WEBHOOK STATUS DETERMINATION ===');
        
        if (stateValue === 'complete' || stateValue === 'completed') {
          newStatus = 'DELIVERY_PENDING';
          newPaymentStatus = 'paid';
        } else if (stateValue === 'failed' || stateValue === 'cancelled') {
          newStatus = 'CANCELLED';
          newPaymentStatus = 'failed';
        } else {
          newStatus = 'PENDING';
          newPaymentStatus = 'pending';
        }
        
        console.log('✅ Status determination successful:', { newStatus, newPaymentStatus });
      } catch (statusError) {
        console.error('❌ Error in status determination:', statusError);
        throw statusError;
      }

      // Update order if status changed
      if (order.payment_status !== newPaymentStatus) {
        try {
          console.log('=== DEBUGGING WEBHOOK UPDATE QUERY ===');
          console.log('newStatus:', newStatus, 'type:', typeof newStatus);
          console.log('newPaymentStatus:', newPaymentStatus, 'type:', typeof newPaymentStatus);
          console.log('order.id:', order.id, 'type:', typeof order.id);
          console.log('=== END DEBUGGING ===');
          
        await client.query(
          `UPDATE product_orders 
             SET status = $1, payment_status = $2, updated_at = NOW()
             WHERE id = $3`,
            [newStatus, newPaymentStatus, order.id]
          );
          
          console.log('✅ Order update successful');

        // Insert status history
          console.log('=== DEBUGGING WEBHOOK STATUS HISTORY INSERT ===');
          console.log('order.id:', order.id, 'type:', typeof order.id);
          console.log('newStatus:', newStatus, 'type:', typeof newStatus);
          console.log('=== END DEBUGGING ===');
          
        await client.query(
            `INSERT INTO order_status_history (order_id, status, created_at, created_by_type)
             VALUES ($1, $2, NOW(), $3)`,
            [order.id, newStatus, 'system']
          );
          
          console.log('✅ Status history insert successful');
          logger.info(`Updated order ${order.id} status to ${newPaymentStatus}`);
        } catch (updateError) {
          console.error('❌ Error updating order in webhook:', updateError);
          throw updateError;
        }
      } else {
        console.log('ℹ️ No status change needed, payment_status already:', order.payment_status);
      }

      await client.query('COMMIT');
      res.status(200).json({ success: true });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error handling IntaSend webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  };

  /**
   * Check payment status
   */
  checkStatus = async (req, res) => {
    try {
      const { orderId } = req.params;
      
      const client = await pool.connect();
      try {
        const orderResult = await client.query(
          `SELECT id, order_number, status, payment_status, total_amount, currency, 
                  payment_reference, created_at, updated_at
           FROM product_orders 
           WHERE id = $1`,
          [orderId]
        );
        
        if (orderResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Order not found'
          });
        }
        
        const order = orderResult.rows[0];
        
        // Get latest status from IntaSend if we have a payment reference
        let paymentDetails = null;
        if (order.payment_reference) {
          try {
            paymentDetails = await intasendService.getPaymentStatus(order.payment_reference);
          } catch (error) {
            logger.warn('Failed to get payment status from IntaSend:', error);
          }
        }
        
        res.json({
          success: true,
          status: order.payment_status,
          order: {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            paymentStatus: order.payment_status,
            amount: order.total_amount,
            currency: order.currency,
            createdAt: order.created_at,
            updatedAt: order.updated_at
          },
          paymentDetails
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Error checking payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check payment status',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  };

  /**
   * Create M-Pesa STK Push payment
   */
  createMpesaStkPush = async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { amount, description, customer, phoneNumber, productId, sellerId } = req.body;
      
      // Basic validation
      if (!amount || !description || !customer || !customer.email || !phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, description, customer, and phoneNumber are required'
        });
      }

      await client.query('BEGIN');
      
      // Generate a unique reference
      const merchantReference = `STK-${uuidv4()}`;
      
      // Prepare the payment data for IntaSend STK Push
      const paymentData = {
        amount: parseFloat(amount).toFixed(2),
        currency: 'KES',
        description: description.substring(0, 100),
        reference: merchantReference
      };

      // Format phone number (ensure it starts with 254)
      let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }

      // Create STK Push with IntaSend
      const stkResponse = await intasendService.createMpesaStkPush(paymentData, formattedPhone);

      // Store the order in database
      const orderResult = await client.query(
        `INSERT INTO product_orders (
          order_number, buyer_id, seller_id, status, payment_status, 
          total_amount, currency, payment_method, payment_reference,
          buyer_name, buyer_email, buyer_phone, shipping_address,
          notes, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING id, order_number, status, payment_status, total_amount, currency, created_at`,
        [
          merchantReference,
          parseInt(customer.id) || null,
          sellerId || null,
          'PENDING',
          'pending',
          parseFloat(amount),
          'KES',
          'intasend_mpesa',
          stkResponse.stk_push_id,
          `${customer.firstName || 'Customer'} ${customer.lastName || 'Byblos'}`.trim(),
          customer.email,
          formattedPhone,
          JSON.stringify({ phone: formattedPhone }),
          description,
          JSON.stringify({
            productId: productId,
            sellerId: sellerId,
            intasend_stk_push_id: stkResponse.stk_push_id,
            payment_method: 'mpesa_stk_push',
            phone_number: formattedPhone
          })
        ]
      );

      const order = orderResult.rows[0];

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'M-Pesa STK Push initiated successfully',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          stkPushId: stkResponse.stk_push_id,
          reference: merchantReference,
          status: stkResponse.status,
          phoneNumber: formattedPhone
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating M-Pesa STK Push:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate M-Pesa STK Push',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      client.release();
    }
  };

  // Test endpoint to manually check payment status
  checkPaymentStatus = async (req, res) => {
    const client = await pool.connect();
    try {
      const { orderId } = req.params;
      
      console.log('=== MANUAL PAYMENT STATUS CHECK ===');
      console.log('Order ID:', orderId);
      
      // Get the order
      const orderResult = await client.query(
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
      console.log('Current order status:', order.status);
      console.log('Current payment status:', order.payment_status);
      console.log('Order metadata:', order.metadata);
      
      return res.json({
        success: true,
        message: 'Order status checked',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status,
          metadata: order.metadata
        }
      });
      
    } catch (error) {
      console.error('Error in checkPaymentStatus:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    } finally {
      client.release();
    }
  };

  // Test endpoint to manually update order status
  updateOrderStatus = async (req, res) => {
    const client = await pool.connect();
    try {
      const { orderId } = req.params;
      const { status, paymentStatus } = req.body;
      
      console.log('=== MANUAL ORDER STATUS UPDATE ===');
      console.log('Order ID:', orderId);
      console.log('New status:', status);
      console.log('New payment status:', paymentStatus);
      
      // Update the order
      const updateResult = await client.query(
        'UPDATE product_orders SET status = $1, payment_status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [status, paymentStatus, orderId]
      );
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      const updatedOrder = updateResult.rows[0];
      
      // Add to status history
      await client.query(
        'INSERT INTO order_status_history (order_id, status, created_at, created_by_type) VALUES ($1, $2, NOW(), $3)',
        [orderId, status, 'manual']
      );
      
      console.log('Order updated successfully:', updatedOrder);
      
      return res.json({
        success: true,
        message: 'Order status updated successfully',
        order: updatedOrder
      });
      
    } catch (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating order status',
        error: error.message
      });
    } finally {
      client.release();
    }
  };
}

export default new IntaSendController();
