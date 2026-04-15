import { Money } from '../valueObjects/Money.js';

export class Product {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.price = data.price instanceof Money ? data.price : new Money(data.price);
        this.sellerId = data.sellerId;
        this.status = data.status || 'available';
        this.quantity = data.quantity || 0;
        this.trackInventory = !!data.trackInventory;
        this.isDigital = !!data.isDigital;
        this.metadata = data.metadata || {};
    }

    hasSufficientStock(requestedQuantity) {
        if (!this.trackInventory) return true;
        return this.quantity >= requestedQuantity;
    }

    reduceStock(amount) {
        if (!this.trackInventory) return;
        if (!this.hasSufficientStock(amount)) {
            throw new Error(`Insufficient stock for product ${this.name}`);
        }
        this.quantity -= amount;
    }

    isAvailable() {
        return this.status === 'available' && (!this.trackInventory || this.quantity > 0);
    }
}
