export class PhoneNumber {
    constructor(raw) {
        this.raw = raw;
        this.normalized = this._normalize(raw);
    }

    _normalize(phone) {
        if (!phone) return '';
        let digits = phone.toString().replace(/\D/g, '');

        // Convert 254... to 0... for consistent internal storage if needed, 
        // but usually we store the most canonical form or multiple forms.
        // For Kenya, 07... is common for STK, while 254... is more global.
        // Let's stick to a consistent internal format: 254... (standard E.164 without +)

        if (digits.startsWith('0') && digits.length === 10) {
            return '254' + digits.substring(1);
        } else if (digits.length === 9) {
            return '254' + digits;
        }

        return digits;
    }

    toSTKFormat() {
        // Payd STK API wants 0... or 254... 
        // Our repository uses 0... normalization for STK usually.
        return '0' + this.normalized.substring(3);
    }

    toE164() {
        return '+' + this.normalized;
    }

    isValid() {
        return /^254(7|1)\d{8}$/.test(this.normalized);
    }

    equals(other) {
        return this.normalized === other.normalized;
    }
}
