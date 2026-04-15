import { container } from '../../container.js';
import { sanitizeOrder } from '../../utils/sanitize.js';
import { BaseController } from './BaseController.js';

export class OrderController extends BaseController {
    async createOrder(req, res) {
        return this.handle(req, res, async () => {
            const orderData = { ...req.body, sellerId: req.user.sellerId };
            const order = await container.createOrder.execute(orderData);

            const userType = req.user.userType || req.user.role;
            return this.success(res, { order: sanitizeOrder(order, userType) }, 201);
        }, 'createOrder');
    }

    async updateOrderStatus(req, res) {
        return this.handle(req, res, async () => {
            const { id } = req.params;
            const { status } = req.body;

            const updatedOrder = await container.updateOrderStatus.execute({
                orderId: id,
                userId: req.user.sellerId || req.user.id,
                userRole: req.user.userType || req.user.role,
                newStatus: status
            });

            const userType = req.user.userType || req.user.role;
            return this.success(res, sanitizeOrder(updatedOrder, userType));
        }, 'updateOrderStatus');
    }

    async getSellerOrders(req, res) {
        return this.handle(req, res, async () => {
            const sellerId = req.user.sellerId;
            const { page, limit, status } = req.query;

            const result = await container.orderRepository.findBySellerId(sellerId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status
            });

            const sanitized = result.data.map(order => sanitizeOrder(order, 'seller'));
            return this.success(res, sanitized, 200, { pagination: result.pagination });
        }, 'getSellerOrders');
    }

    async getOrderById(req, res) {
        return this.handle(req, res, async () => {
            const { id } = req.params;
            const order = await container.orderRepository.findById(id);
            if (!order) return this.error(res, 'Order not found', 404);

            const isSeller = (req.user.sellerId && order.sellerId === req.user.sellerId);
            const isBuyer = (req.user.buyerId && order.buyerId === req.user.buyerId);

            if (!isSeller && !isBuyer && req.user.role !== 'admin') {
                return this.error(res, 'Unauthorized', 403);
            }

            const userType = req.user.userType || req.user.role;
            return this.success(res, sanitizeOrder(order, userType));
        }, 'getOrderById');
    }

    async getByReference(req, res) {
        return this.handle(req, res, async () => {
            const { reference } = req.params;
            const order = await container.orderRepository.findByOrderNumber(reference);
            if (!order) return this.error(res, 'Order not found', 404);

            return this.success(res, sanitizeOrder(order, 'buyer'));
        }, 'getByReference');
    }

    async getUserOrders(req, res) {
        return this.handle(req, res, async () => {
            const buyerId = req.user.buyerId;
            const { page, limit, status } = req.query;

            if (!buyerId) return this.error(res, 'Buyer profile required', 400);

            const result = await container.orderRepository.findByBuyerId(buyerId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status
            });

            const sanitized = result.data.map(order => sanitizeOrder(order, 'buyer'));
            return this.success(res, sanitized, 200, { pagination: result.pagination });
        }, 'getUserOrders');
    }
}

export const orderController = new OrderController();
