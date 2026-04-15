export class EscrowService {
    /**
     * Logic for releasing funds from escrow to seller
     * @param {Order} order 
     * @param {Seller} seller 
     */
    static releaseFunds(order, seller) {
        // In our simplified model, completion usually triggers earnings
        // This could handle more complex time-lock or dispute logic
        if (order.status !== 'completed') {
            throw new Error('Funds can only be released for completed orders.');
        }
        // Logic is already partly in OrderDomainService.completeOrder
    }

    /**
     * Logic for refunding funds to buyer
     * @param {Order} order 
     * @param {Buyer} buyer 
     */
    static refundBuyer(order, buyer) {
        if (order.status === 'completed') {
            throw new Error('Completed orders cannot be automatically refunded through escrow.');
        }
        order.cancel('Refunded');
        // Actual payment refund logic would be in an Application Use Case calling a Provider
    }
}
