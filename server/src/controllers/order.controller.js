/**
 * order.controller.js
 *
 * Delegates runtime order actions to CoreOrderService.
 *
 * Architecture after refactor:
 *   OrderController -> CoreOrderService -> hardened order service
 *
 * The hardened order service owns durable order lifecycle outbox events so
 * WhatsApp and other side effects are fully decoupled from the transaction.
 */
import CoreOrderService from '../core/CoreOrderService.js';
import Order from '../models/order.model.js';
import logger from '../shared/utils/logger.js';
import * as digitalDownloadRepository from '../repositories/digitalDownload.repository.js';
import path from 'path';
import fs from 'fs/promises';
import { sanitizeOrder } from '../shared/utils/sanitize.js';
import paymentService from '../services/payment.service.js';
import OrderHubDropoffService from '../services/orderHubDropoff.service.js';
import { getLiveLocationForOrder } from '../services/logisticsLiveLocation.service.js';

const OrderService = CoreOrderService;

/**
 * Phase-scoped live courier location for the buyer or seller on this order.
 * Returns the last-known point only while the caller's own leg is in motion
 * (buyer ↔ delivery out-for-delivery, seller ↔ pickup), so neither party sees
 * the courier at the other's address.
 */
export const getOrderLiveLocation = async (req, res, next) => {
    try {
        const result = await getLiveLocationForOrder({
            orderId: req.params.id,
            buyerId: req.user.buyerId,
            sellerId: req.user.sellerId
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        const { page, limit, status } = req.query;

        const result = await Order.findBySellerId(sellerId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            status
        });

        // Sellers can see buyer contact info and fee breakdown — sanitizeOrder with 'seller' context
        const sanitized = result.data.map(order => sanitizeOrder(order, 'seller'));

        res.status(200).json({
            status: 'success',
            data: sanitized,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error fetching seller orders:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch orders'
        });
    }
};

export const createOrder = async (req, res) => {
    return res.status(410).json({
        status: 'error',
        code: 'DIRECT_ORDER_CREATION_RETIRED',
        message: 'Direct order creation is retired. Start checkout through /api/payments/initiate-product so order, payment, inventory, and fulfillment stay on the protected pipeline.'
    });
};

export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.userType || req.user.role;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Allow access if requester is the seller OR the buyer on this order
        const isSeller = (req.user.sellerId && order.sellerId === req.user.sellerId);
        const isBuyer = (req.user.buyerId && order.buyerId === req.user.buyerId);

        if (!isSeller && !isBuyer) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        // Sanitize based on who is asking — buyers don't see fee data
        res.status(200).json({
            status: 'success',
            data: sanitizeOrder(order, userType)
        });
    } catch (error) {
        logger.error('Error fetching order by ID:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch order' });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Pass req.user (which contains role/id) to service for auth check
        const updatedOrder = await OrderService.updateOrderStatus(id, req.user, status);

        const userType = req.user.userType || req.user.role;
        res.status(200).json({
            status: 'success',
            data: sanitizeOrder(updatedOrder, userType)
        });
    } catch (error) {
        logger.error('Error updating order status:', error);

        const statusCode = error.message.includes('Unauthorized') ? 403 :
            error.message.includes('Invalid') ? 400 : 500;

        res.status(statusCode).json({
            status: 'error',
            message: error.message
        });
    }
};

export const requestSellerPickup = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const idempotencyKey = req.headers['idempotency-key']
            || req.headers['x-checkout-token']
            || req.body.idempotencyKey
            || req.body.checkout_token
            || null;

        const result = await paymentService.initiateSellerPickupPayment({
            orderId: req.params.id,
            sellerId,
            pickupLocation: req.body.pickupLocation || req.body.location,
            mobilePayment: req.body.mobilePayment || req.body.phone,
            idempotencyKey
        });

        res.status(200).json({
            status: 'success',
            message: result.alreadyPending
                ? 'Pickup payment is already pending confirmation.'
                : 'Pickup payment initiated. Check your phone.',
            data: result
        });
    } catch (error) {
        logger.error('Error requesting seller pickup:', error);
        const statusCode = error.message?.includes('not found') ? 404
            : error.message?.includes('already') ? 409
                : error.message?.includes('only') || error.message?.includes('required') || error.message?.includes('Valid') ? 400
                    : 500;

        res.status(statusCode).json({
            status: 'error',
            message: error.message || 'Failed to request pickup'
        });
    }
};

