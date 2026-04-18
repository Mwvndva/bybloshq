import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
// import pino from 'pino'; // Removed in favor of winston
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import { sellerHasPhysicalShop } from '../utils/sellerUtils.js';

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
                const loc = name;
                latitude = loc.latitude || loc.lat;
                longitude = loc.longitude || loc.lng;
            }

            // Strict check: Only return a link if coordinates are provided
            if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
                const finalLat = Number(latitude);
                const finalLng = Number(longitude);

                if (!isNaN(finalLat) && !isNaN(finalLng)) {
                    return `https://www.google.com/maps/search/?api=1&query=${finalLat},${finalLng}`;
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
     * Central message builder using the Normalized Order Payload (Single Source of Truth)
     */
    buildWhatsAppMessage(order, recipientRole) {
        this._validateOrderPayload(order);

        const isBuyer = recipientRole === 'buyer';
        const service = order.service;
        const loc = order.location;
        const buyer = order.buyer;
        const seller = order.seller;
        const booking = order.booking || {};

        // 1. Header & ID
        const icon = isBuyer ? '✅' : '🎉';
        const title = isBuyer ? 'Order Confirmed' : 'New Order';
        const header = `${icon} *${title}: #${order.orderNumber}*`;

        // 2. Summary
        const total = `*Total: KSh ${order.totalAmount?.toLocaleString() || (service.total?.toLocaleString() || (service.price * service.quantity).toLocaleString())}*`;

        // 3. Items
        const itemsList = order.items?.length > 0
            ? order.items.map(i => `- ${i.title} (x${i.quantity})`).join('\n')
            : `- ${service.title} (x${service.quantity})`;

        // 4. Specialized Info (Booking/Location)
        let details = '';
        if (booking.date) {
            details += `📅 ${booking.date} | ${booking.time || 'N/A'}\n`;
        }

        if (loc.address && loc.address !== 'Not specified') {
            const mapsLink = (loc.lat && loc.lng) ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : null;
            details += `📍 ${loc.address}${mapsLink ? `\n🔗 Navigate: ${mapsLink}` : ''}\n`;
        }

        // 5. Action/Context
        let footerText = '';
        if (isBuyer) {
            footerText = `_The seller is preparing your order. Funds are held in escrow for your safety._`;
        } else {
            footerText = `👤 Buyer: ${buyer.name} (${buyer.phone})\n_Manage this order on your dashboard._`;
        }

        const social = isBuyer ? this.formatSocialLinks(seller) : '';

        return `
${header}
${total}

*Items:*
${itemsList}

${details}
${footerText}
${social}
`.trim();
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
        const buyerWhatsApp = order.buyer?.phone;
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

    async notifyBuyerStatusUpdate(updateData) {
        const { buyer, order, newStatus } = updateData;
        const buyerWhatsApp = buyer?.phone;
        if (!buyerWhatsApp || buyerWhatsApp === 'N/A') return false;

        let statusText = newStatus;
        if (newStatus === 'COLLECTION_PENDING') statusText = 'READY FOR COLLECTION';

        const msg = `
✅ *Status Update: #${order.orderNumber}*
${statusText}

_Check your dashboard for pickup details._
`.trim();

        return this.sendMessage(buyerWhatsApp, msg);
    }

    async notifySellerStatusUpdate(updateData) {
        const { seller, order, newStatus } = updateData;
        const sellerWhatsApp = seller?.phone || seller?.whatsapp_number;
        if (!sellerWhatsApp || sellerWhatsApp === 'N/A') return false;

        const msg = `
✅ *Status Update: #${order.orderNumber}*
New Status: *${newStatus}*
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

    async sendLogisticsNotification(order) {
        if (!this.COURIER_NUMBER || this.COURIER_NUMBER === 'N/A') return false;

        try {
            const msg = `
🚚 *Logistics: #${order.orderNumber}*
Value: *KSh ${order.totalAmount.toLocaleString()}*

👤 *Seller:* ${order.seller.name} (${order.seller.phone})
👤 *Buyer:* ${order.buyer.name} (${order.buyer.phone})
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

        if (sellerHasPhysicalShop(seller)) return false;

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

        const { amount, status, reference, reason, newBalance, mpesaNumber, request_id } = withdrawalData;
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
