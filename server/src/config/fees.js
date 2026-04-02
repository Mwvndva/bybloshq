const Fees = {
    PLATFORM_COMMISSION_RATE: 0.01,  // 1% — total platform cut
    REFERRAL_REWARD_RATE: 0.002,     // 0.2% — paid FROM platform cut (net margin 0.8%)
    DEFAULT_CURRENCY: 'KES',
    MIN_WITHDRAWAL_AMOUNT: 100,      // Minimum withdrawal increased to 100 KES (Fix M-10)
    MAX_WITHDRAWAL_AMOUNT: 250000    // Payd maximum (was incorrectly 150000)
};

export default Fees;

