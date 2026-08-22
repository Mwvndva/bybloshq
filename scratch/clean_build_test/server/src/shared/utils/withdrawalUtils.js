export function parseWithdrawalMetadata(value) {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return JSON.parse(value || '{}');
        } catch {
            return {};
        }
    }
    return value;
}

export function getWithdrawalReservedAmount(request) {
    const metadata = parseWithdrawalMetadata(request?.metadata);
    const withdrawalFee = Number.parseFloat(metadata.withdrawal_fee || 0);
    const amount = Number.parseFloat(request?.amount || 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const safeFee = Number.isFinite(withdrawalFee) ? withdrawalFee : 0;
    return safeAmount + safeFee;
}
