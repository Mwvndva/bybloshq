import { Order } from '../../../domain/entities/Order.js';
import { Product } from '../../../domain/entities/Product.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import { OrderDomainService } from '../../../domain/services/OrderDomainService.js';

export class CreateOrder {
    constructor({ orderRepository, productRepository, sellerRepository, buyerRepository, transactionManager }) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.sellerRepository = sellerRepository;
        this.buyerRepository = buyerRepository;
        this.transactionManager = transactionManager;
    }

    async execute(orderData) {
        return await this.transactionManager.withTransaction(async (client) => {
            const {
                buyerId, sellerId, paymentMethod, items: rawItems,
                buyerName, buyerEmail, buyerPhone, buyerLocation,
                notes, metadata = {}
            } = orderData;

            // 1. Fetch dependencies
            const seller = await this.sellerRepository.findByIdWithLock(sellerId, client);
            if (!seller) throw new Error('Seller not found');

            const productIds = rawItems.map(i => i.productId);
            const dbProducts = await this.productRepository.findByIdsWithLock(productIds, client);

            // 2. Domain Validation & Stock Check
            // We'll wrap DB rows in Domain Entities
            const productEntities = dbProducts.map(p => new Product(p));
            OrderDomainService.validateStock(productEntities, rawItems);

            // 3. Calculation (Simplified for now - can use PricingService)
            let totalAmount = 0;
            for (const item of rawItems) {
                const product = dbProducts.find(p => p.id === item.productId);
                totalAmount += product.price * item.quantity;
            }

            // 4. Create Order Number
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // 5. Save Order
            const orderRecord = {
                orderNumber,
                buyerId,
                sellerId,
                totalAmount,
                paymentMethod,
                buyerName,
                buyerEmail,
                buyerPhone,
                status: 'pending',
                metadata: { ...metadata, items: rawItems }
            };

            const savedOrder = await this.orderRepository.insert(orderRecord, client);

            // 6. Update inventory
            for (const item of rawItems) {
                await this.productRepository.decrementInventory(item.productId, item.quantity, client);
            }

            return savedOrder;
        });
    }
}
