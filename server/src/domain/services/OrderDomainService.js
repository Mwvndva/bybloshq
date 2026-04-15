import { PricingService } from './PricingService.js';

export class OrderDomainService {
    /**
     * Coordinates the completion of an order
     * @param {Order} order 
     * @param {Seller} seller 
     */
    static completeOrder(order, seller) {
        if (!order.canBeCompleted()) {
            throw new Error(`Order ${order.id} cannot be completed in its current state.`);
        }

        const sellerEarnings = PricingService.calculateSellerEarnings(order.totalPrice);

        order.complete();
        seller.addEarnings(sellerEarnings);

        return {
            order,
            seller,
            earnings: sellerEarnings
        };
    }

    /**
     * Validates if an order can be placed based on product inventory
     * @param {Product[]} products 
     * @param {Object[]} itemsRequested 
     */
    static validateStock(products, itemsRequested) {
        for (const requested of itemsRequested) {
            const product = products.find(p => p.id === requested.id);
            if (!product) throw new Error(`Product ${requested.id} not found.`);
            if (!product.hasSufficientStock(requested.quantity)) {
                throw new Error(`Insufficient stock for ${product.name}.`);
            }
        }
    }
}
