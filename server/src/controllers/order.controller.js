import OrderService from '../services/order.service.js';
import Order from '../models/order.model.js';
import logger from '../utils/logger.js';

export const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { page, limit, status } = req.query;

        const result = await Order.findBySellerId(sellerId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            status
        });

        res.status(200).json({
            status: 'success',
            data: result.data,
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
        const sellerId = req.user.id;

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Authorization check: Ensure the order belongs to the seller
        if (order.seller_id !== sellerId) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized access to this order' });
        }

        res.status(200).json({
            status: 'success',
            data: order
        });
    } catch (error) {
        logger.error('Error fetching order:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order'
        });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Pass req.user (which contains role/id) to service for auth check
        const updatedOrder = await OrderService.updateOrderStatus(id, req.user, status);

        res.status(200).json({
            status: 'success',
            data: updatedOrder
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
