import { Money } from '../valueObjects/Money.js';

export class Order {
    constructor(data) {
        this.id = data.id;
        this.buyerId = data.buyerId;
        this.sellerId = data.sellerId;
        this.totalPrice = data.totalPrice instanceof Money ? data.totalPrice : new Money(data.amount || data.total_price);
        this.status = data.status || 'pending';
        this.items = data.items || [];
        this.metadata = data.metadata || {};
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    canBeCompleted() {
        return this.status === 'pending' || this.status === 'awaiting_payment';
    }

    complete() {
        if (!this.canBeCompleted()) {
            throw new Error(`Order cannot be completed from state: ${this.status}`);
        }
        this.status = 'completed';
        this.updatedAt = new Date();
    }

    cancel(reason) {
        if (this.status === 'completed' || this.status === 'shipped') {
            throw new Error(`Order in status ${this.status} cannot be cancelled`);
        }
        this.status = 'cancelled';
        this.metadata.cancelReason = reason;
        this.updatedAt = new Date();
    }

    isDigital() {
        return this.items.every(item => item.is_digital);
    }

    getCommission(rate = 0.1) {
        return this.totalPrice.multiply(rate);
    }

    getSellerEarnings(rate = 0.1) {
        const commission = this.getCommission(rate);
        return this.totalPrice.subtract(commission);
    }
}
