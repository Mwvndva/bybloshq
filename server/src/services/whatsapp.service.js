import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
// import pino from 'pino'; // Removed in favor of winston
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import logger from '../shared/utils/logger.js';
import { sellerHasPhysicalShop } from '../shared/utils/sellerUtils.js';

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.isReady = false;
        this.qrCode = null;
        this.authFolder = path.join(process.cwd(), 'baileys_auth_info');
        this.messageQueues = new Map();
        this.MAX_QUEUE_SIZE = 500;
        this.recentMessageKeys = new Map();
        this.MESSAGE_DEDUPE_TTL_MS = 5 * 60 * 1000;

        // Configuration (override via env)
        this.DROPOFF_LOCATION = (process.env.DROPOFF_LOCATION || 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32').replace(/^["']|["']$/g, '');
        this.COURIER_NUMBER = (process.env.COURIER_WHATSAPP_NUMBER || '0748137819').replace(/\s/g, '');
        this.SELLER_DEADLINE_HRS = 48;
        this.BUYER_PICKUP_HRS = 24;
    }

    async initialize() {
        logger.info('🔄 Initializing WhatsApp Client (Baileys)...');

        // Prevent concurrent initialization
        if (this._initializing) {
            logger.warn('[WHATSAPP] Initialization already in progress, skipping');
            return;
        }
        this._initializing = true;

        // Clean up existing socket before re-initializing to prevent leaks
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners(); // Remove ALL listeners before ending
                this.sock.end(undefined);
            } catch (e) {
                logger.warn('Error closing existing socket during re-init:', e.message);
            }
            this.sock = null;
            this.isReady = false;
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
                browser: ['Ubuntu', 'Chrome', '20.0.04'], // More standardized browser ID to avoid filtering
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000, // Keep connection alive
                syncFullHistory: false,
                markOnlineOnConnect: true,
                retryRequestDelayMs: 2000, // Add retry delay
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
                    this.isReady = false;
                    this._initializing = false; // Reset flag on close

                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    logger.warn(`🔌 Connection closed (code: ${statusCode}), reconnecting: ${shouldReconnect}`);

                    if (shouldReconnect) {
                        // Drain the message queue before reconnecting
                        if (this.messageQueues) this.messageQueues.clear();

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
                    this._initializing = false;
                }
            });

        } catch (error) {
            logger.error('❌ Failed to initialize Baileys:', error);
            this._initializing = false;
        }
    }

    /**
     * Send a message to a phone number
     */
    async sendMessage(phone, message) {
        if (!this.isReady || !this.sock) {
            logger.error(`[WHATSAPP] Cannot send message to ${phone}: Client not ready`);
            throw new Error('WhatsApp client not ready or not connected');
        }

        // PRE-FLIGHT CHECK: Avoid enqueuing messages for non-existent numbers
        if (!phone || phone === 'N/A' || phone === 'null' || phone === 'undefined') {
            logger.warn(`[WHATSAPP] Skipping message send: Invalid phone number "${phone}"`);
            return false;
        }

        const jid = this.formatToJid(phone);
        if (!jid) throw new Error(`Invalid phone number format: ${phone}`);

        this.pruneRecentMessageKeys();
        const messageKey = this.buildMessageKey(jid, message);
        if (this.recentMessageKeys.has(messageKey)) {
            logger.warn('[WHATSAPP] Duplicate notification suppressed', { jid });
            return false;
        }
        this.recentMessageKeys.set(messageKey, Date.now() + this.MESSAGE_DEDUPE_TTL_MS);

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
                await new Promise(resolve => setTimeout(resolve, 300));

                // REMOVED: this.sock.onWhatsApp(jid) check
                // This call hangs intermittently on degraded connections and stalls the entire per-JID queue.
                // Baileys handles non-existent numbers gracefully — the message just won't be delivered.

                const sentMsg = await Promise.race([
                    this.sock.sendMessage(jid, { text: message }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('sendMessage timeout after 30s')), 30000)
                    )
                ]);

                if (sentMsg?.key?.id) {
                    logger.info(`✅ WhatsApp message sent to ${jid} (Original: ${phone})`, {
                        messageId: sentMsg.key.id,
                        status: sentMsg.status
                    });
                }
                return true;
            } catch (error) {
                logger.error(`❌ Failed to send WhatsApp message to ${phone} (JID: ${jid}):`, error.message);
                this.recentMessageKeys.delete(messageKey);
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

    buildMessageKey(jid, message) {
        return crypto
            .createHash('sha256')
            .update(`${jid}:${String(message || '').trim()}`)
            .digest('hex');
    }

    pruneRecentMessageKeys() {
        if (!this.recentMessageKeys) this.recentMessageKeys = new Map();
        const now = Date.now();
        for (const [key, expiresAt] of this.recentMessageKeys.entries()) {
            if (expiresAt <= now) this.recentMessageKeys.delete(key);
        }
    }

    /**
     * Helper to format numbers to 254... format -> jid
     */
    formatToJid(phone) {
        if (!phone) return null;
        let p = phone.toString().replace(/\D/g, ''); // Strip non-digits

        // 1. Remove common redundant prefixes (2540... -> 0...)
        if (p.startsWith('2540')) {
            p = p.substring(3);
        }

        // 2. Handle 07... or 01... -> 7... or 1...
        if (p.startsWith('0')) {
            p = p.substring(1);
        }

        // 3. Handle numbers that already start with 254 (e.g. 2547...)
        if (p.startsWith('254') && p.length > 10) {
            p = p.substring(3);
        }

        // 4. Final normalization: Must be 254 + (9 core digits)
        if (p.length === 9) {
            p = '254' + p;
        } else if (p.length === 12 && p.startsWith('254')) {
            // Already correct
        } else {
            // Fallback: if it's longer/shorter, just try to keep it as is if it looks like a JID
            // but log a warning
            logger.debug(`[WHATSAPP] Non-standard phone length: ${p} for input: ${phone}`);
        }

        const jid = p + '@s.whatsapp.net';
        logger.debug(`[WHATSAPP] Formatted JID: ${jid} from: ${phone}`);
        return jid;
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
     * Helper to get a friendly name for the service provider
     * @param {Object} order - Normalized or DB order object
     * @returns {string} - "Professional", "Seller", etc.
     */
    getServiceProviderType(order) {
        if (!order) return 'Seller';
        const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : (order.metadata || {});
        const type = order.product_type || metadata.product_type || 'physical';
        return type.toLowerCase() === 'service' ? 'Professional' : 'Seller';
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
     * Standardized helper to generate Google Maps links
     */
    _getGoogleMapsLink(name, address, lat, lng) {
        try {
            // Robust coordinate extraction: handle parameters or object as first arg
            let latitude = lat;
            let longitude = lng;

            if (typeof name === 'object' && name !== null) {
                // If the first argument is an object (common in current usage)
                const loc = name;
                latitude = loc.latitude !== undefined ? loc.latitude : loc.lat;
                longitude = loc.longitude !== undefined ? loc.longitude : loc.lng;
            }

            // Strict check: Only return a link if both coordinates are provided and valid
            if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
                const finalLat = Number(latitude);
                const finalLng = Number(longitude);

                if (!isNaN(finalLat) && !isNaN(finalLng) && (finalLat !== 0 || finalLng !== 0)) {
                    // Use a more descriptive search query if name is available, otherwise just coords
                    const query = (typeof name === 'string' && name)
                        ? encodeURIComponent(`${name}, ${address || ''}`)
                        : `${finalLat},${finalLng}`;
                    return `https://www.google.com/maps/search/?api=1&query=${query}`;
                }
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
     * Strict validation of the normalized order payload
     * Fails fast to prevent sending incomplete notifications
     */
    _validateOrderPayload(order) {
        if (!order) throw new Error("Missing order payload");

        const requiredBuyer = ['name', 'phone'];
        const requiredService = ['title', 'price', 'quantity'];
        const requiredLocation = ['address'];

        requiredBuyer.forEach(f => {
            if (!order.buyer?.[f]) throw new Error(`Missing buyer.${f}`);
        });

        requiredService.forEach(f => {
            if (order.service?.[f] === undefined) throw new Error(`Missing service.${f}`);
        });

        if (!order.location?.address) throw new Error("Missing location.address");

        return true;
    }

    /**
     * Context-aware instruction generator for the order lifecycle.
     * Synchronizes expectations between Buyer, Seller, and Logistics.
     */
    getLifecycleInstruction(status, party, type, hasShop) {
        const isBuyer = party === 'buyer';
        const isSeller = party === 'seller';
        const isPhysical = (type || '').toUpperCase() === 'PHYSICAL';
        const isService = (type || '').toUpperCase() === 'SERVICE';
        const isDigital = (type || '').toUpperCase() === 'DIGITAL';

        const isSystemDelivery = isPhysical && !hasShop;
        const isShopPickup = isPhysical && hasShop;
        const isMobileService = isService && !hasShop;
        const isShopService = isService && hasShop;

        if (status === 'AWAITING_SELLER_ACTION') {
            if (isBuyer) {
                if (isService) return '*Next Step:* Waiting for the seller to confirm your booking.';
                if (isSystemDelivery) return `*Next Step:* The seller must choose hub drop-off or paid Mzigo pickup. You will be notified when the package reaches ${this.DROPOFF_LOCATION}.`;
                if (isShopPickup) return '*Next Step:* The seller is preparing your order for shop pickup.';
            }
            if (isService) return '*Next Step:* Confirm the booking in your dashboard, then complete the service as scheduled.';
            if (isSystemDelivery) return `*Next Step:* Choose "I will drop off at hub" or "Request Mzigo pickup". Hub drop-off is due within 24 hours at ${this.DROPOFF_LOCATION}.`;
            if (isShopPickup) return '*Next Step:* Prepare the order and mark it ready for shop pickup.';
        }

        if (status === 'FULFILLING') {
            if (isBuyer) {
                if (isDigital) return '*Notice:* Your digital item is being prepared for access.';
                if (isService) return '*Notice:* Your booking is confirmed. After the service is complete, mark it completed in your buyer dashboard to release funds.';
                if (isSystemDelivery) return '*Notice:* Package movement is in progress. Your dashboard has the latest logistics updates.';
                return '*Notice:* The seller is preparing your pickup.';
            }
            if (isService) return '*Next Step:* Deliver the service as scheduled. The buyer will mark it completed to release funds.';
            if (isSystemDelivery) return '*Next Step:* Complete your selected handoff. If dropping off, mark the package dropped at hub after delivery.';
            return '*Next Step:* Prepare the order for buyer pickup.';
        }

        if (status === 'READY_FOR_BUYER') {
            if (isBuyer) {
                if (isSystemDelivery) return `*Next Step:* Your order is ready for collection at ${this.DROPOFF_LOCATION}.`;
                if (isShopService) return '*Next Step:* If the service has been completed, mark it completed in your buyer dashboard to release funds.';
                if (isShopPickup) return '*Next Step:* Your order is ready at the shop. Please collect it and confirm receipt.';
            }
            if (isService) return '*Status:* Buyer has been notified. The buyer must mark the service completed to release funds.';
            return '*Status:* Buyer has been notified. Hand over the package and ask them to confirm receipt.';
        }

        // 1. INITIAL STATES (PENDING/PAID/CONFIRMED/RESERVED)
        if (['CONFIRMED', 'PAID', 'PENDING', 'RESERVED'].includes(status)) {
            if (isBuyer) {
                if (isDigital) return "👉 *Next Step:* Click the download link below to access your product.";
                if (isSystemDelivery) return "⏳ *Next Step:* The seller has been notified to drop off your item at our hub. We'll alert you when it arrives!";
                if (isShopPickup) return "⏳ *Next Step:* The seller is preparing your items. You'll receive a notification the moment they are ready for collection at the shop.";
                if (isMobileService) return "Appointment confirmed. After the service is complete, mark it completed in your buyer dashboard to release funds.";
                if (isShopService) return "Appointment confirmed. Please visit the shop at the scheduled time. After the service is complete, mark it completed in your buyer dashboard to release funds.";
            } else {
                if (isSystemDelivery) return `📦 *Next Step:* Please drop off the items at ${this.DROPOFF_LOCATION} within 24 hours to initiate delivery.`;
                if (isShopPickup) return "👉 *Next Step:* Prepare the items. Once ready, update status to 'Ready for Collection' in your dashboard.";
                if (isMobileService) return "Next Step: Proceed to the buyer's location at the scheduled time to provide the service. The buyer confirms completion.";
                if (isShopService) return "Next Step: Prepare for the buyer's arrival at your shop at the scheduled time. The buyer confirms completion.";
            }
        }

        // 2. PROCESSING
        if (status === 'PROCESSING') {
            if (isBuyer) {
                return isService ? "Next Step: The seller is preparing for your service appointment. After the service is complete, mark it completed in your buyer dashboard." : "⏳ *Next Step:* The seller is currently packing your items. Dispatch notification coming soon!";
            }
            return "👉 *Next Step:* Finalize preparation and update status to 'Ready for Collection' or 'Delivery Pending'.";
        }

        // 3. DELIVERY / DISPATCH
        if (status === 'DELIVERY_PENDING') {
            if (isBuyer) {
                if (isSystemDelivery) return "🚚 *Next Step:* Your order is en route to our hub. Please wait for the 'Arrived at Hub' notification before visiting.";
                return "🚚 *Next Step:* Your order is on its way! Please be ready to receive it.";
            }
            return isSystemDelivery ? "✅ *Next Step:* Item successfully received for hub delivery. Logistics tracking is active." : "🚚 *Next Step:* Proceed with the delivery to the buyer's address.";
        }

        // 4. COLLECTION (READY)
        if (status === 'COLLECTION_PENDING' || status === 'READY_FOR_COLLECTION' || status === 'READY_FOR_BUYER') {
            if (isBuyer) {
                if (isShopService) return "Next Step: If the service has been completed, mark it completed in your buyer dashboard to release funds.";
                if (isShopPickup) return "📍 *Next Step:* YOUR ORDER IS READY! Please visit the shop now to collect your order.";
                if (isSystemDelivery) return `📍 *Next Step:* ARRIVED AT HUB! Your order is ready for pickup at ${this.DROPOFF_LOCATION}.`;
            }
            return isService
                ? "Status: Buyer has been notified. The buyer must mark the service completed to release funds."
                : "Next Step: Buyer has been notified. Hand over the items and ask them to confirm receipt.";
        }

        // 5. SERVICE EN ROUTE / PENDING CONFIRMATION
        if (status === 'SERVICE_PENDING') {
            if (isBuyer) {
                return "⏳ *Next Step:* Waiting for the professional to finalize the service booking details.";
            }
            return "👉 *Next Step:* NEW SERVICE BOOKING! Please confirm and finalize the appointment in your dashboard.";
        }

        // 6. COMPLETED / DELIVERED
        if (status === 'COMPLETED' || status === 'DELIVERY_COMPLETE') {
            if (isBuyer) {
                if (isSystemDelivery && status === 'DELIVERY_COMPLETE') {
                    return `📍 *Notice:* Your order has arrived at our hub (${this.DROPOFF_LOCATION}). Please collect it at your earliest convenience.`;
                }
                return "🎉 *Notice:* Order successfully completed. Thank you for choosing Byblos!";
            }
            return "✅ *Status:* Transaction finalized. Funds have been credited to your wallet.";
        }

        return "";
    }

    /**
     * Central message builder using the Normalized Order Payload (Single Source of Truth)
     */
    buildWhatsAppMessage(order, recipientRole) {
        this._validateOrderPayload(order);
        const isSeller = recipientRole === 'seller';

        const { orderNumber, totalAmount, buyer, seller, service, items, booking, location: loc, payment, type, fulfillmentType, downloadUrl, downloadUrls, status } = order;

        // Context Flags
        const isDigital = (type || '').toUpperCase() === 'DIGITAL';
        const isService = (type || '').toUpperCase() === 'SERVICE';
        const isPhysical = (type || '').toUpperCase() === 'PHYSICAL';

        // SOT: Use fulfillmentType if available, fallback to seller coordinate check
        const hasPhysicalShop = fulfillmentType === 'BUYER_TO_SELLER' || sellerHasPhysicalShop(seller);

        const partyName = isSeller ? (seller.name || 'Seller') : (buyer.name || 'Customer');
        const headerText = isSeller ? `🔔 *New Order: #${orderNumber}*` : `✅ *Order Confirmed: #${orderNumber}*`;
        const bodyText = isSeller
            ? `Hello ${partyName}, a new order has been placed with your shop.`
            : `Hello ${partyName}, your order has been successfully processed.`;

        const typeLabel = isDigital ? 'Digital Product' : (isService ? 'Service Booking' : 'Physical Product');

        let message = `
${headerText}
${bodyText}

🏷️ *Type:* ${typeLabel}
💰 *Total:* KSh ${totalAmount.toLocaleString()}
${booking?.date ? `📅 *Date:* ${booking.date}\n` : ''}${booking?.time ? `🕒 *Time:* ${booking.time}\n` : ''}

*Order Details:*
`.trim();

        // Items List
        const itemsList = items?.length > 0
            ? items.map(i => `- ${i.title} (x${i.quantity})`).join('\n')
            : `- ${service.title} (x${service.quantity})`;

        message += `\n${itemsList}\n`;

        // SCENARIO-BASED INSTRUCTIONS & LOCATIONS
        const instructions = this.getLifecycleInstruction(status || 'CONFIRMED', isSeller ? 'seller' : 'buyer', type, hasPhysicalShop);
        let locationDetails = '';

        const isShopService = isService && hasPhysicalShop;
        const isShopPickup = isPhysical && hasPhysicalShop;
        const isMobileService = isService && !hasPhysicalShop;
        const isSystemDelivery = isPhysical && !hasPhysicalShop;

        if (isDigital && !isSeller) {
            if (downloadUrls && downloadUrls.length > 1) {
                locationDetails = `🔗 *Downloads:*\n${downloadUrls.map(dl => `- ${dl.name}: ${dl.url}`).join('\n')}\n`;
            } else {
                locationDetails = `🔗 *Download:* ${downloadUrl || 'Link will be sent via email'}\n`;
            }
        }
        else if (isSystemDelivery) {
            locationDetails = isSeller ? `📦 *Drop-off at:* ${this.DROPOFF_LOCATION}\n` : `📦 *Pick-up from:* ${this.DROPOFF_LOCATION}\n`;
        }
        else if ((isShopPickup || isShopService) && !isSeller) {
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${seller.latitude},${seller.longitude}`;
            locationDetails = `📍 *At Shop:* ${seller.address}\n🔗 *Navigate:* ${mapsLink}\n`;
        }
        else if (isMobileService && isSeller) {
            const hasBuyerLoc = !!loc.lat && !!loc.lng && !!loc.address && loc.address !== 'Not specified';
            const mapsLink = hasBuyerLoc ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : null;
            locationDetails = `📍 *Buyer Location:* ${loc.address}${mapsLink ? `\n🔗 *Navigate:* ${mapsLink}` : ''}\n`;
        }
        else if (isMobileService && !isSeller) {
            locationDetails = `📍 *Your Service Address:* ${loc.address}\n`;
        }

        // Render full booking details for service orders
        const hasDate = booking?.date && booking.date !== 'null' && booking.date !== 'undefined';
        const hasTime = booking?.time && booking.time !== 'null' && booking.time !== 'undefined';

        if (hasDate || hasTime || booking?.requirements) {
            message += '\n📋 *Booking Details:*\n';
            if (hasDate) message += `📅 *Date:* ${booking.date}\n`;
            if (hasTime) message += `⏰ *Time:* ${booking.time}\n`;
            if (booking?.duration) message += `⏱ *Duration:* ${booking.duration}\n`;
            if (booking?.requirements) message += `📝 *Specifications:* ${booking.requirements}\n`;
        }

        if (locationDetails) message += `\n${locationDetails}`;
        if (instructions) message += `\n${instructions}\n`;

        // Footer
        const footerText = isSeller ? 'Manage your orders on your dashboard.' : 'Thank you for shopping with Byblos!';
        message += `\n${footerText}`;

        return message.trim();
    }

    async notifySellerNewOrder(order) {
        const sellerWhatsApp = order.seller?.whatsapp_number || order.seller?.phone;
        if (!sellerWhatsApp || sellerWhatsApp === 'N/A') return false;

        try {
            const msg = this.buildWhatsAppMessage(order, 'seller');
            return this.sendMessage(sellerWhatsApp, msg);
        } catch (err) {
            logger.error(`[WHATSAPP] Failed to notify seller: ${err.message}`);
            return false;
        }
    }

    async notifyBuyerOrderConfirmation(order) {
        const buyerWhatsApp = order.buyer?.whatsapp_number || order.buyer?.phone;
        if (!buyerWhatsApp || buyerWhatsApp === 'N/A') return false;

        try {
            const msg = this.buildWhatsAppMessage(order, 'buyer');
            logger.info(`[WHATSAPP] Sending Order Confirmation to Buyer ${buyerWhatsApp}`);
            return this.sendMessage(buyerWhatsApp, msg);
        } catch (err) {
            logger.error(`[WHATSAPP] Failed to notify buyer: ${err.message}`);
            return false;
        }
    }

    async notifyBuyerPaymentSuccess({ order, items = [] }) {
        const buyerWhatsApp = order.buyer?.whatsapp_number || order.buyer?.phone;
        if (!buyerWhatsApp || buyerWhatsApp === 'N/A') return false;

        const orderNumber = order.orderNumber || order.order_number || order.id;
        const total = Number.parseFloat(order.totalAmount || order.total_amount || 0);
        const itemsList = items.length > 0
            ? items.map(item => `- ${item.product_name || item.name || item.title || 'Item'} (x${item.quantity || 1})`).join('\n')
            : (order.items || []).map(item => `- ${item.title || item.name || 'Item'} (x${item.quantity || 1})`).join('\n');

        const message = `
✅ *Payment Confirmed: #${orderNumber}*
Amount: *KSh ${total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

*Items:*
${itemsList || '- Order item'}

_Your Byblos dashboard remains the source of truth for order status._
`.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    async notifyBuyerDigitalDelivery({ order, items = [] }) {
        const buyerWhatsApp = order.buyer?.whatsapp_number || order.buyer?.phone;
        if (!buyerWhatsApp || buyerWhatsApp === 'N/A') return false;

        const orderNumber = order.orderNumber || order.order_number || order.id;
        const downloads = order.downloadUrls?.length
            ? order.downloadUrls.map(download => `- ${download.name || 'Download'}: ${download.url}`).join('\n')
            : (order.downloadUrl ? `- Download: ${order.downloadUrl}` : 'Open your buyer dashboard to access your files.');

        const message = `
📥 *Digital Order Ready: #${orderNumber}*

${downloads}

_Keep this message private. Your buyer dashboard also has your downloads._
`.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    async notifyCourierNewOrder({ order, items = [] }) {
        return this.sendLogisticsNotification({
            ...order,
            items: (items.length > 0 ? items : order.items || []).map(item => ({
                ...item,
                title: item.title || item.product_name || item.name || 'Item'
            }))
        });
    }

    async notifyBuyerStatusUpdate(updateData) {
        const { buyer, seller, order, location: loc, newStatus } = updateData;
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.phone;
        if (!buyerWhatsApp || buyerWhatsApp === 'N/A') return false;

        const { type } = order;
        const isService = (type || '').toUpperCase() === 'SERVICE';
        const isPhysical = (type || '').toUpperCase() === 'PHYSICAL';
        const hasPhysicalShop = order.fulfillment_type === 'BUYER_TO_SELLER' || sellerHasPhysicalShop(seller);

        const instructions = this.getLifecycleInstruction(newStatus, 'buyer', type, hasPhysicalShop);
        let locationDetails = '';

        const isShopPickup = isPhysical && hasPhysicalShop;
        const isShopService = isService && hasPhysicalShop;
        const isMobileService = isService && !hasPhysicalShop;
        const isSystemDelivery = isPhysical && !hasPhysicalShop;

        // Always include location for Services or Collections
        if (isShopPickup || isShopService) {
            const shopLat = seller.latitude || seller.seller_latitude;
            const shopLng = seller.longitude || seller.seller_longitude;
            const shopAddr = seller.physicalAddress || seller.physical_address || seller.shopName;
            const mapsLink = (shopLat && shopLng)
                ? `https://www.google.com/maps/search/?api=1&query=${shopLat},${shopLng}`
                : null;
            locationDetails = `📍 *At Shop:* ${shopAddr}\n`;
            if (mapsLink) locationDetails += `🔗 *Navigate:* ${mapsLink}\n`;
        } else if (isSystemDelivery && ['AWAITING_SELLER_ACTION', 'FULFILLING', 'READY_FOR_BUYER', 'COLLECTION_PENDING', 'DELIVERY_COMPLETE'].includes(newStatus)) {
            locationDetails = `📍 *At Hub:* ${this.DROPOFF_LOCATION}\n`;
        } else if (isMobileService) {
            locationDetails = `📍 *Your Service Address:* ${loc.address}\n`;
        }

        const typeLabel = isService ? 'Service' : 'Product';

        // FIX 5: Enriched Booking Details
        const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : (order.metadata || {});
        const bookingDate = metadata.booking_date || metadata.bookingDate;
        const bookingTime = metadata.booking_time || metadata.bookingTime;
        const requirements = order.service_requirements || metadata.service_requirements || metadata.requirements;

        const bookingInfo = (bookingDate || bookingTime)
            ? `\n🗓️ *Booking:* ${bookingDate || ''} ${bookingTime || ''}`.trim()
            : '';
        const reqInfo = requirements ? `\n📝 *Requirements:* ${requirements}` : '';

        // Booking details shown for service order status updates
        const buMeta = order.metadata || {};
        const buBooking = (isService && (buMeta.booking_date || buMeta.bookingDate))
            ? `\n📋 *Booking:* ${buMeta.booking_date || buMeta.bookingDate}` +
            `${buMeta.booking_time || buMeta.bookingTime ? ' at ' + (buMeta.booking_time || buMeta.bookingTime) : ''}\n`
            : '';

        const msg = `
✅ *Status Update: #${order.orderNumber}*${buBooking}
Type: *${typeLabel}*
New Status: *${newStatus.replace(/_/g, ' ')}*

${locationDetails}${instructions ? `${instructions}\n` : ''}
_Check your dashboard for full details._
`.trim();

        return this.sendMessage(buyerWhatsApp, msg);
    }

    async notifySellerStatusUpdate(updateData) {
        const { seller, buyer, order, location: loc, newStatus } = updateData;
        const sellerWhatsApp = seller?.phone || seller?.whatsapp_number;
        if (!sellerWhatsApp || sellerWhatsApp === 'N/A') return false;

        const { type } = order;
        const isService = (type || '').toUpperCase() === 'SERVICE';
        const isPhysical = (type || '').toUpperCase() === 'PHYSICAL';
        const hasPhysicalShop = order.fulfillment_type === 'BUYER_TO_SELLER' || sellerHasPhysicalShop(seller);

        const instructions = this.getLifecycleInstruction(newStatus, 'seller', type, hasPhysicalShop);
        let locationDetails = '';

        const isMobileService = isService && !hasPhysicalShop;
        const isSystemDelivery = isPhysical && !hasPhysicalShop;

        if (isMobileService) {
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
            locationDetails = `📍 *Buyer Location:* ${loc.address}\n🔗 *Navigate:* ${mapsLink}\n`;
        } else if (isSystemDelivery && ['CONFIRMED', 'AWAITING_SELLER_ACTION', 'FULFILLING', 'READY_FOR_BUYER'].includes(newStatus)) {
            locationDetails = `📍 *Drop-off Point:* ${this.DROPOFF_LOCATION}\n`;
        }

        // FIX 5: Enriched Booking Details
        const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : (order.metadata || {});
        const bookingDate = metadata.booking_date || metadata.bookingDate;
        const bookingTime = metadata.booking_time || metadata.bookingTime;
        const requirements = order.service_requirements || metadata.service_requirements || metadata.requirements;

        const bookingInfo = (bookingDate || bookingTime)
            ? `\n🗓️ *Booking:* ${bookingDate || ''} ${bookingTime || ''}`.trim()
            : '';
        const reqInfo = requirements ? `\n📝 *Requirements:* ${requirements}` : '';

        const suMeta = order.metadata || {};
        const suBooking = (isService && (suMeta.booking_date || suMeta.bookingDate))
            ? `\n📋 *Booking:* ${suMeta.booking_date || suMeta.bookingDate}` +
            `${suMeta.booking_time || suMeta.bookingTime ? ' at ' + (suMeta.booking_time || suMeta.bookingTime) : ''}\n`
            : '';

        const msg = `
✅ *Status Update: #${order.orderNumber}*${suBooking}
New Status: *${newStatus.replace(/_/g, ' ')}*

${locationDetails}${instructions ? `${instructions}\n` : ''}
_Managed via your dashboard._
`.trim();

        return this.sendMessage(sellerWhatsApp, msg);
    }

    async notifyClientOrderCreated(clientPhone, orderData) {
        const { order, items, seller } = orderData;
        if (!clientPhone) return false;

        const itemsList = items.map(item => {
            const name = item.name || item.product_name || 'Item';
            return `- ${name} (x${item.quantity})`;
        }).join('\n');

        const total = Number.parseFloat(order.totalAmount || 0);
        const shopName = seller?.shop_name || seller?.businessName || 'Byblos Seller';

        const msg = `
💳 *Payment Request: #${order.orderNumber}*
Total: *KSh ${total.toLocaleString()}*
From: ${shopName}

*Items:*
${itemsList}

_Please enter your M-Pesa PIN on the prompt sent to this number to complete payment._
`.trim();

        logger.info(`[CLIENT-ORDER] Sending payment request to client ${clientPhone}`);
        return this.sendMessage(clientPhone, msg);
    }

    async sendRefundApprovedNotification(buyer, refundAmount) {
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.whatsappNumber || buyer?.phone;
        if (!buyerWhatsApp) return false;

        const message = `
🎉 *Refund Approved*
Amount: *KSh ${Number.parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

_Processing to M-Pesa (1-3 business days). Thanks for your patience._
`.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    async sendRefundRejectedNotification(buyer, refundAmount, reason) {
        const buyerWhatsApp = buyer?.whatsapp_number || buyer?.whatsappNumber || buyer?.phone;
        if (!buyerWhatsApp) return false;

        const message = `
❌ *Refund Declined*
Amount: *KSh ${Number.parseFloat(refundAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

*Reason:* ${reason || 'Please contact support.'}
`.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    formatLogisticsAmount(value, currency = 'KES') {
        const amount = Number.parseFloat(value || 0);
        const safeCurrency = String(currency || 'KES').toUpperCase();
        const label = safeCurrency === 'KES' || safeCurrency === 'KSH' ? 'KSh' : safeCurrency;
        return `${label} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    logisticsMilestoneTitle(notificationType) {
        const titles = {
            delivery_paid: 'Door delivery paid',
            pickup_paid: 'Seller pickup paid',
            pickup_assigned: 'Pickup assigned',
            picked_up_from_seller: 'Package picked up from seller',
            dropped_at_hub: 'Package dropped at hub',
            out_for_delivery: 'Package out for delivery',
            delivered: 'Package delivered',
            delivery_delayed: 'Delivery delayed',
            delivery_failed: 'Delivery failed',
            pickup_failed: 'Pickup failed'
        };
        return titles[notificationType] || 'Logistics update';
    }

    async sendLogisticsMilestoneNotification(phone, { recipientRole, notificationType, context }) {
        if (!phone || phone === 'N/A') return false;

        const order = context?.order || {};
        const request = context?.request || {};
        const leg = context?.leg || {};
        const buyer = context?.buyer || {};
        const seller = context?.seller || {};
        const title = this.logisticsMilestoneTitle(notificationType);
        const orderNumber = order.orderNumber || order.id || 'pending';
        const packageCode = request.packageCode || `Order ${orderNumber}`;
        const fee = this.formatLogisticsAmount(leg.feeAmount, leg.feeCurrency);
        const location = leg.type === 'pickup'
            ? (leg.origin || seller.location || 'Pickup location pending')
            : (leg.destination || 'Delivery address pending');
        const itemSummary = Array.isArray(order.items) && order.items.length
            ? order.items.map(item => `${item.name || 'Item'} x${item.quantity || 1}`).join(', ')
            : 'Package';
        const trackingLink = recipientRole === 'seller'
            ? context?.trackingLinks?.seller?.url
            : context?.trackingLinks?.buyer?.url;

        const audienceLine = recipientRole === 'partner'
            ? `Coordinate this ${leg.type || 'logistics'} leg in the Mzigo dashboard.`
            : `Track here: ${trackingLink || 'Open Byblos to view the official tracking timeline.'}`;

        const message = `
*${title}*
Order: *#${orderNumber}*
Package: *${packageCode}*
Items: ${itemSummary}

Buyer: ${buyer.name || 'Buyer'}
Seller: ${seller.name || 'Seller'}
Leg: ${leg.type || 'logistics'}
Status: ${String(leg.status || notificationType).replace(/_/g, ' ')}
Fee: ${fee}
Location: ${location}

${audienceLine}
_WhatsApp is notification only. Byblos tracking is the source of truth._
`.trim();

        return this.sendMessage(phone, message);
    }

    async sendLogisticsNotification(order) {
        if (!this.COURIER_NUMBER || this.COURIER_NUMBER === 'N/A') {
            logger.warn('[LOGISTICS] No courier number configured. Set COURIER_WHATSAPP_NUMBER env var.');
            return false;
        }

        // Add null safety for seller/buyer whatsapp
        const sellerPhone = order.seller?.whatsapp_number || order.seller?.phone || 'N/A';
        const buyerPhone = order.buyer?.whatsapp_number || order.buyer?.phone || 'N/A';

        logger.info(`[LOGISTICS] Attempting courier notification: target=${this.COURIER_NUMBER}, order=#${order.orderNumber}, seller=${order.seller.name}, buyer=${order.buyer.name}`);

        const itemsList = order.items?.length > 0
            ? order.items.map(i => `- ${i.title} (x${i.quantity})`).join('\n')
            : `- ${order.service?.title || 'Item'} (x${order.service?.quantity || 1})`;

        try {
            const msg = `
🚚 *Logistics Request: #${order.orderNumber}*
Value: *KSh ${order.totalAmount.toLocaleString()}*

*Items:*
${itemsList}

👤 *Seller:* ${order.seller.name} (${sellerPhone})
👤 *Buyer:* ${order.buyer.name} (${buyerPhone})
📍 *Pick/Drop:* ${order.location.address}

_Coordinate pickup and delivery to ${this.DROPOFF_LOCATION}._
`.trim();

            return this.sendMessage(this.COURIER_NUMBER, msg);
        } catch (err) {
            logger.error(`[WHATSAPP] Failed to notify logistics: ${err.message}`);
            return false;
        }
    }

    async sendLogisticsCancellationNotification(order, buyer, seller, cancelledBy) {
        const COURIER_NUMBER = this.COURIER_NUMBER;

        const orderNum = order.orderNumber || order.order_number || order.id;
        const total = Number.parseFloat(order.total_amount || order.totalAmount || 0);

        const message = `
❌ *Logistics Cancelled: #${orderNum}*
Value: *KSh ${total.toLocaleString()}*
By: ${cancelledBy || 'System'}

_Do NOT collect this order. If already collected, contact the seller for return._
`.trim();

        logger.info(`[LOGISTICS] Sending cancellation to courier for order #${orderNum}`);
        return this.sendMessage(COURIER_NUMBER, message);
    }

    async sendBuyerOrderCancellationNotification(order, cancelledBy) {
        const buyerWhatsApp = order.buyer_whatsapp_number || order.whatsapp_number || order.phone;
        if (!buyerWhatsApp) return false;

        const message = `
❌ *Order Cancelled: #${order.id || order.orderNumber}*
_Refund added to your balance. View on your dashboard._
`.trim();

        return this.sendMessage(buyerWhatsApp, message);
    }

    async sendSellerOrderCancellationNotification(order, seller, cancelledBy) {
        const sellerWhatsApp = seller?.whatsapp_number || seller?.whatsappNumber || seller?.phone;
        if (!sellerWhatsApp || sellerWhatsApp === 'N/A') return false;

        const message = `
❌ *Order Cancelled: #${order.id || order.orderNumber}*
By: ${cancelledBy === 'Seller' ? 'Seller' : 'Buyer'}
_Order refunded. Do not ship._
`.trim();

        return this.sendMessage(sellerWhatsApp, message);
    }

    async notifySellerWithdrawalUpdate(phone, withdrawalData) {
        if (!phone || phone === 'N/A') return false;

        const { amount, status, reference, reason, request_id } = withdrawalData;
        const fmtAmount = Number.parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const idSuffix = request_id ? ` #${request_id}` : '';

        let msg = '';
        if (status === 'completed') {
            msg = `✅ *Withdrawal Successful${idSuffix}*\nAmount: *KSh ${fmtAmount}*\nRef: ${reference || 'N/A'}`;
        } else if (status === 'failed') {
            msg = `❌ *Withdrawal Failed${idSuffix}*\nAmount: *KSh ${fmtAmount}*\nReason: ${reason || 'Failed'}\n_Refunded to wallet._`;
        } else if (status === 'processing') {
            msg = `⏳ *Withdrawal Processing${idSuffix}*\nAmount: *KSh ${fmtAmount}*\n_We'll notify you once completed._`;
        } else {
            return false;
        }

        return this.sendMessage(phone, msg.trim());
    }
}

export default new WhatsAppService();