export const selectHubDropoff = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const updatedOrder = await OrderHubDropoffService.selectHubDropoff(req.params.id, sellerId);
        res.status(200).json({
            status: 'success',
            message: 'Hub drop-off selected. Drop the package at the hub within 24 hours.',
            data: sanitizeOrder(updatedOrder, 'seller')
        });
    } catch (error) {
        logger.error('Error selecting hub drop-off:', error);
        const statusCode = error.message?.includes('Unauthorized') || error.message?.includes('not found') ? 404
            : error.message?.includes('only') || error.message?.includes('cannot') || error.message?.includes('after') ? 400
                : 500;
        res.status(statusCode).json({ status: 'error', message: error.message || 'Failed to select hub drop-off' });
    }
};

export const markDroppedAtHub = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const updatedOrder = await OrderHubDropoffService.markDroppedAtHub(req.params.id, sellerId);
        res.status(200).json({
            status: 'success',
            message: 'Package marked as dropped at the hub.',
            data: sanitizeOrder(updatedOrder, 'seller')
        });
    } catch (error) {
        logger.error('Error marking dropped at hub:', error);
        const statusCode = error.message?.includes('Unauthorized') || error.message?.includes('not found') ? 404
            : error.message?.includes('only') || error.message?.includes('cannot') || error.message?.includes('after') ? 400
                : 500;
        res.status(statusCode).json({ status: 'error', message: error.message || 'Failed to mark package dropped at hub' });
    }
};

export const confirmBooking = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        if (!sellerId) {
            return res.status(403).json({ status: 'error', message: 'Seller profile is required' });
        }

        const updatedOrder = await OrderService.confirmBooking(req.params.id, sellerId);
        res.status(200).json({
            status: 'success',
            message: 'Booking confirmed.',
            data: sanitizeOrder(updatedOrder, 'seller')
        });
    } catch (error) {
        logger.error('Error confirming booking:', error);
        const statusCode = error.message?.includes('Unauthorized') || error.message?.includes('not found') ? 404
            : error.message?.includes('only') || error.message?.includes('Cannot') || error.message?.includes('after') ? 400
                : 500;
        res.status(statusCode).json({ status: 'error', message: error.message || 'Failed to confirm booking' });
    }
};

export const getUserOrders = async (req, res) => {
    try {
        // CROSS-ROLE FIX
        const buyerId = req.user.buyerId;

        if (!buyerId) {
            return res.status(200).json({ success: true, status: 'success', data: [], pagination: {} });
        }
        const { page, limit, status } = req.query;

        const result = await Order.findByBuyerId(buyerId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            status
        });

        const sanitized = result.data.map(order => sanitizeOrder(order, 'buyer'));

        res.status(200).json({
            success: true, // Match route schema
            status: 'success',
            data: sanitized,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error fetching user orders:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch orders'
        });
    }
};

export const confirmReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const buyerId = req.user.buyerId;  // buyers.id

        if (!buyerId) {
            return res.status(403).json({ status: 'error', message: 'No buyer profile found' });
        }

        const updatedOrder = await OrderService.confirmOrderReceipt(id, buyerId);
        res.status(200).json({
            status: 'success',
            message: 'Order receipt confirmed',
            data: sanitizeOrder(updatedOrder, 'buyer')
        });
    } catch (error) {
        logger.error('Error confirming receipt:', error);
        const status = error.message.includes('Unauthorized') ? 401 :
            error.message.includes('not found') ? 404 : 400;
        res.status(status).json({ status: 'error', message: error.message });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const buyerId = req.user.buyerId;  // must be this, not req.user.id

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
        if (String(order.buyer_id || order.buyerId) !== String(buyerId)) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const updatedOrder = await OrderService.cancelOrder(id, 'Buyer requested cancellation');
        res.status(200).json({ status: 'success', message: 'Order cancelled', data: { order: sanitizeOrder(updatedOrder, 'buyer') } });
    } catch (error) {
        logger.error('Error cancelling order:', error);
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getByReference = async (req, res) => {
    try {
        const { reference } = req.params;
        const order = await Order.findByReference(reference);

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found for this reference'
            });
        }

        // Return a structure compatible with CheckoutPage.tsx
        res.status(200).json({
            success: true,
            status: 'success',
            data: {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status.toLowerCase(),
                message: `Order status is ${order.status}`,
                paymentStatus: order.paymentStatus
            }
        });
    } catch (error) {
        logger.error('Error fetching order by reference:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order by reference'
        });
    }
};

