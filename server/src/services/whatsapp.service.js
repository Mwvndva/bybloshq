import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.isReady = false;
        this.qrCode = null;
        this.authFolder = path.join(process.cwd(), 'baileys_auth_info');
    }

    async initialize() {
        console.log('🔄 Initializing WhatsApp Client (Baileys)...');

        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`ℹ️ Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                connectTimeoutMs: 60000,
                syncFullHistory: false, // Don't sync old history, faster startup
            });

            // Credential updates
            this.sock.ev.on('creds.update', saveCreds);

            // Connection updates
            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qrCode = qr;
                    console.log('📱 START AUTHENTICATION: Scan the QR code below');
                    qrcode.generate(qr, { small: true });
                    console.log('------------------------------------------------');
                    console.log('🌐 QR also available at /api/whatsapp/qr');
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('🔌 Connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);

                    this.isReady = false;
                    // Auto-reconnect if not strictly logged out
                    if (shouldReconnect) {
                        this.initialize();
                    } else {
                        console.log('❌ Logged out. Delete baileys_auth_info and restart to scan again.');
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp (Baileys) is READY and CONNECTED!');
                    this.isReady = true;
                    this.qrCode = null;
                }
            });

        } catch (error) {
            console.error('❌ Failed to initialize Baileys:', error);
        }
    }

    /**
     * Send a message to a phone number
     */
    async sendMessage(phone, message) {
        if (!this.isReady || !this.sock) {
            console.warn('⚠️ Cannot send message: Client not ready');
            return false;
        }

        try {
            const jid = this.formatToJid(phone);
            if (!jid) throw new Error('Invalid phone number');

            await this.sock.sendMessage(jid, { text: message });
            console.log(`✅ Message sent to ${jid}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send message to ${phone}:`, error.message);
            return false;
        }
    }

    /**
     * Helper to format numbers to 254... format -> jid
     */
    formatToJid(phone) {
        if (!phone) return null;
        let p = phone.replace(/\D/g, ''); // Strip non-digits
        if (p.startsWith('0')) p = '254' + p.substring(1);
        if (!p.startsWith('254')) p = '254' + p;
        return p + '@s.whatsapp.net';
    }

    /**
     * Get the current QR Code
     */
    getQRCode() {
        return this.qrCode;
    }

    isClientReady() {
        return this.isReady;
    }

    /**
     * Clean logout
     */
    async logout() {
        if (this.sock) {
            try {
                this.sock.end(undefined);
                console.log('✅ Socket closed');
            } catch (e) {
                console.error('⚠️ Error closing socket:', e.message);
            }
            this.sock = null;
            this.isReady = false;
        }
    }

    // ==========================================
    // NOTIFICATION LOGIC (Business Logic)
    // ==========================================

    async notifySellerNewOrder(orderData) {
        const { seller, order, items } = orderData;
        if (!seller?.phone) return false;

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()}`;
        }).join('\n');

        const total = parseFloat(order.totalAmount || 0);
        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        // Check for Service Booking Metadata
        let bookingInfo = '';
        if (isService && order.metadata?.booking_date) {
            const locationType = order.metadata.location_type;
            const locationLabel = locationType === 'seller_visits_buyer' ? 'Client Location' : 'Service Location';

            bookingInfo = `
📅 *SERVICE BOOKING DETAILS*
• Date: ${order.metadata.booking_date}
• Time: ${order.metadata.booking_time}
• ${locationLabel}: ${order.metadata.service_location || seller.location || seller.city || 'Not specified'}
`.trim();
        }

        let instructionText = `📍 *ACTION REQUIRED:* Please drop off items at Dynamic Mall, Shop SL 32 within 48h.`;

        if (isService) {
            instructionText = `ℹ️ *ACTION REQUIRED:* Please review the booking details above and contact the client if needed.`;
        } else if (isDigital) {
            instructionText = `ℹ️ *INFO:* Digital product order. No physical delivery required.`;
        }

        const msg = `
🎉 *NEW ORDER RECEIVED!*

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

${bookingInfo ? bookingInfo + '\n\n' : ''}${instructionText}
        `.trim();

        return this.sendMessage(seller.phone, msg);
    }

    async notifyBuyerOrderConfirmation(orderData) {
        const { buyer, seller, order, items } = orderData;
        if (!buyer?.phone) return false;

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()}`;
        }).join('\n');

        const total = parseFloat(order.totalAmount || 0);
        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        let bookingInfo = '';
        if (isService && order.metadata?.booking_date) {
            const locationType = order.metadata.location_type;
            const locationLabel = locationType === 'seller_visits_buyer' ? 'Client Location' : 'Service Location';

            bookingInfo = `
