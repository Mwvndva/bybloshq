import { OrderStatus } from '../../../constants/enums.js';

export class UpdateOrderStatus {
    constructor({ orderRepository, transactionManager, whatsappService }) {
        this.orderRepository = orderRepository;
        this.transactionManager = transactionManager;
        this.whatsappService = whatsappService;
    }

    async execute({ orderId, userId, userRole, newStatus }) {
        return await this.transactionManager.withTransaction(async (client) => {
            // 1. Fetch and Lock
            const order = await this.orderRepository.findByIdWithLock(orderId, client);
            if (!order) throw new Error('Order not found');

            // 2. Permission Check (Moved from controller/service logic)
            if (userRole !== 'admin' && String(order.sellerId) !== String(userId)) {
                throw new Error('Unauthorized: You can only update your own orders');
            }

            // 3. Status Transition Validation (Domain logic or Use Case logic)
            this._validateTransition(order.status, newStatus);

            // 4. Update
            let paymentStatus = order.paymentStatus;
            if (newStatus === OrderStatus.COMPLETED && order.paymentStatus === 'pending') {
                paymentStatus = 'completed';
            }

            const updatedOrder = await this.orderRepository.updateStatus(orderId, newStatus, { paymentStatus }, client);

            // 5. Async side effects could be triggered here or returned to caller
            return updatedOrder;
        });
    }

    _validateTransition(current, next) {
        const validTransitions = {
            [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            // ... more status transitions from legacy service
        };

        if (!validTransitions[current]?.includes(next)) {
            throw new Error(`Invalid status transition from ${current} to ${next}`);
        }
    }
}