export const sellerCancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const sellerProfileId = req.user.sellerId;  // sellers.id from crossRoles

        if (!sellerProfileId) {
            return res.status(403).json({ status: 'error', message: 'No seller profile found' });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Compare sellers.id with sellers.id
        if (String(order.seller_id || order.sellerId) !== String(sellerProfileId)) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        const updatedOrder = await OrderService.cancelOrder(id, 'Seller requested cancellation');
        res.status(200).json({
            status: 'success',
            message: 'Order cancelled',
            data: { order: sanitizeOrder(updatedOrder, 'seller') }
        });
    } catch (error) {
        logger.error('Error cancelling order (seller):', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

export const downloadDigitalProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const buyerProfileId = req.user.buyerId;

        // 1. Verify ownership and payment status before serving the file
        const data = await digitalDownloadRepository.findVerifiedDigitalItem({
            orderId,
            buyerId: buyerProfileId,
            productId
        });

        if (!data) {
            return res.status(404).json({
                status: 'error',
                message: 'Digital product not found in this completed order'
            });
        }

        const digitalFilePath = data.digital_file_path;

        if (!digitalFilePath) {
            return res.status(404).json({
                status: 'error',
                message: 'File path not configured for this product'
            });
        }

        // Security: Robust path resolution and traversal prevention
        const fileNameOnly = path.basename(digitalFilePath);

        logger.info(`[DOWNLOAD] Processing request for file: ${fileNameOnly} (Order: ${orderId})`);

        // Check multiple possible paths based on common execution environments
        const possiblePaths = [
            path.join(process.cwd(), 'server', 'uploads', 'digital_products'),
            path.join(process.cwd(), 'uploads', 'digital_products'),
            path.join(process.cwd(), '..', 'uploads', 'digital_products'),
            path.join(process.cwd(), '..', 'server', 'uploads', 'digital_products'),
            '/var/www/bybloshq/server/uploads/digital_products',
            '/var/www/bybloshq/uploads/digital_products'
        ];

        let absolutePath = null;
        let baseDir = null;

        for (const p of possiblePaths) {
            const testPath = path.resolve(p, fileNameOnly);
            try {
                // Use synchronous check for speed in the loop, or stick to async for consistency
                await fs.access(testPath);
                absolutePath = testPath;
                baseDir = p;
                logger.info(`[DOWNLOAD] ✅ File found successfully at: ${absolutePath}`);
                break;
            } catch (err) {
                // Log failed path only in debug or if no match found at the end
            }
        }

        if (!absolutePath) {
            logger.error(`[DOWNLOAD] ❌ File not found in any expected location for: ${fileNameOnly}`);
            logger.error(`[DOWNLOAD] Checked locations: ${JSON.stringify(possiblePaths)}`);
            return res.status(404).json({
                status: 'error',
                message: 'Digital file not found on server storage. Please ensure the file was uploaded correctly.',
                debug: process.env.NODE_ENV !== 'production' ? { checkedLocations: possiblePaths, fileName: fileNameOnly } : undefined
            });
        }

        // Extra guard: Ensure it's still inside a digital_products directory
        if (!absolutePath.includes('digital_products')) {
            logger.warn(`[DOWNLOAD-SECURITY] ⚠️ Traversal attempt blocked: ${absolutePath}`);
            return res.status(403).json({ status: 'error', message: 'Access denied: Invalid file path' });
        }

        const ext = path.extname(absolutePath).toLowerCase();
        const fileName = data.digital_file_name || `download${ext}`;

        logger.info(`[DOWNLOAD] 🚀 Initiating file stream: ${fileName}`);

        return res.download(absolutePath, fileName, (err) => {
            if (err) {
                logger.error(`[DOWNLOAD] 💥 Stream interrupted for ${fileName}: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Failed to complete download stream' });
                }
            }
        });

    } catch (error) {
        logger.error('Error in downloadDigitalProduct:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Download failed' });
        }
    }
};

/**
 * Helper to get MIME type based on extension
 */
function getMimeType(ext) {
    const types = {
        '.pdf': 'application/pdf',
        '.epub': 'application/epub+zip',
        '.zip': 'application/zip',
        '.mobi': 'application/x-mobipocket-ebook',
    };
    return types[ext] || 'application/octet-stream';
}
export const locationPreview = async (req, res) => {
    try {
        const { latitude, longitude, fullAddress } = req.body;

        // Basic validation
        if (!latitude || !longitude) {
            return res.status(400).json({
                status: 'error',
                message: 'Latitude and longitude are required for location preview'
            });
        }

        // Return the parsed location data for front-end preview
        res.status(200).json({
            status: 'success',
            data: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                fullAddress: fullAddress || 'Address not provided',
                mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`
            }
        });
    } catch (error) {
        logger.error('Error in location preview:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process location preview'
        });
    }
};



