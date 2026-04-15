import { Order } from '../../../domain/entities/Order.js';
import { Seller } from '../../../domain/entities/Seller.js';
import { OrderDomainService } from '../../../domain/services/OrderDomainService.js';

export class CompleteOrder {
    constructor({ orderRepository, sellerRepository, transactionManager, whatsappService, emailService }) {
        this.orderRepository = orderRepository;
        this.sellerRepository = sellerRepository;
        this.transactionManager = transactionManager;
        this.whatsappService = whatsappService;
        this.emailService = emailService;
    }

    async execute(orderId) {
        return await this.transactionManager.withTransaction(async (client) => {
            // 1. Fetch and Lock
            const dbOrder = await this.orderRepository.findByIdWithLock(orderId, client);
            if (!dbOrder) throw new Error('Order not found');

            const dbSeller = await this.sellerRepository.findByIdWithLock(dbOrder.sellerId, client);
            if (!dbSeller) throw new Error('Seller not found');

            // 2. Domain Logic
            const orderEntity = new Order(dbOrder);
            const sellerEntity = new Seller(dbSeller);

            OrderDomainService.completeOrder(orderEntity, sellerEntity);

            // 3. Persist Changes
            const updatedOrder = await this.orderRepository.updateStatus(orderId, 'completed', client);
            await this.sellerRepository.update(dbSeller.id, { balance: sellerEntity.balance.amount }, client);

            // 4. Side Effects (Post-Commit or Async)
            return updatedOrder;
        });
    }
}
