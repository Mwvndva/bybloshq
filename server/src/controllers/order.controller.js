import OrderService from '../services/order.service.js';
import Order from '../models/order.model.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { wrapFile } from '../utils/encryptor.js';
import { sanitizeOrder } from '../utils/sanitize.js';

export const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.id;
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
            sellerId: req.user.id
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
        const isSeller = userType === 'seller' && (order.seller_id === userId || order.sellerId === userId);
        const isBuyer = userType === 'buyer' && (order.buyer_id === userId || order.buyerId === userId);

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
        const buyerId = req.user.buyerProfileId || (req.user.userType === 'buyer' ? req.user.id : null);

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
        const updatedOrder = await OrderService.confirmOrderReceipt(id, req.user.id);
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
        const buyerId = req.user.id; // Buyer ID from token

        // Ensure user owns the order before cancelling (Service might not check ownership explicitly if just ID passed, but cancelOrder in service uses generic update logic. Better to be safe: Service usually expects logic.
        // Actually OrderService.cancelOrder does NOT check ownership heavily except via fetch.
        // Let's rely on Service or fetch first.
        // Step 1: verify ownership.
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
        if (order.buyer_id !== buyerId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

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
        const sellerId = req.user.id;

        // Verify ownership
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
        if (order.seller_id !== sellerId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

        const updatedOrder = await OrderService.cancelOrder(id, 'Seller requested cancellation');
        res.status(200).json({ status: 'success', message: 'Order cancelled', data: updatedOrder });
    } catch (error) {
        logger.error('Error cancelling order:', error);
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const createSellerClientOrder = async (req, res) => {
    try {
        const sellerId = req.user.id;
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
        const result = await OrderService.createClientOrder(sellerId, {
            clientName: clientName.trim(),
            clientPhone: clientPhone.replace(/\s+/g, ''),
            paymentType: req.body.paymentType,
            items
        });

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
        const userId = req.user.id;

        // 1. Verify Order Access & Status
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

        // Verify req.user.id matches order.buyer_id — sellers must NOT download buyer files
        if (order.buyer_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized: Only the buyer can download this product' });
        }

        // Must be paid/completed
        if (order.status !== 'completed' && order.status !== 'delivery_complete') {
            return res.status(403).json({ status: 'error', message: 'Order must be completed to download products' });
        }

        // 2. Fetch Product from DB
        const productResult = await pool.query(
            'SELECT id, name, digital_file_path, digital_file_name, is_digital FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }

        const product = productResult.rows[0];
        if (!product.is_digital) {
            return res.status(400).json({ status: 'error', message: 'Product is not a digital download' });
        }

        // 3. Resolve master key
        let masterKey;
        const activationResult = await pool.query(
            'SELECT master_key FROM digital_activations WHERE order_id = $1 AND product_id = $2',
            [orderId, productId]
        );

        if (activationResult.rows.length === 0) {
            // Generate and save new master key
            masterKey = crypto.randomBytes(32).toString('hex');
            await pool.query(
                'INSERT INTO digital_activations (order_id, product_id, master_key) VALUES ($1, $2, $3)',
                [orderId, productId, masterKey]
            );
        } else {
            masterKey = activationResult.rows[0].master_key;
        }

        // 4. Resolve and wrap file
        const fullPath = path.join(process.cwd(), product.digital_file_path);
        try {
            await fs.access(fullPath);
        } catch (e) {
            logger.error(`File missing: ${fullPath}`);
            return res.status(404).json({ status: 'error', message: 'Original file not found on server' });
        }

        const bybxBuffer = await wrapFile(fullPath, order.order_number, productId, masterKey);

        // 5. Send response
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${product.digital_file_name || product.name}.bybx"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        res.send(bybxBuffer);
    } catch (error) {
        logger.error('Error downloading file:', error);
        res.status(500).json({ status: 'error', message: 'Download failed' });
    }
};
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
