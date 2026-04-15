import { container } from '../../container.js';
import logger from '../../utils/logger.js';

export class OrderDeadlineJob {
    constructor(queue) {
        this.queue = queue;
        this.name = 'order-deadline-check';
    }

    async register() {
        this.queue.process(this.name, this.execute.bind(this));
    }

    async execute() {
        try {
            // Logic for checking expired orders (not yet accepted or paid)
            const expiredOrders = await container.orderRepository.findExpiredOrders();

            for (const order of expiredOrders) {
                try {
                    await container.updateOrderStatus.execute({
                        orderId: order.id,
                        userId: 'SYSTEM',
                        userRole: 'admin',
                        newStatus: 'cancelled',
                        reason: 'Order deadline expired'
                    });
                    logger.info(`[${this.name}] Cancelled expired order ${order.id}`);
                } catch (err) {
                    logger.error(`[${this.name}] Failed to cancel order ${order.id}:`, err.message);
                }
            }
        } catch (err) {
            logger.error(`[${this.name}] Job failed:`, err.message);
        }
    }
}
