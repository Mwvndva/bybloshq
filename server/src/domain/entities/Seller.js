import { Money } from '../valueObjects/Money.js';

export class Seller {
    constructor(data) {
        this.id = data.id;
        this.userId = data.userId;
        this.shopName = data.shopName;
        this.balance = data.balance instanceof Money ? data.balance : new Money(data.balance);
        this.email = data.email;
        this.whatsappNumber = data.whatsappNumber;
        this.isActive = data.isActive !== false;
        this.metadata = data.metadata || {};
    }

    addEarnings(amount) {
        const earnings = amount instanceof Money ? amount : new Money(amount);
        this.balance = this.balance.add(earnings);
    }

    deductBalance(amount) {
        const deduction = amount instanceof Money ? amount : new Money(amount);
        if (this.balance.amount < deduction.amount) {
            throw new Error('Insufficient balance for withdrawal');
        }
        this.balance = this.balance.subtract(deduction);
    }

    canWithdraw(amount) {
        return this.balance.amount >= amount;
    }
}
