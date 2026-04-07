import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
// import pino from 'pino'; // Removed in favor of winston
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
        this.messageQueues = new Map();
        this.MAX_QUEUE_SIZE = 500;

        // Configuration (override via env)
        this.DROPOFF_LOCATION = (process.env.DROPOFF_LOCATION || 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32').replace(/^["']|["']$/g, '');
        this.COURIER_NUMBER = (process.env.COURIER_WHATSAPP_NUMBER || '0748137819').replace(/\s/g, '');
        this.SELLER_DEADLINE_HRS = 48;
        this.BUYER_PICKUP_HRS = 24;
    }

    async initialize() {
        logger.info('🔄 Initializing WhatsApp Client (Baileys)...');

        // Block 14 Fix: Clean up existing socket before re-initializing to prevent leaks
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners('connection.update');
                this.sock.ev.removeAllListeners('creds.update');
                this.sock.end(undefined);
            } catch (e) {
                logger.warn('Error closing existing socket during re-init:', e.message);
            }
        }

        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            logger.info(`ℹ️ Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            const mockLogger = {
                level: 'silent',
                info: () => { },
                debug: () => { },
                warn: () => { },
                error: () => { },
                trace: () => { },
                child: () => mockLogger
            };

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: mockLogger,
                browser: ['Byblos', 'Chrome', '121.0.6167.160'], // More modern browser ID
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000, // Keep connection alive
                syncFullHistory: false,
                markOnlineOnConnect: true,
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
                        logger.info('Reconnecting to WhatsApp...');
                        // Delay reconnection to prevent rapid spinning
                        setTimeout(() => {
                            this.initialize().catch(err => {
                                logger.error('WhatsApp reconnection failed:', err.message);
                            });
                        }, 5000);
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

        const jid = this.formatToJid(phone);
        if (!jid) throw new Error(`Invalid phone number format: ${phone}`);

        // Simple Mutex/Queue for same JID to prevent race conditions
        if (!this.messageQueues) this.messageQueues = new Map();

        // Fix M-12-Extra: Enforce MAX_QUEUE_SIZE to prevent leaks
        if (this.messageQueues.size > this.MAX_QUEUE_SIZE) {
            const oldestJid = this.messageQueues.keys().next().value;
            this.messageQueues.delete(oldestJid);
        }

        if (!this.messageQueues.has(jid)) {
            this.messageQueues.set(jid, Promise.resolve());
        }

        const previousTask = this.messageQueues.get(jid);
        const currentTask = previousTask.then(async () => {
            try {
                // Add tiny delay to ensure order and avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));

                await this.sock.sendMessage(jid, { text: message });
                logger.info(`✅ WhatsApp message sent successfully to ${phone}`);
                return true;
            } catch (error) {
                logger.error(`❌ Failed to send WhatsApp message to ${phone}:`, error.message);
                throw error;
            } finally {
                // M-12 FIX: Remove map entry when this task completes to prevent unbounded growth.
                // Only delete if we are still the head of the queue for this JID.
                if (this.messageQueues && this.messageQueues.get(jid) === currentTask) {
                    this.messageQueues.delete(jid);
                }
            }
        });

        this.messageQueues.set(jid, currentTask);
        return currentTask;
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

    /**
     * Helper to format social links for WhatsApp messages
     */
    formatSocialLinks(seller) {
        const links = [];
        if (seller.instagram_link) links.push(`📸 *Instagram:* ${seller.instagram_link}`);
        if (seller.tiktok_link) links.push(`🎵 *TikTok:* ${seller.tiktok_link}`);
        if (seller.facebook_link) links.push(`📘 *Facebook:* ${seller.facebook_link}`);

        if (links.length > 0) {
            return `\n\n🔗 *CONNECT WITH US:*\n${links.join('\n')}`;
        }
        return '';
    }

    /**
     * Safely parse order metadata
     */
    _getMetadata(order) {
        if (!order || !order.metadata) return {};
        if (typeof order.metadata === 'string') {
            try {
                return JSON.parse(order.metadata);
            } catch (e) {
                logger.error('[WHATSAPP-SERVICE] Error parsing metadata:', e.message);
                return {};
            }
        }
        return order.metadata;
    }

    /**
     * Standardized helper to generate Google Maps links
     */
    _getGoogleMapsLink(name, address, lat, lng) {
        try {
            // If no address and no coordinates, return null
            if (!address && (lat === null || lat === undefined || lng === null || lng === undefined)) return null;

            // If coordinates are provided, prioritize them
            if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
                const latitude = Number(lat);
                const longitude = Number(lng);

                if (!isNaN(latitude) && !isNaN(longitude)) {
                    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                }
            }

            // Fallback to address string encoding
            if (address) {
                const query = encodeURIComponent(`${name ? name + ', ' : ''}${address}`);
                return `https://www.google.com/maps/search/?api=1&query=${query}`;
            }

            return null;
        } catch (e) {
            logger.error('[WHATSAPP-SERVICE] Error generating maps link:', e.message);
            return null;
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
        const { seller, buyer, order, items } = orderData;
        const sellerWhatsApp = seller?.whatsapp_number || seller?.whatsappNumber || seller?.phone;

        if (!sellerWhatsApp) {
            logger.error('[WHATSAPP-SERVICE] ❌ Seller phone is missing!');
            return false;
        }

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = Number.parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()}`;
        }).join('\n');

        const total = Number.parseFloat(order.totalAmount || 0);
        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        let actionText = '';
        let bookingInfo = '';

        if (isService) {
            const locationType = order.metadata?.location_type;
            const isSellerVisitsBuyer = locationType === 'seller_visits_buyer';
            const sellerHasNoShop = !seller.latitude || !seller.longitude;
            const locationLabel = (isSellerVisitsBuyer || sellerHasNoShop) ? 'Client Location' : 'Service Location';
            const locationVal = order.metadata?.service_location || seller.physicalAddress || buyer.location || 'Not specified';

            let clientMapsLink = '';
            // If it's a home-visit service OR the seller has no shop coordinates, give the seller the buyer's map link
            if ((isSellerVisitsBuyer || sellerHasNoShop) && (buyer.latitude || order.metadata?.buyer_location)) {
                const bloc = order.metadata?.buyer_location || { latitude: buyer.latitude, longitude: buyer.longitude, fullAddress: buyer.location };
                clientMapsLink = this._getGoogleMapsLink(buyer.name, bloc.fullAddress || buyer.location, bloc.latitude, bloc.longitude);
            } else {
                // Otherwise use the service location/seller shop link
                clientMapsLink = this._getGoogleMapsLink(seller.shopName || 'Service Provider', locationVal, seller.latitude, seller.longitude);
            }

            bookingInfo = `
