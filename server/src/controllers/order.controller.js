import OrderService from '../services/order.service.js';
import Order from '../models/order.model.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { sanitizeOrder } from '../utils/sanitize.js';

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
    try {
        // Assume request body contains necessary order details
        // For a seller creating an order, we enforce their ID as sellerId
        const orderData = {
            ...req.body,
            sellerId: req.user.sellerId
        };

        const order = await OrderService.createOrder(orderData);

        res.status(201).json({
            status: 'success',
            data: order
        });
    } catch (error) {
        logger.error('Error creating order:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to create order'
        });
    }
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
        res.status(200).json({ status: 'success', message: 'Order cancelled', data: updatedOrder });
    } catch (error) {
        logger.error('Error cancelling order:', error);
        res.status(400).json({ status: 'error', message: error.message });
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
            data: updatedOrder
        });
    } catch (error) {
        logger.error('Error cancelling order (seller):', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

export const createSellerClientOrder = async (req, res) => {
    try {
        const sellerId = req.user.sellerId;
        const { clientName, clientPhone, items } = req.body;

        // Basic validation
        if (!clientName || !clientPhone || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Client name, phone, and at least one product are required'
            });
        }

        // Validate phone format (basic)
        const phoneRegex = /^(?:254|0)[17]\d{8}$/;
        if (!phoneRegex.test(clientPhone.replace(/\s+/g, ''))) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number format. Use format: 0712345678 or 254712345678'
            });
        }

        // Create client order
        const orderData = {
            clientName: clientName.trim(),
            clientPhone: clientPhone.replace(/\s+/g, ''),
            paymentType: req.body.paymentType,
            items,
            paymentDetails: req.body.paymentDetails
        };

        // Ensure paymentDetails is an object for JSONB storage
        if (orderData.paymentDetails && typeof orderData.paymentDetails === 'string') {
            try {
                orderData.paymentDetails = JSON.parse(orderData.paymentDetails);
            } catch (e) {
                // Keep as string if not valid JSON
            }
        }

        const result = await OrderService.createClientOrder(sellerId, orderData);

        res.status(201).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        logger.error('Error creating client order:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to create client order'
        });
    }
};

export const downloadDigitalProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const buyerProfileId = req.user.buyerId;

        // 1. Simple query to verify ownership and payment status
        const verifyQuery = `
            SELECT 
                po.id as order_id, 
                p.id as product_id, 
                p.name as product_name,
                p.digital_file_path, 
                p.digital_file_name
            FROM product_orders po
            JOIN order_items oi ON po.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE po.id = $1 
              AND po.buyer_id = $2 
              AND oi.product_id = $3
              AND po.payment_status = 'completed'
              AND (p.product_type = 'digital' OR p.is_digital = true)
        `;

        const { rows } = await pool.query(verifyQuery, [orderId, buyerProfileId, productId]);

        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Digital product not found in this completed order'
            });
        }

        const data = rows[0];

        const digitalFilePath = data.digital_file_path;

        if (!digitalFilePath) {
            return res.status(404).json({
                status: 'error',
                message: 'File path not configured for this product'
            });
        }

        const absolutePath = path.resolve(process.cwd(), digitalFilePath.replace(/^\//, ''));
        const ext = path.extname(absolutePath).toLowerCase();
        const fileName = data.digital_file_name || `download${ext}`;

        try {
            await fs.access(absolutePath);
        } catch {
            logger.error(`[DOWNLOAD] File not found on disk: ${absolutePath}`);
            return res.status(404).json({ status: 'error', message: 'File not found on server' });
        }

        return res.download(absolutePath, fileName, (err) => {
            if (err) {
                logger.error(`[DOWNLOAD] Error sending file: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Failed to send file' });
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