📅 *YOUR BOOKING IS CONFIRMED*
• Date: ${order.metadata.booking_date}
• Time: ${order.metadata.booking_time}
• ${locationLabel}: ${order.metadata.service_location || seller?.location || seller?.city || 'Not specified'}
`.trim();
        }

        let nextSteps = "We'll notify you when it's ready for pickup!";
        if (isService) {
            nextSteps = "The seller has been notified of your booking and will prepare for your appointment.";
        } else if (isDigital) {
            const dashboardUrl = `${process.env.FRONTEND_URL || 'https://byblos.hq'}/dashboard/orders`;
            nextSteps = `Your digital product is ready for download!\n🔗 Access it here: ${dashboardUrl}`;
        }

        const msg = `
✅ *ORDER CONFIRMED!*

Thanks for ordering, ${buyer.full_name?.split(' ')[0] || 'valued customer'}!

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

${bookingInfo ? bookingInfo + '\n\n' : ''}${nextSteps}
        `.trim();

        return this.sendMessage(buyer.phone, msg);
    }

    async notifyBuyerStatusUpdate(updateData) {
        const { buyer, order, newStatus, notes } = updateData;
        if (!buyer?.phone) return false;

        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        let msg = '';
        if (newStatus === 'DELIVERY_PENDING') {
            if (isService) {
                msg = `✅ *BOOKING CONFIRMED*\n\nOrder #${order.orderNumber} payment received. Your service booking is confirmed.`;
            } else if (isDigital) {
                msg = `✅ *PAYMENT SUCCESSFUL*\n\nOrder #${order.orderNumber} payment received. Your download is ready.`;
            } else {
                msg = `✅ *PAYMENT SUCCESSFUL*\n\nOrder #${order.orderNumber} is confirmed. We will prepare it for pickup.`;
            }
        } else if (newStatus === 'DELIVERY_COMPLETE') {
            if (isService) {
                // Should not really happen for services but handle gracefully
                msg = `✅ *SERVICE COMPLETED*\n\nOrder #${order.orderNumber} marked as complete.`;
            } else if (isDigital) {
                msg = `✅ *DIGITAL ORDER COMPLETE*\n\nOrder #${order.orderNumber} is complete.`;
            } else {
                msg = `📦 *READY FOR PICKUP*\n\nOrder #${order.orderNumber} is ready!\n📍 Dynamic Mall, Tom Mboya St, Shop SL 32\n\nPlease verify item before accepting!`;
            }
        } else if (newStatus === 'CONFIRMED' && isService) { // Custom status for Service
            msg = `✅ *BOOKING ACCEPTED*\n\nThe seller has accepted your booking for Order #${order.orderNumber}.`;
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

        const productType = order.metadata?.product_type;

        let msg = `📋 Order #${order.orderNumber} status: ${newStatus}`;

        if (newStatus === 'DELIVERY_PENDING') {
            msg = `💰 *PAYMENT RECEIVED*\n\nOrder #${order.orderNumber} is paid. Please prepare for drop-off/service.`;
        } else if (newStatus === 'CONFIRMED' && productType === 'service') {
            msg = `✅ *BOOKING CONFIRMED*\n\nYou have confirmed the booking for Order #${order.orderNumber}.`;
        } else if (newStatus === 'COMPLETED') {
            msg = `🎉 *ORDER COMPLETED*\n\nOrder #${order.orderNumber} is finished. Revenue added to balance.`;
        }

        return this.sendMessage(seller.phone, msg);
    }

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

    async sendLogisticsNotification(order, buyer, seller) {
        // Skip logistics notification for Digital and Service orders
        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        if (isService || isDigital) {
            console.log(`Skipping logistics notification for ${productType} order #${order.order_number}`);
            return true; // Return success (skipped)
        }

        const logisticsNumber = '+254748137819';

        let itemsList = '';
        if (order.items && order.items.length > 0) {
            itemsList = order.items.map((item, index) =>
                `${index + 1}. ${item.name || item.product_name || 'Product'} - KSh ${parseFloat(item.price || item.product_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${item.quantity}`
            ).join('\n');
        }

        const total = parseFloat(order.totalAmount || order.total_amount || 0);

        const message = `
🚚 *NEW ORDER FOR LOGISTICS*

📦 *Order #${order.id || order.orderNumber}*
💰 *Amount:* KSh ${total.toLocaleString()}

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
