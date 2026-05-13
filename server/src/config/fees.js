const Fees = {
    PRODUCT_MIN_PRICE: 50,             // Minimum seller product price in KES
    PRODUCT_SERVICE_CHARGE_RATE: 0.015, // Price-inclusive service charge for operations/transit security
    PLATFORM_COMMISSION_AMOUNT: 10,    // Flat KES 10 platform cut per order
    REFERRAL_REWARD_RATE: 0.002,       // 0.2% referral reward rate
    DEFAULT_CURRENCY: 'KES',
    MIN_WITHDRAWAL_AMOUNT: 50,         // Minimum seller withdrawal amount in KES
    MAX_WITHDRAWAL_AMOUNT: 250000,
    WITHDRAWAL_FEE_TIERS: [
        { min: 50, max: 1500, fee: 21 },
        { min: 1501, max: 19999.99, fee: 45 },
        { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63 }
    ],
    calculateWithdrawalFee(amount) {
        const parsedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount < this.MIN_WITHDRAWAL_AMOUNT) {
            return 0;
        }

        const tier = this.WITHDRAWAL_FEE_TIERS.find(({ min, max }) => parsedAmount >= min && parsedAmount <= max);
        return tier ? tier.fee : 0;
    },
    calculateProductServiceCharge(amount) {
        const parsedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return 0;
        }

        return Math.ceil(parsedAmount * this.PRODUCT_SERVICE_CHARGE_RATE * 100) / 100;
    }
};

export default Fees;

