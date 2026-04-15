import { PhoneNumber } from '../valueObjects/PhoneNumber.js';

export class Buyer {
    constructor(data) {
        this.id = data.id;
        this.userId = data.userId;
        this.fullName = data.fullName;
        this.email = data.email;
        this.phone = data.phone instanceof PhoneNumber ? data.phone : new PhoneNumber(data.phone || data.mobilePayment);
        this.isVerified = !!data.isVerified;
        this.metadata = data.metadata || {};
    }

    verify() {
        this.isVerified = true;
    }
}