📅 *SERVICE BOOKING*
• Date: ${order.metadata?.booking_date || 'N/A'}
• Time: ${order.metadata?.booking_time || 'N/A'}
• ${locationLabel}: ${locationVal}${clientMapsLink ? `\n📍 *Navigate:* ${clientMapsLink}` : ''}
`.trim();

            actionText = `⏰ *ACTION REQUIRED:*
Please visit your dashboard to *Confirm* or *Cancel* this booking.
🔒 Payment of KSh ${total.toLocaleString()} is secured.`;
        } else if (isDigital) {
            actionText = `✅ *INFO:* Digital order. Customer has received the download link.
💰 Revenue added to your balance automatically.`;
        } else {
            // Physical Product
            const sellerHasShop = !!seller?.physicalAddress && !!seller?.latitude && !!seller?.longitude && Number(seller.latitude) !== 0;
            if (sellerHasShop) {
                actionText = `📍 *SHOP COLLECTION:*
The buyer will visit your shop to pick up the order.
✅ *ACTION:* Please prepare the items for collection.`;
            } else {
                actionText = `🚚 *LOGISTICS DROP-OFF:*
⚠️ *ACTION REQUIRED:*
Please drop items at ${this.DROPOFF_LOCATION} within ${this.SELLER_DEADLINE_HRS} hours.
⏰ *DEADLINE:* Order will auto-cancel if not delivered on time.`;
            }
        }

        const header = isDigital ? '🎉 *NEW DIGITAL ORDER!*' : '🎉 *NEW ORDER RECEIVED!*';
        const buyerInfo = isDigital ? '' : `👤 *BUYER:* ${buyer.name}\n📞 *PHONE:* ${buyer.phone || 'N/A'}\n`;

        const msg = `
