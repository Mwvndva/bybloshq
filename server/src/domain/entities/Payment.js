import { Money } from '../valueObjects/Money.js';

export class Payment {
    constructor(data) {
        this.id = data.id;
        this.invoiceId = data.invoiceId;
        this.amount = data.amount instanceof Money ? data.amount : new Money(data.amount || data.total_amount);
        this.status = data.status || 'pending';
        this.providerReference = data.providerReference;
        this.paymentMethod = data.paymentMethod;
        this.metadata = data.metadata || {};
        this.createdAt = data.createdAt || new Date();
    }

    markAsCompleted(reference) {
        if (this.status === 'completed') return;
        this.status = 'completed';
        this.providerReference = reference || this.providerReference;
        this.metadata.completedAt = new Date().toISOString();
    }

    markAsFailed(reason) {
        this.status = 'failed';
        this.metadata.failureReason = reason;
    }

    isSuccessful() {
        return this.status === 'completed' || this.status === 'success';
    }
}
