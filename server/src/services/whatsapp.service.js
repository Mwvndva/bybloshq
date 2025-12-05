import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.sessionPath = path.join(process.cwd(), 'whatsapp-sessions');
    
    // Ensure session directory exists
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize() {
    try {
      console.log('🔄 Initializing WhatsApp client...');
      
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'byblos-whatsapp',
          dataPath: this.sessionPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--force-color-profile=srgb',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
            '--disable-blink-features=AutomationControlled'
          ],
          // Increase timeout and handle navigation
          timeout: 60000,
          protocolTimeout: 120000
        },
        // Add webVersionCache to prevent version check issues
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
      });

      // QR Code event
      this.client.on('qr', (qr) => {
        console.log('📱 QR Code received!');
        console.log('QR Code length:', qr.length);
        console.log('QR Code (first 50 chars):', qr.substring(0, 50) + '...');
        console.log('🌐 Access QR code at: /api/whatsapp/qr');
        console.log('📷 Or visit: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qr));
        
        // Generate QR in terminal (if not in production)
        try {
          qrcode.generate(qr, { small: true });
        } catch (err) {
          console.log('⚠️ Could not generate QR in terminal:', err.message);
        }
        
        this.qrCode = qr;
        console.log('✅ QR Code stored and ready for retrieval');
      });

      // Ready event
      this.client.on('ready', () => {
        console.log('✅ WhatsApp client is ready!');
        this.isReady = true;
        this.qrCode = null;
      });

      // Authenticated event
      this.client.on('authenticated', () => {
        console.log('🔐 WhatsApp authenticated successfully');
      });

      // Authentication failure event
      this.client.on('auth_failure', (msg) => {
        console.error('❌ WhatsApp authentication failed:', msg);
        this.isReady = false;
      });

      // Disconnected event
      this.client.on('disconnected', (reason) => {
        console.log('🔌 WhatsApp client disconnected:', reason);
        this.isReady = false;
      });

      // Initialize the client with retry logic
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          console.log(`🔄 Attempting to initialize WhatsApp (${4 - retries}/3)...`);
          await this.client.initialize();
          console.log('✅ WhatsApp initialized successfully!');
          break;
        } catch (initError) {
          lastError = initError;
          retries--;
          console.log(`⚠️  Initialization attempt failed. ${retries} retries remaining.`);
          
          if (retries > 0) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
      
      if (retries === 0) {
        throw lastError;
      }
      
    } catch (error) {
      console.error('❌ Error initializing WhatsApp client:', error.message);
      console.log('💡 Tip: Try running the initialization manually via /api/whatsapp/initialize');
      throw error;
    }
  }

  /**
   * Format phone number to WhatsApp format
   * @param {string} phone - Phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with country code (254 for Kenya)
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    
    // If doesn't start with country code, add it
    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    // WhatsApp format: countrycode + number + @c.us
    return cleaned + '@c.us';
  }

  /**
   * Send a message via WhatsApp
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} - Success status
   */
  async sendMessage(phoneNumber, message) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Message not sent.');
        return false;
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      if (!formattedNumber) {
        console.error('❌ Invalid phone number:', phoneNumber);
        return false;
      }

      console.log(`📤 Sending WhatsApp message to ${phoneNumber} (${formattedNumber})`);
      
      await this.client.sendMessage(formattedNumber, message);
      
      console.log(`✅ WhatsApp message sent successfully to ${phoneNumber}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error sending WhatsApp message to ${phoneNumber}:`, error);
      return false;
    }
  }

  /**
   * Send new order notification to seller
   * @param {object} orderData - Order details
   * @returns {Promise<boolean>}
   */
  async notifySellerNewOrder(orderData) {
    try {
      console.log('=== NOTIFY SELLER NEW ORDER ===');
      console.log('Order data received:', JSON.stringify(orderData, null, 2));
      
      const { seller, order, items, buyer } = orderData;
      
      if (!seller?.phone) {
        console.warn('⚠️ Seller phone number not available');
        return false;
      }

      console.log('Seller phone:', seller.phone ? '[REDACTED]' : 'missing');
      console.log('Order items:', items);

      const itemsList = items.map((item, index) => 
        `${index + 1}. ${item.name} x${item.quantity} - KSh ${item.price.toLocaleString()}`
      ).join('\n');

      const message = `
🎉 *NEW ORDER RECEIVED!*

You have a new order!

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Total: KSh ${order.totalAmount.toLocaleString()}

📋 *Items:*
${itemsList}

⏰ Order Time: ${new Date(order.createdAt).toLocaleString()}

📍 *DROP-OFF LOCATION:*
Dynamic Mall, Tom Mboya St, Nairobi, Kenya
Shop: SL 32

⚠️ *IMPORTANT INSTRUCTIONS:*
1. Package the item according to Order #${order.orderNumber}
2. Drop it off at the location above in good condition
3. After drop-off, click "Ready for Pickup" button in the app to notify the buyer
4. Complete drop-off within 48 hours or the order will be cancelled automatically

This ensures your sale is completed successfully! ✅

---
Byblos Platform
      `.trim();

      console.log('Sending message to seller:', seller.phone ? '[REDACTED]' : 'missing');
      const result = await this.sendMessage(seller.phone, message);
      console.log('Seller notification result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error sending new order notification to seller:', error);
      return false;
    }
  }

  /**
   * Send order confirmation to buyer
   * @param {object} orderData - Order details
   * @returns {Promise<boolean>}
   */
  async notifyBuyerOrderConfirmation(orderData) {
    try {
      console.log('=== NOTIFY BUYER ORDER CONFIRMATION ===');
      console.log('Order data received:', JSON.stringify(orderData, null, 2));
      
      const { buyer, order, items, seller } = orderData;
      
      if (!buyer?.phone) {
        console.warn('⚠️ Buyer phone number not available');
        return false;
      }

      console.log('Buyer phone:', buyer.phone);
      console.log('Order items:', items);

      const itemsList = items.map((item, index) => 
        `${index + 1}. ${item.name} x${item.quantity} - KSh ${item.price.toLocaleString()}`
      ).join('\n');

      const message = `
✅ *ORDER CONFIRMED!*

Hi! 👋

Thank you for your order!

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Total: KSh ${order.totalAmount.toLocaleString()}

📋 *Items:*
${itemsList}

⏰ Order Time: ${new Date(order.createdAt).toLocaleString()}

We'll notify you when your order is ready for pickup!

---
Byblos Platform
      `.trim();

      console.log('Sending message to buyer:', buyer.phone);
      const result = await this.sendMessage(buyer.phone, message);
      console.log('Buyer notification result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error sending order confirmation to buyer:', error);
      return false;
    }
  }

  /**
   * Send order status update to buyer
   * @param {object} updateData - Status update details
   * @returns {Promise<boolean>}
   */
  async notifyBuyerStatusUpdate(updateData) {
    try {
      const { buyer, order, oldStatus, newStatus, notes, seller } = updateData;
      
      if (!buyer?.phone) {
        console.warn('⚠️ Buyer phone number not available');
        return false;
      }

      const statusEmojis = {
        'PENDING': '⏳',
        'DELIVERY_PENDING': '🚚',
        'PROCESSING': '⚙️',
        'DELIVERY_COMPLETE': '📦',
        'SHIPPED': '🚚',
        'DELIVERED': '✅',
        'COMPLETED': '🎉',
        'CANCELLED': '❌'
      };

      const emoji = statusEmojis[newStatus] || '📋';

      let message = '';

      if (newStatus === 'DELIVERY_PENDING') {
        // Payment successful message
        message = `
✅ *PAYMENT SUCCESSFUL!*

Hi! 👋

Great news! Your payment has been processed successfully.

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Amount: KSh ${order.totalAmount?.toLocaleString() || 'N/A'}

🚚 *What's Next:*
Your order is now being prepared for pickup. We'll notify you once it's ready for collection.

⏰ Payment Confirmed: ${new Date().toLocaleString()}

Thank you for your purchase! 🙏

---
Byblos Platform
        `.trim();
      } else if (newStatus === 'DELIVERY_COMPLETE') {
        // Special message with pickup details
        message = `
📦 *ORDER READY FOR PICKUP!*

Hi! 👋

Great news! Your order is ready for collection.

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Amount: KSh ${order.totalAmount?.toLocaleString() || 'N/A'}

📍 *PICKUP LOCATION:*
Dynamic Mall, Tom Mboya St, Nairobi, Kenya
Shop: SL 32

📞 *Next Steps:*
1. Visit the pickup location above
2. Ask for your package using Order #${order.orderNumber}
3. Inspect the item to ensure it's what you ordered and in good condition
4. Once satisfied, confirm receipt in the app to complete the order

${notes ? `💬 Note: ${notes}\n` : ''}
⏰ Ready Since: ${new Date().toLocaleString()}

⚠️ *IMPORTANT:*
• Only confirm the order after inspecting your package!
• Pick up within 48 hours or the package will be returned

---
Byblos Platform
        `.trim();
      } else if (newStatus === 'COMPLETED') {
        // Thank you message when order is completed
        message = `
🎉 *THANK YOU!*

Hi! 👋

Your order has been completed successfully!

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Total: KSh ${order.totalAmount?.toLocaleString() || 'N/A'}

Thank you for shopping with us! We hope you love your purchase! ❤️

We'd love to hear your feedback. Please rate your experience on our platform.

Looking forward to serving you again! 🛍️

⏰ Completed: ${new Date().toLocaleString()}

---
Byblos Platform
        `.trim();
      } else {
        // Default status update message
        message = `
${emoji} *ORDER STATUS UPDATE*

Hi! 👋

Your order status has been updated:

📦 *Order Details:*
Order #: ${order.orderNumber}
🔄 Status: ${oldStatus} → *${newStatus}*
`;

        if (notes) {
          message += `\n💬 *Note:* ${notes}\n`;
        }

        if (newStatus === 'SHIPPED') {
          message += `\n📦 Your order is on its way! You'll receive it soon.\n`;
        } else if (newStatus === 'DELIVERED') {
          message += `\n✅ Your order has been delivered! We hope you love your purchase!\n`;
        } else if (newStatus === 'CANCELLED') {
          message += `\n❌ Your order has been cancelled. If you have questions, please contact support.\n`;
        }

        message += `\n⏰ *Updated:* ${new Date().toLocaleString()}\n\n---\nByblos Platform`;
        message = message.trim();
      }

      return await this.sendMessage(buyer.phone, message);
      
    } catch (error) {
      console.error('❌ Error sending status update to buyer:', error);
      return false;
    }
  }

  /**
   * Send order status update to seller
   * @param {object} updateData - Status update details
   * @returns {Promise<boolean>}
   */
  async notifySellerStatusUpdate(updateData) {
    try {
      const { seller, order, oldStatus, newStatus, notes, buyer } = updateData;
      
      if (!seller?.phone) {
        console.warn('⚠️ Seller phone number not available');
        return false;
      }

      let message = '';

      if (newStatus === 'DELIVERY_PENDING') {
        // Payment received message for seller
        message = `
💰 *PAYMENT RECEIVED!*

Hi! 👋

Great news! You've received a new order with confirmed payment.

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Amount: KSh ${order.totalAmount?.toLocaleString() || 'N/A'}

👤 *Customer:*
Name: ${buyer.name}
Phone: ${buyer.phone}

🚚 *Next Steps:*
Please prepare the order for pickup. Once ready, mark it as "Ready for Pickup" in your seller dashboard.

⏰ Payment Received: ${new Date().toLocaleString()}

Thank you for using our platform! 🙏

---
Byblos Platform
        `.trim();
      } else if (newStatus === 'DELIVERY_COMPLETE') {
        message = `
✅ *BUYER NOTIFIED*

Hi! The buyer has been notified that their order is ready for pickup.

📦 *Order Details:*
Order #: ${order.orderNumber}

The buyer will contact you to arrange pickup.

⏰ Notified: ${new Date().toLocaleString()}

---
Byblos Platform
        `.trim();
      } else if (newStatus === 'COMPLETED') {
        // Message when order is completed
        message = `
🎉 *ORDER COMPLETED*

Order has been marked as completed!

📦 *Order Details:*
Order #: ${order.orderNumber}
💰 Amount: KSh ${order.totalAmount?.toLocaleString() || 'N/A'}

Thank you for fulfilling this order! 🙏

⏰ Completed: ${new Date().toLocaleString()}

---
Byblos Platform
        `.trim();
      } else {
        // Default status update message
        message = `
📋 *ORDER STATUS UPDATED*

Order #${order.orderNumber} status changed:

🔄 ${oldStatus} → *${newStatus}*
${notes ? `\n💬 Note: ${notes}` : ''}

⏰ Updated: ${new Date().toLocaleString()}

---
Byblos Platform
        `.trim();
      }

      return await this.sendMessage(seller.phone, message);
      
    } catch (error) {
      console.error('❌ Error sending status update to seller:', error);
      return false;
    }
  }

  /**
   * Get QR code for authentication
   * @returns {string|null} - QR code string
   */
  getQRCode() {
    return this.qrCode;
  }

  /**
   * Check if WhatsApp is ready
   * @returns {boolean}
   */
  isClientReady() {
    return this.isReady;
  }

  /**
   * Logout and destroy session
   */
  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
        this.isReady = false;
        this.qrCode = null;
        console.log('✅ WhatsApp client logged out successfully');
      }
    } catch (error) {
      console.error('❌ Error logging out WhatsApp client:', error);
    }
  }

  /**
   * Send refund approved notification to buyer
   */
  async sendRefundApprovedNotification(buyer, refundAmount) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Refund approved notification not sent.');
        return false;
      }

      const message = `
🎉 *REFUND APPROVED*

Your refund request has been approved!

💰 *Refund Amount:* KSh ${parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

✅ The refund will be processed to your registered M-Pesa number within 1-3 business days.

📱 *Payment Details:* ${buyer.phone}

Thank you for your patience!

---
*Byblos Marketplace*
      `.trim();

      console.log(`📤 Sending refund approved notification to buyer: ${buyer.fullName} (${buyer.phone})`);
      return await this.sendMessage(buyer.phone, message);
      
    } catch (error) {
      console.error('❌ Error sending refund approved notification:', error);
      return false;
    }
  }

  /**
   * Send refund rejected notification to buyer
   */
  async sendRefundRejectedNotification(buyer, refundAmount, reason) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Refund rejected notification not sent.');
        return false;
      }

      const message = `
❌ *REFUND REQUEST DECLINED*

Your refund request has been declined.

💰 *Requested Amount:* KSh ${parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📝 *Reason:* ${reason || 'Please contact support for more information.'}

Your refund balance remains available for future withdrawal requests.

If you have any questions, please contact our support team.

---
*Byblos Marketplace*
      `.trim();

      console.log(`📤 Sending refund rejected notification to buyer: ${buyer.fullName} (${buyer.phone})`);
      return await this.sendMessage(buyer.phone, message);
      
    } catch (error) {
      console.error('❌ Error sending refund rejected notification:', error);
      return false;
    }
  }

  /**
   * Send new order notification to logistics partner
   */
  async sendLogisticsNotification(order, buyer, seller) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Logistics notification not sent.');
        return false;
      }

      // Logistics partner number
      const logisticsNumber = '+254748137819';

      // Format items
      let itemsList = '';
      if (order.items && order.items.length > 0) {
        itemsList = order.items.map((item, index) => 
          `${index + 1}. ${item.name || item.product_name || 'Product'} - KSh ${parseFloat(item.price || item.product_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
        ).join('\n');
      }

      const totalAmount = order.total_amount || order.amount || 0;

      const message = `
🚚 *NEW ORDER FOR LOGISTICS*

📦 *Order #${order.id || order.order_id}*
💰 *Amount:* KSh ${parseFloat(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

---
👤 *BUYER DETAILS*
Name: ${buyer.fullName || buyer.full_name || 'N/A'}
Phone: ${buyer.phone || 'N/A'}
Email: ${buyer.email || 'N/A'}
Location: ${buyer.city ? `${buyer.city}, ${buyer.location || ''}` : 'N/A'}

---
🏪 *SELLER DETAILS*
Name: ${seller.shop_name || seller.businessName || seller.full_name || 'N/A'}
Phone: ${seller.phone || 'N/A'}
Email: ${seller.email || 'N/A'}

---
📦 *ORDER ITEMS*
${itemsList || 'No items listed'}

---
📍 *PICKUP/DROP-OFF LOCATION*
Dynamic Mall, Tom Mboya St, Nairobi, Kenya | SL 32

⏰ *Action Required:*
Please coordinate with the seller for package pickup and ensure delivery to the drop-off point within 48 hours.

---
*Byblos Marketplace*
      `.trim();

      console.log(`📤 Sending logistics notification for Order #${order.id || order.order_id}`);
      return await this.sendMessage(logisticsNumber, message);
      
    } catch (error) {
      console.error('❌ Error sending logistics notification:', error);
      return false;
    }
  }

  /**
   * Send order cancellation notification to buyer
   */
  async sendBuyerOrderCancellationNotification(order, cancelledBy) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Buyer cancellation notification not sent.');
        return false;
      }

      // Format items
      let itemsList = '';
      if (order.items && order.items.length > 0) {
        itemsList = order.items.map((item, index) => 
          `${index + 1}. ${item.name || item.product_name || 'Product'} - KSh ${parseFloat(item.price || item.product_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
        ).join('\n');
      }

      const totalAmount = order.total_amount || order.amount || 0;
      const buyerPhone = order.buyer_phone || order.phone;

      const message = `
❌ *ORDER CANCELLED*

Your order has been cancelled ${cancelledBy === 'Seller' ? 'by the seller' : ''}.

📦 *Order #${order.id || order.order_id}*
💰 *Amount:* KSh ${parseFloat(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

---
📦 *CANCELLED ITEMS*
${itemsList || 'No items listed'}

---
💵 *REFUND INFORMATION*
A full refund of KSh ${parseFloat(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been added to your account balance.

You can request a withdrawal from your refund balance in your buyer dashboard.

If you have any questions, please contact our support team.

---
*Byblos Marketplace*
      `.trim();

      console.log(`📤 Sending buyer cancellation notification for Order #${order.id || order.order_id}`);
      return await this.sendMessage(buyerPhone, message);
      
    } catch (error) {
      console.error('❌ Error sending buyer cancellation notification:', error);
      return false;
    }
  }

  /**
   * Send order cancellation notification to seller
   */
  async sendSellerOrderCancellationNotification(order, seller, cancelledBy) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Seller cancellation notification not sent.');
        return false;
      }

      // Format items
      let itemsList = '';
      if (order.items && order.items.length > 0) {
        itemsList = order.items.map((item, index) => 
          `${index + 1}. ${item.name || item.product_name || 'Product'} - KSh ${parseFloat(item.price || item.product_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
        ).join('\n');
      }

      const totalAmount = order.total_amount || order.amount || 0;

      let messageContent = '';
      if (cancelledBy === 'Seller') {
        messageContent = `
❌ *ORDER CANCELLATION CONFIRMED*

You have successfully cancelled this order.

📦 *Order #${order.id || order.order_id}*
💰 *Amount:* KSh ${parseFloat(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

---
📦 *CANCELLED ITEMS*
${itemsList || 'No items listed'}

---
ℹ️ *INFORMATION*
The buyer has been refunded the full order amount.

Please ensure you do not prepare or ship this order.

---
*Byblos Marketplace*
        `.trim();
      } else {
        messageContent = `
❌ *ORDER CANCELLED BY BUYER*

The buyer has cancelled this order.

📦 *Order #${order.id || order.order_id}*
💰 *Amount:* KSh ${parseFloat(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

---
📦 *CANCELLED ITEMS*
${itemsList || 'No items listed'}

---
ℹ️ *INFORMATION*
The buyer has been refunded the full order amount.

Please ensure you do not prepare or ship this order.

---
*Byblos Marketplace*
        `.trim();
      }

      console.log(`📤 Sending seller cancellation notification for Order #${order.id || order.order_id}`);
      return await this.sendMessage(seller.phone, messageContent);
      
    } catch (error) {
      console.error('❌ Error sending seller cancellation notification:', error);
      return false;
    }
  }

  /**
   * Send order cancellation notification to logistics partner
   */
  async sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy) {
    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client is not ready. Logistics cancellation notification not sent.');
        return false;
      }

      // Logistics partner number
      const logisticsNumber = '+254748137819';

      // Format items
      let itemsList = '';
      if (order.items && order.items.length > 0) {
        itemsList = order.items.map((item, index) => 
          `${index + 1}. ${item.name || item.product_name || 'Product'} - KSh ${parseFloat(item.price || item.product_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
        ).join('\n');
      }

      const totalAmount = order.total_amount || order.amount || 0;

      const message = `
❌ *ORDER CANCELLED*

📦 *Order #${order.id || order.order_id}*
💰 *Amount:* KSh ${parseFloat(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🚫 *Cancelled By:* ${cancelledBy || 'Buyer'}

---
👤 *BUYER DETAILS*
Name: ${buyer.fullName || buyer.full_name || 'N/A'}
Phone: ${buyer.phone || 'N/A'}

---
🏪 *SELLER DETAILS*
Name: ${seller.shop_name || seller.businessName || seller.full_name || 'N/A'}
Phone: ${seller.phone || 'N/A'}

---
📦 *CANCELLED ITEMS*
${itemsList || 'No items listed'}

---
⚠️ *Action Required:*
This order has been cancelled. Please disregard any previous pickup/delivery instructions for Order #${order.id || order.order_id}.

If package has already been picked up, please return it to the seller.

---
*Byblos Marketplace*
      `.trim();

      console.log(`📤 Sending logistics cancellation notification for Order #${order.id || order.order_id}`);
      return await this.sendMessage(logisticsNumber, message);
      
    } catch (error) {
      console.error('❌ Error sending logistics cancellation notification:', error);
      return false;
    }
  }
}

// Create singleton instance
const whatsappService = new WhatsAppService();

export default whatsappService;