${header}

${buyerInfo}📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

${bookingInfo ? bookingInfo + '\n\n' : ''}${actionText}
`.trim();

        return this.sendMessage(sellerWhatsApp, msg);
    }

    async notifyBuyerOrderConfirmation(orderData) {
        const { buyer, seller, order, items } = orderData;
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.whatsappNumber || buyer?.phone || order.buyer_whatsapp_number;
        if (!buyerWhatsApp) return false;

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = Number.parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()}`;
        }).join('\n');

        const total = Number.parseFloat(order.totalAmount || 0);
        const metadata = this._getMetadata(order);
        const productType = metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        const header = isDigital ? '🎉 *DIGITAL ORDER CONFIRMED!*' : '✅ *ORDER CONFIRMED!*';
        let body = '';

        if (isService) {
            const locationType = metadata?.location_type;
            const sellerHasNoShop = !seller?.latitude || !seller?.longitude;
            const isHomeVisit = locationType === 'seller_visits_buyer' || sellerHasNoShop;

            const locationLabel = isHomeVisit ? 'Your Address (Home Visit)' : 'Service Location';
            const locationVal = isHomeVisit ? (buyer.location || 'Your Registered Address') : (metadata?.service_location || seller?.physicalAddress || 'Not specified');

            // For buyer, if it's a shop service, give them the shop map. If it's a home visit, no map needed for themselves.
            const mapsLink = !isHomeVisit ? this._getGoogleMapsLink(seller?.shopName || 'Service Provider', locationVal, seller?.latitude, seller?.longitude) : null;

            body = `
📅 *SERVICE BOOKING*
• Date: ${metadata?.booking_date || 'N/A'}
• Time: ${metadata?.booking_time || 'N/A'}
• ${locationLabel}: ${locationVal}
${mapsLink ? `\n📍 *Navigate to Provider:* ${mapsLink}` : ''}

⏰ *WHAT'S NEXT:*
The provider has been notified. They will ${isHomeVisit ? 'come to your location' : 'see you at the scheduled time'}.
🔒 Your payment is secure and will be held until the service is complete.`.trim();

        } else if (isDigital) {
            const dashboardUrl = `${process.env.FRONTEND_URL || 'https://byblos.hq'}/dashboard/orders`;
            body = `
✅ *YOUR DOWNLOAD IS READY!*
🔗 *Access here:* ${dashboardUrl}

Check your email for additional instructions.`.trim();

        } else {
            // Physical Product
            const sellerHasShop = !!seller?.physicalAddress && !!seller?.latitude && !!seller?.longitude && Number(seller.latitude) !== 0;
            if (sellerHasShop) {
                const mapsLink = this._getGoogleMapsLink(seller.shopName, seller.physicalAddress, seller.latitude, seller.longitude);
                body = `
📍 *PICKUP AT SHOP:*
*${seller.shopName || 'The Shop'}*
${seller.physicalAddress}
${mapsLink ? `\n📍 *Navigate:* ${mapsLink}` : ''}

⏰ *WHAT'S NEXT:*
Please proceed to the shop for collection. Show your order number *#${order.orderNumber}* at the counter.`.trim();
            } else {
                body = `
🚚 *SYSTEM DELIVERY (COURIER):*
Your order will be handled by our system delivery partner.

⏰ *WHAT'S NEXT:*
1. Seller drops items at *${this.DROPOFF_LOCATION}*
2. We verify and notify you when it's ready for your collection.
3. You will pick it up at the same central location (*${this.DROPOFF_LOCATION.split('|')[0].trim()}*).

📍 *Delivery Address:* ${buyer.location || 'Your Address'}`.trim();
            }
        }

        const msg = `
${header}

Thanks for ordering, ${buyer.name?.split(' ')[0] || 'valued customer'}!

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

${body}

${this.formatSocialLinks(seller)}
`.trim();

        logger.info(`[PURCHASE-FLOW] 9b. Sending Order Confirmation to Buyer ${buyerWhatsApp}`);
        return this.sendMessage(buyerWhatsApp, msg);
    }

    async notifyBuyerStatusUpdate(updateData) {
        const { buyer, order, newStatus, notes } = updateData;
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.whatsappNumber || buyer?.phone || order.buyer_whatsapp_number;
        if (!buyerWhatsApp) return false;

        const productType = order.metadata?.product_type;
        const isService = productType === 'service';
        const isDigital = productType === 'digital';

        let msg = '';
        if (newStatus === 'COLLECTION_PENDING') {
            const amount = Number.parseFloat(order.totalAmount || 0);
            const sellerAddr = updateData.seller?.physicalAddress || 'the shop';
            const shopName = updateData.seller?.shopName || 'The Shop';
            const mapsLink = this._getGoogleMapsLink(shopName, sellerAddr, updateData.seller?.latitude, updateData.seller?.longitude);

            msg = `✅ *READY FOR COLLECTION*

💰 Amount: KSh ${amount.toLocaleString()}
📦 Order #${order.orderNumber} is confirmed.

📍 *PICKUP LOCATION:*
*${shopName}*
${sellerAddr}
${mapsLink ? `\n📍 *Navigate:* ${mapsLink}` : ''}

⏰ *INSTRUCTIONS:*
Please proceed to the shop to collect your items. 

*IMPORTANT:* Once you've collected the items, please visit your dashboard and click *'Mark as Collected'* to finalize the order.`;

        } else if (newStatus === 'COMPLETED') {
            msg = `🎉 *ORDER COMPLETED*

Order #${order.orderNumber} has been marked as collected/completed.
Thank you for shopping with Byblos!`;

        } else if (newStatus === 'DELIVERY_PENDING') {
            if (isService) {
                const serviceType = this.getServiceProviderType(order);
                const amount = Number.parseFloat(order.totalAmount || 0);
                const sellerAddr = updateData.seller?.physicalAddress || 'Contact provider for details';
                const shopName = updateData.seller?.shopName || 'Service Provider';
                const mapsLink = this._getGoogleMapsLink(shopName, sellerAddr, updateData.seller?.latitude, updateData.seller?.longitude);

                msg = `✅ *BOOKING CONFIRMED*

🎉 Payment received! Your ${serviceType} booking is confirmed.

📍 *PROVIDER ADDRESS:*
*${shopName}*
${sellerAddr}
${mapsLink ? `\n📍 *Navigate:* ${mapsLink}` : ''}

💰 Amount Held: KSh ${amount.toLocaleString()}
🔒 Your payment is secure and will be released to the service provider 24 hours after job completion.

Order #${order.orderNumber}`;
            } else if (isDigital) {
                msg = `✅ *PAYMENT SUCCESSFUL*\n\nOrder #${order.orderNumber} payment received. Your download is ready.`;
            } else {
                const amount = Number.parseFloat(order.totalAmount || 0);
                msg = `✅ *PAYMENT SUCCESSFUL*

💰 Amount: KSh ${amount.toLocaleString()}
📦 Order #${order.orderNumber} is confirmed.

⏰ *NEXT STEPS:*
We are preparing your order for pickup. You'll be notified when it's ready at ${this.DROPOFF_LOCATION}.`;
            }
        } else if (newStatus === 'DELIVERY_COMPLETE') {
            if (isService) {
                const serviceType = this.getServiceProviderType(order);
                const amount = Number.parseFloat(order.totalAmount || 0);
                msg = `⚠️ *ACTION REQUIRED*

Your ${serviceType} has marked the job as DONE.

💰 Amount: KSh ${amount.toLocaleString()}
⏰ Payment Release: We will release your payment to them in 24 hours.

✅ If the work is satisfactory, no action needed.
❌ If there are issues, please contact support immediately.`;
            } else if (isDigital) {
                msg = `✅ *DIGITAL ORDER COMPLETE*\n\nOrder #${order.orderNumber} is complete.`;
            } else {
                const amount = Number.parseFloat(order.totalAmount || 0);
                const sellerAddr = updateData.seller?.physicalAddress || this.DROPOFF_LOCATION;
                const shopName = updateData.seller?.shopName || 'Pickup Point';
                const mapsLink = this._getGoogleMapsLink(shopName, sellerAddr, updateData.seller?.latitude, updateData.seller?.longitude);

                msg = `⚠️ *ACTION REQUIRED: PICKUP READY*

📦 Order #${order.orderNumber} is ready for pickup!
💰 Amount: KSh ${amount.toLocaleString()}

📍 *PICKUP LOCATION:*
*${shopName}*
${sellerAddr}
${mapsLink ? `\n📍 *Navigate:* ${mapsLink}` : ''}

⏰ *PICKUP DEADLINE:* 
🚨 You have ${this.BUYER_PICKUP_HRS} hours to pick up or order will be auto-cancelled and refunded.

*IMPORTANT:* 
• Inspect items BEFORE accepting
• Payment released to seller 24 hours after pickup
• Report any issues immediately`;
            }
        } else if (newStatus === 'CONFIRMED' && isService) {
            const serviceType = this.getServiceProviderType(order);
            const sellerAddr = updateData.seller?.physicalAddress || 'Contact provider for details';
            const shopName = updateData.seller?.shopName || 'Service Provider';
            const mapsLink = this._getGoogleMapsLink(shopName, sellerAddr, updateData.seller?.latitude, updateData.seller?.longitude);

            msg = `✅ *BOOKING ACCEPTED*

Great news! Your ${serviceType} has accepted your booking.

📍 *PROVIDER ADDRESS:*
*${shopName}*
${sellerAddr}
${mapsLink ? `\n📍 *Navigate:* ${mapsLink}` : ''}

📦 Order #${order.orderNumber}

⏰ *WHAT'S NEXT:* Once the service is completed to your satisfaction, please visit your dashboard and click *'Mark as Done'* to release the funds to the provider.`;
        } else if (newStatus === 'CLIENT_PAYMENT_PENDING') {
            const amount = Number.parseFloat(order.totalAmount || 0);
            msg = `💳 *PAYMENT REQUEST SENT*

📦 Order #${order.orderNumber}
💰 Amount: KSh ${amount.toLocaleString()}

📱 *ACTION REQUIRED:*
Please enter your M-Pesa PIN to complete payment.

⏰ This payment request will expire in a few minutes.

Thank you for shopping with us!`;
        } else if (newStatus === 'PROCESSING') {
            msg = `⏳ *ORDER BEING PROCESSED*

Order #${order.orderNumber} is now being prepared by the seller. 
We will notify you as soon as it's ready for the next step!`;
        } else {
            msg = `📋 *STATUS UPDATE*

Order #${order.orderNumber} status changed to: *${newStatus}*`;
        }

        if (notes) msg += `\n\n📝 *NOTE:* ${notes}`;
        msg += this.formatSocialLinks(updateData.seller || {});

        return this.sendMessage(buyerWhatsApp, msg.trim());
    }

    async notifySellerStatusUpdate(updateData) {
        const { seller, order, newStatus } = updateData;
        const sellerWhatsApp = seller?.whatsapp_number || seller?.whatsappNumber || seller?.phone;
        if (!sellerWhatsApp) return false;

        const metadata = this._getMetadata(order);
        const productType = metadata?.product_type;
        const isService = productType === 'service';
        const total = Number.parseFloat(order.totalAmount || 0);

        let msg = `📋 Order #${order.orderNumber} status: ${newStatus}`;

        if (newStatus === 'DELIVERY_PENDING') {
            if (isService) {
                msg = `💰 *PAYMENT RECEIVED*

✅ Order #${order.orderNumber} is paid (KSh ${total.toLocaleString()}).

⏰ *PAYMENT HOLD:*
Funds will be held for 24 hours after job completion to ensure customer satisfaction.

📋 Please prepare for the service appointment.`;
            } else {
                msg = `💰 *PAYMENT RECEIVED*

✅ Order #${order.orderNumber} is paid (KSh ${total.toLocaleString()}).

📦 *ACTION REQUIRED:*
Please drop off items at ${this.DROPOFF_LOCATION} within ${this.SELLER_DEADLINE_HRS} hours.`;
            }
        } else if (newStatus === 'COLLECTION_PENDING') {
            msg = `💰 *PAYMENT RECEIVED*

✅ Order #${order.orderNumber} is confirmed.
💰 Amount: KSh ${total.toLocaleString()}

📍 *SHOP COLLECTION:*
The buyer will visit your shop to pick up the items.
✅ *ACTION:* Please ensure the items are ready for collection.`;

        } else if (newStatus === 'SERVICE_PENDING') {
            msg = `💰 *PAYMENT RECEIVED*

✅ Order #${order.orderNumber} is paid (KSh ${total.toLocaleString()}).

⏰ *SERVICE BOOKING:*
Buyer has paid and is waiting for service. 
Please contact the buyer if necessary and prepare for the appointment.`;

        } else if (newStatus === 'CONFIRMED' && isService) {
            msg = `✅ *BOOKING ACCEPTED*

You have accepted the booking for Order #${order.orderNumber}.
The buyer has been notified.`;

        } else if (newStatus === 'COMPLETED') {
            msg = `🎉 *ORDER COMPLETED*

Order #${order.orderNumber} has been successfully completed.
💰 Revenue of KSh ${total.toLocaleString()} will be added to your balance.

You can withdraw your earnings from your dashboard. Thank you for using Byblos!`;

        } else if (newStatus === 'PROCESSING') {
            msg = `⏳ *PROCESSING ORDER*

Order #${order.orderNumber} is now being processed. 
Please update the status once the items are ready for collection or delivery.`;

        } else if (newStatus === 'CANCELLED') {
            msg = `❌ *ORDER CANCELLED*

Order #${order.orderNumber} has been cancelled.
📝 Note: ${updateData.notes || 'No reason provided'}`;
        } else {
            msg = `📋 *STATUS UPDATE*

Order #${order.orderNumber} status: *${newStatus}*`;
        }

        return this.sendMessage(sellerWhatsApp, msg.trim());
    }

    async notifyClientOrderCreated(clientPhone, orderData) {
        const { order, items, seller } = orderData;
        if (!clientPhone) return false;

        const itemsList = items.map((item, i) => {
            const name = item.name || item.product_name || 'Item';
            const price = Number.parseFloat(item.price || item.product_price || 0);
            return `${i + 1}. ${name} x${item.quantity} - KSh ${price.toLocaleString()}`;
        }).join('\n');

        const total = Number.parseFloat(order.totalAmount || 0);
        const shopName = seller?.shop_name || seller?.businessName || 'Byblos Seller';

        const msg = `
💳 *PAYMENT REQUEST*

Hello! ${shopName} has created an order for you.

📦 *Order #${order.orderNumber}*
💰 Total: KSh ${total.toLocaleString()}

📋 *Items:*
${itemsList}

📱 *ACTION REQUIRED:*
Please enter your M-Pesa PIN to complete payment on the prompt sent to this number.

⏰ Payment request expires in a few minutes.

Thank you!
        `.trim();

        logger.info(`[CLIENT-ORDER] Sending payment request to client ${clientPhone}`);
        return this.sendMessage(clientPhone, msg);
    }

    async sendRefundApprovedNotification(buyer, refundAmount) {
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.whatsappNumber || buyer?.phone;
        if (!buyerWhatsApp) return false;

        const message = `
🎉 *REFUND APPROVED*

Your refund request has been approved!

💰 *Refund Amount:* KSh ${Number.parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

✅ The refund will be processed to your registered M-Pesa number within 1-3 business days.

Thank you for your patience!

---
*Byblos Marketplace*
        `.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    async sendRefundRejectedNotification(buyer, refundAmount, reason) {
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.whatsappNumber || buyer?.phone;
        if (!buyerWhatsApp) return false;

        const message = `
❌ *REFUND REQUEST DECLINED*

Your refund request has been declined.

💰 *Requested Amount:* KSh ${Number.parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📝 *Reason:* ${reason || 'Please contact support for more information.'}

Your refund balance remains available for future withdrawal requests.

---
*Byblos Marketplace*
        `.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    async sendLogisticsNotification(order, buyer, seller, items = []) {
        // Skip for service, digital, and shop-pickup orders
        const productType = order.metadata?.product_type
        const isService = productType === 'service'
        const isDigital = productType === 'digital'

        if (isService || isDigital) {
            logger.info(`[LOGISTICS] Skipping courier notification — ${productType} order #${order.orderNumber || order.id}`)
            return false
        }

        // Skip if seller has their own shop (buyer collects directly)
        const hasCoordinates = seller?.latitude && seller?.longitude && Number(seller.latitude) !== 0;
        if (seller?.physicalAddress && hasCoordinates) {
            logger.info(`[LOGISTICS] Skipping courier notification — seller has physical shop with coordinates, order #${order.orderNumber || order.id}`)
            return false
        }

        const COURIER_NUMBER = this.COURIER_NUMBER
        const DROPOFF_LOCATION = this.DROPOFF_LOCATION

        // Build items list
        let itemsList = 'No items listed';
        const rawItems = order.items || order.metadata?.items || items || [];

        if (rawItems && rawItems.length > 0) {
            itemsList = rawItems.map((item, i) => {
                const name = item.product_name || item.name || 'Product';
                const price = Number.parseFloat(item.product_price || item.product_price_actual || item.price || 0);
                const qty = Number.parseInt(item.quantity || 1, 10);
                return `${i + 1}. ${name} × ${qty} — KSh ${price.toLocaleString()}`;
            }).join('\n');
        }

        const total = Number.parseFloat(order.totalAmount || order.total_amount || 0)
        const orderNum = order.orderNumber || order.order_number || order.id
        const buyerName = buyer.fullName || buyer.full_name || 'N/A'
        const buyerPhone = buyer.whatsapp_number || buyer.phone || 'N/A'
        const buyerCity = buyer.city || buyer.location || 'N/A'
        const shopName = seller.shop_name || seller.full_name || 'N/A'
        const sellerPhone = seller.whatsapp_number || 'N/A'

        const message = `
🚚 *NEW DELIVERY ORDER*

📦 *Order #${orderNum}*
💰 *Amount:* KSh ${total.toLocaleString()}

━━━━━━━━━━━━━━━━━━━━
👤 *BUYER DETAILS*
• Name:     ${buyerName}
• Phone:    ${buyerPhone}
• Location: ${buyerCity}

━━━━━━━━━━━━━━━━━━━━
🏪 *SELLER DETAILS*
• Shop:     ${shopName}
• Phone:    ${sellerPhone}

━━━━━━━━━━━━━━━━━━━━
📋 *ORDER ITEMS*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
📍 *PICKUP / DROP-OFF POINT*
${DROPOFF_LOCATION}

⏰ Seller has ${this.SELLER_DEADLINE_HRS} hours to drop off.
Please coordinate pickup and delivery to buyer within this window.
    `.trim()

        logger.info(`[LOGISTICS] Sending courier notification for order #${orderNum} to ${COURIER_NUMBER}`)
        return this.sendMessage(COURIER_NUMBER, message)
    }

    async sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy) {
        const COURIER_NUMBER = this.COURIER_NUMBER

        // Skip if this was a shop-pickup order (no logistics involved)
        if (seller?.physicalAddress) return false

        const orderNum = order.orderNumber || order.order_number || order.id
        const buyerName = buyer?.fullName || buyer?.full_name || 'N/A'
        const buyerPhone = buyer?.whatsapp_number || buyer?.phone || 'N/A'
        const shopName = seller?.shop_name || seller?.full_name || 'N/A'
        const sellerPhone = seller?.whatsapp_number || 'N/A'
        const total = Number.parseFloat(order.total_amount || order.totalAmount || 0)

        const message = `
❌ *ORDER CANCELLED — DELIVERY CANCELLED*

📦 *Order #${orderNum}*
💰 *Amount:* KSh ${total.toLocaleString()}
🚫 *Cancelled by:* ${cancelledBy || 'System'}

━━━━━━━━━━━━━━━━━━━━
👤 *BUYER*
• Name:  ${buyerName}
• Phone: ${buyerPhone}

🏪 *SELLER*
• Shop:  ${shopName}
• Phone: ${sellerPhone}

━━━━━━━━━━━━━━━━━━━━
⚠️ *ACTION REQUIRED:*
Do NOT collect this order from the seller.
If already collected, contact the seller to arrange return.
    `.trim()

        logger.info(`[LOGISTICS] Sending cancellation to courier for order #${orderNum}`)
        return this.sendMessage(COURIER_NUMBER, message)
    }

    async sendBuyerOrderCancellationNotification(order, cancelledBy) {
        const buyerWhatsApp = order.buyer_whatsapp_number || order.whatsapp_number || order.phone;
        if (!buyerWhatsApp) return false;

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

        return this.sendMessage(buyerWhatsApp, message);
    }

    async sendSellerOrderCancellationNotification(order, seller, cancelledBy) {
        const sellerWhatsApp = seller?.whatsapp_number || seller?.whatsappNumber || seller?.phone;
        if (!sellerWhatsApp) return false;

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

        return this.sendMessage(sellerWhatsApp, message);
    }

    async notifySellerWithdrawalUpdate(phone, withdrawalData) {
        if (!phone) return false;

        const { amount, status, reference, reason, newBalance, mpesaNumber, request_id } = withdrawalData;

        let header = '';
        let message = '';
        const fmtAmount = Number.parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const idSuffix = request_id ? ` #${request_id}` : '';

        if (status === 'completed') {
            header = '✅ *WITHDRAWAL SUCCESSFUL*';
            message = `
${header}

💰 *Amount:* KSh ${fmtAmount}
🏦 *M-Pesa:* ${mpesaNumber || 'Registered Number'}
🏦 *Ref:* ${reference || 'N/A'}${idSuffix}

Your funds have been successfully sent to your M-Pesa.
            `.trim();
        } else if (status === 'failed') {
            header = '❌ *WITHDRAWAL FAILED*';
            message = `
${header}

💰 *Amount:* KSh ${fmtAmount}
🏦 *Ref:* ${reference || 'N/A'}${idSuffix}
⚠️ *Reason:* ${reason || 'Transaction failed'}

The amount has been returned to your wallet.
💵 *New Balance:* KSh ${Number.parseFloat(newBalance || 0).toLocaleString()}
            `.trim();
        } else if (status === 'processing') {
            header = '⏳ *WITHDRAWAL PROCESSING*';
            message = `
${header}

💰 *Amount:* KSh ${fmtAmount}
🏦 *M-Pesa:* ${mpesaNumber || 'Registered Number'}${idSuffix}

Your request has been received and is being processed. You will be notified once completed.
            `.trim();
        } else {
            return false;
        }

        return this.sendMessage(phone, message);
    }
}

export default new WhatsAppService();
