export class Money {
    constructor(amount, currency = 'KES') {
        this.amount = parseFloat(amount || 0);
        this.currency = currency;
    }

    add(other) {
        this._checkCurrency(other);
        return new Money(this.amount + other.amount, this.currency);
    }

    subtract(other) {
        this._checkCurrency(other);
        return new Money(this.amount - other.amount, this.currency);
    }

    multiply(factor) {
        return new Money(this.amount * factor, this.currency);
    }

    equals(other) {
        return this.amount === other.amount && this.currency === other.currency;
    }

    format() {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: this.currency,
        }).format(this.amount);
    }

    _checkCurrency(other) {
        if (this.currency !== other.currency) {
            throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
        }
    }

    static fromObject(obj) {
        return new Money(obj.amount, obj.currency);
    }
}
