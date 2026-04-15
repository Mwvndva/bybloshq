import { Money } from '../valueObjects/Money.js';

export class PricingService {
    /**
     * Calculate commission for an order
     * @param {Money} totalAmount 
     * @param {number} rate Default 0.1 (10%)
     * @returns {Money}
     */
    static calculateCommission(totalAmount, rate = 0.1) {
        return totalAmount.multiply(rate);
    }

    /**
     * Calculate seller net earnings
     * @param {Money} totalAmount 
     * @param {number} rate Default 0.1 (10%)
     * @returns {Money}
     */
    static calculateSellerEarnings(totalAmount, rate = 0.1) {
        const commission = this.calculateCommission(totalAmount, rate);
        return totalAmount.subtract(commission);
    }

    /**
     * Calculate fees for a payout/withdrawal if any
     * @param {Money} amount 
     * @returns {Money}
     */
    static calculateWithdrawalFees(amount) {
        // Currently fixed or logic from Fees config
        // Placeholder for structured fee logic
        return new Money(0, amount.currency);
    }
}
