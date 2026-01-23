import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.isReady = false;
        this.qrCode = null;
        this.authFolder = path.join(process.cwd(), 'baileys_auth_info');
    }

    async initialize() {
        logger.info('🔄 Initializing WhatsApp Client (Baileys)...');

        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            logger.info(`ℹ️ Using WA v${version.join('.')}, isLatest: ${isLatest}`);

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
                    logger.info('📱 START AUTHENTICATION: Scan the QR code below');
                    qrcode.generate(qr, { small: true });
                    logger.info('------------------------------------------------');
                    logger.info('🌐 QR also available at /api/whatsapp/qr');
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    logger.warn('🔌 Connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);

                    this.isReady = false;
                    // Auto-reconnect if not strictly logged out
                    if (shouldReconnect) {
                        this.initialize();
                    } else {
                        logger.error('❌ Logged out. Delete baileys_auth_info and restart to scan again.');
                    }
                } else if (connection === 'open') {
                    logger.info('✅ WhatsApp (Baileys) is READY and CONNECTED!');
                    this.isReady = true;
                    this.qrCode = null;
                }
            });

        } catch (error) {
            logger.error('❌ Failed to initialize Baileys:', error);
        }
    }

    /**
     * Send a message to a phone number
     */
    async sendMessage(phone, message) {
        if (!this.isReady || !this.sock) {
            const error = new Error('WhatsApp client not ready or not connected');
            logger.error('⚠️ Cannot send message: Client not ready');
            throw error;
        }

        try {
            const jid = this.formatToJid(phone);
            if (!jid) throw new Error(`Invalid phone number format: ${phone}`);

            await this.sock.sendMessage(jid, { text: message });
            logger.info(`✅ WhatsApp message sent successfully to ${phone}`);
            return true;
        } catch (error) {
            logger.error(`❌ Failed to send WhatsApp message to ${phone}:`, error.message);
            throw error; // Re-throw to allow calling code to handle
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
                logger.info('✅ Socket closed');
            } catch (e) {
                logger.error('⚠️ Error closing socket:', e.message);
            }
            this.sock = null;
            this.isReady = false;
        }
    }

    // ==========================================
    // NOTIFICATION LOGIC (Business Logic)
    // ==========================================

    /**
     * Extract service provider type from order data
     */
    getServiceProviderType(order) {
        const productName = (order.items?.[0]?.name || order.items?.[0]?.product_name || '').toLowerCase();

        const serviceMap = {
            'plumb': 'Plumber',
            'electric': 'Electrician',
            'clean': 'Cleaner',
            'paint': 'Painter',
            'carpenter': 'Carpenter',
            'carpentry': 'Carpenter',
            'mechanic': 'Mechanic',
            'repair': 'Technician',
            'hvac': 'HVAC Technician',
            'garden': 'Gardener',
            'landscap': 'Landscaper',
            'chef': 'Chef',
            'cook': 'Cook',
            'cater': 'Caterer',
            'photogra': 'Photographer',
            'video': 'Videographer',
            'tutor': 'Tutor',
            'teacher': 'Teacher',
            'driver': 'Driver',
            'transport': 'Driver',
            'security': 'Security Guard',
            'massage': 'Massage Therapist',
            'hair': 'Hairstylist',
            'barber': 'Barber',
            'makeup': 'Makeup Artist',
            'nail': 'Nail Technician',
            'tailor': 'Tailor',
            'laundry': 'Laundry Service',
            'pest': 'Pest Control Specialist',
        };

        for (const [keyword, type] of Object.entries(serviceMap)) {
            if (productName.includes(keyword)) {
                return type;
            }
        }

        return 'Service Provider';
    }

    async notifySellerNewOrder(orderData) {
        const { seller, order, items } = orderData;
        logger.info(`[WHATSAPP-SERVICE] notifySellerNewOrder called for seller: ${seller?.phone || 'NO_PHONE'}`);

        if (!seller?.phone) {
            logger.error('[WHATSAPP-SERVICE] ❌ Seller phone is missing!');
            return false;
        }

        logger.info(`[WHATSAPP-SERVICE] Processing ${items?.length || 0} items for order ${order?.orderNumber}`);
        logger.info(`[WHATSAPP-SERVICE] Seller data:`, JSON.stringify({ phone: seller.phone, name: seller.name, physicalAddress: seller.physicalAddress }, null, 2));

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()}`;
        }).join('\n');

        const total = parseFloat(order.totalAmount || 0);
        const productType = order.metadata?.product_type;
        const isService = productType === 'service';

        logger.info(`[WHATSAPP-SERVICE] Product type: ${productType}, isService: ${isService}`);
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
• ${locationLabel}: ${order.metadata.service_location || seller.physicalAddress || seller.location || seller.city || 'Not specified'}
`.trim();
        }

        let instructionText = `⚠️ *ACTION REQUIRED:*\nPlease drop off items at Dynamic Mall, Shop SL 32 within 48 hours.\n\n⏰ *DEADLINE:* Order will be auto-cancelled if not delivered by deadline.\n💰 Payment will be released 24 hours after buyer pickup.`;

        if (isService) {
            const serviceType = this.getServiceProviderType(order);
            instructionText = `⏰ *ACTION REQUIRED:*\nPlease review the booking details above and contact ${buyer?.full_name?.split(' ')[0] || 'the client'} to confirm the appointment.\n\n🔒 Payment (KSh ${total.toLocaleString()}) is secured and will be released 24 hours after the booking date ends.`;
        } else if (isDigital) {
            instructionText = `✅ *INFO:* Customer has received download link. No action required.\n\n💰 Revenue (KSh ${total.toLocaleString()}) will be added to your balance automatically.`;
        } else {
            // Physical Product Logic
            if (seller?.physicalAddress) {
                // Shop Collection Logic - No instruction needed, just notification
                instructionText = ``;
            } else {
                // Logistics / Drop-off Logic
                instructionText = `⚠️ *ACTION REQUIRED:*
Please drop off items at Dynamic Mall, Shop SL 32 within 48 hours.

⏰ *DEADLINE:* Order will be auto-cancelled if not delivered by deadline.
💰 Payment will be released 24 hours after buyer pickup.`;
            }
        }

        const header = isDigital ? '🎉 *NEW DIGITAL ORDER!*' : '🎉 *NEW ORDER RECEIVED!*';

        const msg = `
${header}

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

${bookingInfo ? bookingInfo + '\n\n' : ''}${instructionText}
        `.trim();

        logger.info(`[WHATSAPP-SERVICE] Message prepared, length: ${msg.length} chars`);
        logger.info(`[WHATSAPP-SERVICE] Attempting to send to: ${seller.phone}`);

        try {
            const result = await this.sendMessage(seller.phone, msg);
            logger.info(`[WHATSAPP-SERVICE] ✅ Message sent successfully to ${seller.phone}`);
            return result;
        } catch (error) {
            logger.error(`[WHATSAPP-SERVICE] ❌ Failed to send message to ${seller.phone}:`, error.message);
            logger.error(`[WHATSAPP-SERVICE] Error stack:`, error.stack);
            throw error;
        }
    }

    async notifyBuyerOrderConfirmation(orderData) {
        const { buyer, seller, order, items } = orderData;
        if (!buyer?.phone) return false;

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()} `;
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
📅 * YOUR BOOKING IS CONFIRMED *
• Date: ${order.metadata.booking_date}
• Time: ${order.metadata.booking_time}
• ${locationLabel}: ${order.metadata.service_location || seller?.physicalAddress || seller?.location || seller?.city || 'Not specified'}
`.trim();
        }

        const pickupLocation = seller?.physicalAddress || 'Dynamic Mall, Shop SL 32';
        let nextSteps = '';

        if (isService) {
            const serviceType = this.getServiceProviderType(order);
            nextSteps = `⏰ * WHAT'S NEXT:*\nYour ${serviceType} has been notified and will contact you to confirm the appointment details.\n\n🔒 Your payment (KSh ${total.toLocaleString()}) is secure and will be released 24 hours after the booking date ends.`;
        } else if (isDigital) {
            const dashboardUrl = `${process.env.FRONTEND_URL || 'https://byblos.hq'}/dashboard/orders`;
            nextSteps = `✅ *YOUR DOWNLOAD IS READY!*\n🔗 Access it here: ${dashboardUrl}`;
        } else {
            // Physical Product Logic
            // Physical Product Logic
            if (seller?.physicalAddress) {
                // Shop Collection Logic
                let mapsLink = '';
                // Since we don't always have lat/long in the notification object (unless added), 
                // we'll rely on address query.
                if (seller.latitude && seller.longitude) {
                    mapsLink = `https://www.google.com/maps?q=${seller.latitude},${seller.longitude}`;
                } else {
                    mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(seller.shop_name || seller.physicalAddress)}`;
                }

                // Updated to avoid "Ready immediately" per user request
                nextSteps = `📍 *PICKUP INSTRUCTIONS:*
Please pick up your order at:
*${seller.shop_name || 'The Shop'}*
${pickupLocation}

🗺️ *Location:* ${mapsLink}

✅ *STATUS:* Order Confirmed.
Please proceed to the shop for collection.`;
            } else {
                // Logistics/Drop-off Logic
                nextSteps = `📍 *NEXT STEPS:*
We'll notify you when it's ready for pickup at Dynamic Mall, Shop SL 32.

⏰ *SELLER DEADLINE:* Seller has 48 hours to drop off your order.`;
            }
        }

        const header = isDigital ? '🎉 *DIGITAL ORDER CONFIRMED!*' : '✅ *ORDER CONFIRMED!*';

        const msg = `
${header}

Thanks for ordering, ${buyer.full_name?.split(' ')[0] || 'valued customer'}!

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

${bookingInfo ? bookingInfo + '\n\n' : ''}${nextSteps}
        `.trim();

        logger.info(`[PURCHASE-FLOW] 9b. Sending Order Confirmation to Buyer ${buyer.phone}`);
        return this.sendMessage(buyer.phone, msg);
    }

    async notifyBuyerStatusUpdate(updateData) {
        const { buyer, order, newStatus, notes } = updateData;
        if (!buyer?.phone) return false;

        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        let msg = '';
        if (newStatus === 'COLLECTION_PENDING') {
            // This logic is mostly covered by the initial Order Confirmation now.
            // But if triggered manually later, it serves as a reminder.
            const amount = parseFloat(order.totalAmount || 0);
            const sellerAddr = updateData.seller?.physicalAddress || 'the shop';
            const shopName = updateData.seller?.shop_name || 'The Shop';

            let mapsLink = '';
            // handle map link... logic similar to above

            msg = `✅ *READY FOR COLLECTION*

💰 Amount: KSh ${amount.toLocaleString()}
📦 Order #${order.orderNumber} is confirmed.

📍 *PICKUP LOCATION:*
*${shopName}*
${sellerAddr}

⏰ *INSTRUCTIONS:*
Please proceed to the shop to collect your items.`;

        } else if (newStatus === 'COMPLETED') {
            // User Request: "After buyer clicks 'collected' sends order completion notification"
            msg = `🎉 *ORDER COMPLETED*

Order #${order.orderNumber} has been marked as collected/completed.
Thank you for shopping with Byblos!`;
        } else if (newStatus === 'DELIVERY_PENDING') {
            // Existing logic for Service/Digital...
            if (isService) {
                const serviceType = this.getServiceProviderType(order);
                const amount = parseFloat(order.totalAmount || 0);
                msg = `✅ *BOOKING CONFIRMED*

🎉 Payment received! Your ${serviceType} booking is confirmed.

💰 Amount Held: KSh ${amount.toLocaleString()}
🔒 Your payment is secure and will be released to the service provider 24 hours after job completion.

Order #${order.orderNumber}`;
            } else if (isDigital) {
                msg = `✅ *PAYMENT SUCCESSFUL*\n\nOrder #${order.orderNumber} payment received. Your download is ready.`;
            } else {
                // FALLBACK for Logistics (No Shop Address)
                const amount = parseFloat(order.totalAmount || 0);

                msg = `✅ *PAYMENT SUCCESSFUL*

💰 Amount: KSh ${amount.toLocaleString()}
📦 Order #${order.orderNumber} is confirmed.

⏰ *NEXT STEPS:*
We are preparing your order for pickup. You'll be notified when it's ready at Dynamic Mall, Shop SL 32.`;
            }
        } else if (newStatus === 'DELIVERY_COMPLETE') {
            if (isService) {
                const serviceType = this.getServiceProviderType(order);
                const amount = parseFloat(order.totalAmount || 0);
                msg = `⚠️ *ACTION REQUIRED*

Your ${serviceType} has marked the job as DONE.

💰 Amount: KSh ${amount.toLocaleString()}
⏰ Payment Release: We will release your payment to them in 24 hours.

✅ If the work is satisfactory, no action needed.
❌ If there are issues, please contact support immediately.`;
            } else if (isDigital) {
                msg = `✅ *DIGITAL ORDER COMPLETE*\n\nOrder #${order.orderNumber} is complete.`;
            } else {
                const amount = parseFloat(order.totalAmount || 0);
                const sellerAddr = updateData.seller?.physicalAddress || 'Dynamic Mall, Tom Mboya St, Shop SL 32';
                // Improve address formatting if it doesn't clearly state city/country
                const locationText = sellerAddr.includes('Nairobi') ? sellerAddr : `${sellerAddr}\nNairobi, Kenya`;

                msg = `⚠️ *ACTION REQUIRED: PICKUP READY*

📦 Order #${order.orderNumber} is ready for pickup!
💰 Amount: KSh ${amount.toLocaleString()}

📍 *PICKUP LOCATION:*
${locationText}

⏰ *PICKUP DEADLINE:* 
🚨 You have 24 hours to pick up or order will be auto-cancelled and refunded.

*IMPORTANT:* 
• Inspect items BEFORE accepting
• Payment released to seller 24 hours after pickup
• Report any issues immediately`;
            }
        } else if (newStatus === 'CONFIRMED' && isService) { // Custom status for Service
            const serviceType = this.getServiceProviderType(order);
            msg = `✅ *BOOKING ACCEPTED*

Great news! Your ${serviceType} has accepted your booking.

📦 Order #${order.orderNumber}
⏰ They will contact you shortly to confirm the appointment details.`;
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
            const amount = parseFloat(order.totalAmount || 0);
            if (productType === 'service') {
                msg = `💰 *PAYMENT RECEIVED*

✅ Order #${order.orderNumber} is paid (KSh ${amount.toLocaleString()}).

⏰ *PAYMENT HOLD:*
Funds will be held for 24 hours after job completion to ensure customer satisfaction.

📋 Please prepare for the service appointment.`;
            } else {
                msg = `💰 *PAYMENT RECEIVED*

✅ Order #${order.orderNumber} is paid (KSh ${amount.toLocaleString()}).

📦 *ACTION REQUIRED:*
Please drop off items at Dynamic Mall, Shop SL 32 within 48 hours.`;
            }
        } else if (newStatus === 'CONFIRMED' && productType === 'service') {
            msg = `✅ *BOOKING CONFIRMED*\n\nYou have confirmed the booking for Order #${order.orderNumber}.`;
        } else if (newStatus === 'COMPLETED') {
            const amount = parseFloat(order.totalAmount || 0);
            msg = `🎉 *ORDER COMPLETED*

✅ Order #${order.orderNumber} is finished.
💰 Revenue (KSh ${amount.toLocaleString()}) added to your balance.

You can withdraw your earnings from your seller dashboard.`;
        }

        logger.info(`[PURCHASE-FLOW] 9d. Sending Status Update (${newStatus}) to Seller ${seller.phone}`);
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
            logger.info(`Skipping logistics notification for ${productType} order #${order.order_number}`);
            return true; // Return success (skipped)
        }

        // Skip logistics notification for products with physical shop address (Seller handles logistics/pickup)
        if (seller?.physicalAddress) {
            logger.info(`Skipping logistics notification for order #${order.order_number} (Seller has physical shop)`);
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
    async notifySellerWithdrawalUpdate(phone, withdrawalData) {
        if (!phone) return false;

        const { amount, status, reference, reason, newBalance } = withdrawalData;

        let header = '';
        let message = '';
        const fmtAmount = parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (status === 'completed') {
            header = '✅ *WITHDRAWAL SUCCESSFUL*';
            message = `
${header}

💰 *Amount:* KSh ${fmtAmount}
🏦 *Ref:* ${reference}

Your funds have been successfully sent to your M-Pesa.
            `.trim();
        } else if (status === 'failed') {
            header = '❌ *WITHDRAWAL FAILED*';
            message = `
${header}

💰 *Amount:* KSh ${fmtAmount}
🏦 *Ref:* ${reference}
⚠️ *Reason:* ${reason || 'Transaction failed'}

The amount has been returned to your wallet.
💵 *New Balance:* KSh ${parseFloat(newBalance || 0).toLocaleString()}
            `.trim();
        } else if (status === 'processing') {
            header = '⏳ *WITHDRAWAL PROCESSING*';
            message = `
${header}

💰 *Amount:* KSh ${fmtAmount}
🏦 *Ref:* ${reference}

Your request has been received and is being processed. You will be notified once completed.
            `.trim();
        } else {
            return false;
        }

        return this.sendMessage(phone, message);
    }
}

export default new WhatsAppService();
