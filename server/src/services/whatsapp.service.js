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
        // New clean session ID to force fresh start
        this.sessionId = 'byblos-clean';
        this.sessionPath = path.join(process.cwd(), '.wwebjs_auth');
    }

    async initialize() {
        console.log('🔄 Initializing WhatsApp Client (Clean V2)...');

        try {
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: this.sessionId,
                    dataPath: this.sessionPath
                }),
                puppeteer: {
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--bypass-csp'
                    ]
                },
                // Spoof User-Agent to look like a real browser (Critical for preventing immediate logout)
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                // Use hardcoded remote version to prevent scraping crashes
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
                }
            });

            this.setupEventListeners();

            console.log('🚀 Launching Puppeteer...');
            await this.client.initialize();

        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp:', error.message);
        }
    }

    setupEventListeners() {
        // QR Code Handling
        this.client.on('qr', (qr) => {
            this.qrCode = qr;
            console.log('📱 START AUTHENTICATION: Scan the QR code below');
            console.log('------------------------------------------------');
            qrcode.generate(qr, { small: true });
            console.log('------------------------------------------------');
            console.log('🌐 QR also available at /api/whatsapp/qr');
        });

        // Successful Authentication
        this.client.on('authenticated', () => {
            console.log('🔐 Authenticated successfully! Saving session...');
            this.qrCode = null;
        });

        // Client Ready
        this.client.on('ready', () => {
            console.log('✅ WhatsApp Client is READY and CONNECTED!');
            this.isReady = true;
            this.qrCode = null;
        });

        // Auth Failure
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
            this.isReady = false;
        });

        // Disconnected
        this.client.on('disconnected', async (reason) => {
            console.log('🔌 Disconnected:', reason);
            this.isReady = false;
            // Note: We do NOT auto-rejoin here to avoid loops. 
            // Process manager (PM2) or manual restart is safer for now.
        });
    }

    /**
     * Send a message to a phone number
     */
    async sendMessage(phone, message) {
        if (!this.isReady) {
            console.warn('⚠️ Cannot send message: Client not ready');
            return false;
        }

        try {
            const formatted = this.formatPhoneNumber(phone);
            if (!formatted) throw new Error('Invalid phone number');

            await this.client.sendMessage(formatted, message);
            console.log(`✅ Message sent to ${formatted}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send message to ${phone}:`, error.message);
            return false;
        }
    }

    /**
     * Helper to format numbers to 254... format
     */
    formatPhoneNumber(phone) {
        if (!phone) return null;
        let p = phone.replace(/\D/g, ''); // Strip non-digits
        if (p.startsWith('0')) p = '254' + p.substring(1);
        if (!p.startsWith('254')) p = '254' + p;
        return p + '@c.us';
    }

    /**
     * Get the current QR Code
     */
    getQRCode() {
        return this.qrCode;
    }

    /**
     * Clean logout
     */
    async logout() {
        if (this.client) {
            try {
                await this.client.destroy();
                console.log('✅ Client destroyed');
            } catch (e) {
                console.error('⚠️ Error destroying client:', e.message);
            }
            this.client = null;
            this.isReady = false;
        }
    }

    // ==========================================
    // NOTIFICATION LOGIC (Business Logic)
    // ==========================================

    async notifySellerNewOrder(orderData) {
        const { seller, order, items } = orderData;
        if (!seller?.phone) return false;

        const itemsList = items.map((item, i) =>
            `${i + 1}. ${item.name} x${item.quantity} - KSh ${item.price.toLocaleString()}`
        ).join('\n');

        const msg = `
🎉 *NEW ORDER RECEIVED!*

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${order.totalAmount.toLocaleString()}

📋 *Items:*
${itemsList}

📍 *DROP-OFF:* Dynamic Mall, Tom Mboya St, Shop SL 32
⏰ Time: ${new Date().toLocaleString()}

Please drop off within 48h.
        `.trim();

        return this.sendMessage(seller.phone, msg);
    }

    async notifyBuyerOrderConfirmation(orderData) {
        const { buyer, order, items } = orderData;
        if (!buyer?.phone) return false;

        const itemsList = items.map((item, i) =>
            `${i + 1}. ${item.name} x${item.quantity} - KSh ${item.price.toLocaleString()}`
        ).join('\n');

        const msg = `
✅ *ORDER CONFIRMED!*

Thanks for ordering!
📦 *Order #${order.orderNumber}*
💰 Total: KSh ${order.totalAmount.toLocaleString()}

📋 *Items:*
${itemsList}

We'll notify you when it's ready for pickup!
        `.trim();

        return this.sendMessage(buyer.phone, msg);
    }

    async notifyBuyerStatusUpdate(updateData) {
        const { buyer, order, newStatus, notes } = updateData;
        if (!buyer?.phone) return false;

        let msg = '';
        if (newStatus === 'DELIVERY_PENDING') {
            msg = `✅ *PAYMENT SUCCESSFUL*\n\nOrder #${order.orderNumber} is confirmed. We will prepare it for pickup.`;
        } else if (newStatus === 'DELIVERY_COMPLETE') {
            msg = `📦 *READY FOR PICKUP*\n\nOrder #${order.orderNumber} is ready!\n📍 Dynamic Mall, Tom Mboya St, Shop SL 32\n\nPlease verify item before accepting!`;
        } else if (newStatus === 'COMPLETED') {
            msg = `🎉 *ORDER COMPLETED*\n\nOrder #${order.orderNumber} is complete. Thanks for shopping with Byblos!`;
        } else {
            msg = `📋 *STATUS UPDATE*\n\nOrder #${order.orderNumber}: ${newStatus}`;
        }

        if (notes) msg += `\nNote: ${notes}`;
        return this.sendMessage(buyer.phone, msg);
    }

    async notifySellerStatusUpdate(updateData) {
        const { seller, order, newStatus } = updateData;
        if (!seller?.phone) return false;

        let msg = `📋 Order #${order.orderNumber} status: ${newStatus}`;

        if (newStatus === 'DELIVERY_PENDING') {
            msg = `💰 *PAYMENT RECEIVED*\n\nOrder #${order.orderNumber} is paid. Please prepare for drop-off.`;
        } else if (newStatus === 'COMPLETED') {
            msg = `🎉 *ORDER COMPLETED*\n\nOrder #${order.orderNumber} is finished. Revenue added to balance.`;
        }

        return this.sendMessage(seller.phone, msg);
    }

    /**
     * Send refund approved notification to buyer
     */
    async sendRefundApprovedNotification(buyer, refundAmount) {
        if (!buyer?.phone) return false;

        const message = `
🎉 *REFUND APPROVED*

Your refund request has been approved!

💰 *Refund Amount:* KSh ${parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

✅ The refund will be processed to your registered M-Pesa number within 1-3 business days.

Thank you for your patience!

---
*Byblos Marketplace*
        `.trim();

        return this.sendMessage(buyer.phone, message);
    }

    /**
     * Send refund rejected notification to buyer
     */
    async sendRefundRejectedNotification(buyer, refundAmount, reason) {
        if (!buyer?.phone) return false;

        const message = `
❌ *REFUND REQUEST DECLINED*

Your refund request has been declined.

💰 *Requested Amount:* KSh ${parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📝 *Reason:* ${reason || 'Please contact support for more information.'}

Your refund balance remains available for future withdrawal requests.

---
*Byblos Marketplace*
        `.trim();

        return this.sendMessage(buyer.phone, message);
    }

    /**
     * Send new order notification to logistics partner
     */
    async sendLogisticsNotification(order, buyer, seller) {
        const logisticsNumber = '+254748137819';

        let itemsList = '';
        if (order.items && order.items.length > 0) {
            itemsList = order.items.map((item, index) =>
                `${index + 1}. ${item.name || item.product_name || 'Product'} - KSh ${parseFloat(item.price || item.product_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
            ).join('\n');
        }

        const message = `
🚚 *NEW ORDER FOR LOGISTICS*

📦 *Order #${order.id || order.orderNumber}*
💰 *Amount:* KSh ${order.totalAmount.toLocaleString()}

---
👤 *BUYER DETAILS*
Name: ${buyer.fullName || buyer.full_name || 'N/A'}
Phone: ${buyer.phone || 'N/A'}
Location: ${buyer.city ? `${buyer.city}, ${buyer.location || ''}` : 'N/A'}

---
🏪 *SELLER DETAILS*
Name: ${seller.shop_name || seller.businessName || seller.full_name || 'N/A'}
Phone: ${seller.phone || 'N/A'}

---
📦 *ORDER ITEMS*
${itemsList || 'No items listed'}

---
📍 *PICKUP/DROP-OFF LOCATION*
Dynamic Mall, Tom Mboya St, Nairobi, Kenya | SL 32

Please coordinate pickup/delivery within 48 hours.
        `.trim();

        return this.sendMessage(logisticsNumber, message);
    }

    /**
     * Send order cancellation notification to buyer
     */
    async sendBuyerOrderCancellationNotification(order, cancelledBy) {
        const buyerPhone = order.buyer_phone || order.phone;
        if (!buyerPhone) return false;

        const message = `
❌ *ORDER CANCELLED*

Your order has been cancelled ${cancelledBy === 'Seller' ? 'by the seller' : ''}.

📦 *Order #${order.id || order.orderNumber}*
💰 *Amount:* KSh ${order.totalAmount.toLocaleString()}

💵 *REFUND INFORMATION*
A full refund has been added to your account balance. You can withdraw it from your dashboard.

---
*Byblos Marketplace*
        `.trim();

        return this.sendMessage(buyerPhone, message);
    }

    /**
     * Send order cancellation notification to seller
     */
    async sendSellerOrderCancellationNotification(order, seller, cancelledBy) {
        if (!seller?.phone) return false;

        let message = '';
        if (cancelledBy === 'Seller') {
            message = `
❌ *ORDER CANCELLATION CONFIRMED*

You have successfully cancelled Order #${order.id || order.orderNumber}.

ℹ️ The buyer has been refunded. Do not ship this order.
            `.trim();
        } else {
            message = `
❌ *ORDER CANCELLED BY BUYER*

The buyer has cancelled Order #${order.id || order.orderNumber}.

ℹ️ The buyer has been refunded. Do not ship this order.
            `.trim();
        }

        return this.sendMessage(seller.phone, message);
    }

    /**
     * Send order cancellation notification to logistics partner
     */
    async sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy) {
        const logisticsNumber = '+254748137819';

        const message = `
❌ *ORDER CANCELLED*

📦 *Order #${order.id || order.orderNumber}*
🚫 *Cancelled By:* ${cancelledBy || 'Buyer'}

⚠️ *Action Required:*
Please disregard instructions for this order. If picked up, please return to seller.
        `.trim();

        return this.sendMessage(logisticsNumber, message);
    }
}

export default new WhatsAppService();
