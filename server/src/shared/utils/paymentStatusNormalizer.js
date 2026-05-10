import { getProviderPayloadData } from './providerReference.js';

const SUCCESS_STATUSES = new Set(['success', 'completed', 'processed', 'paid']);
const FAILED_STATUSES = new Set(['failed', 'fail', 'declined', 'cancelled', 'canceled', 'expired', 'timeout', 'error']);

export function normalizeProviderPaymentStatus(providerPayload = {}) {
    const data = getProviderPayloadData(providerPayload);
    const resultCode = Number.parseInt(data.result_code ?? data.resultCode ?? data.code, 10);
    const rawStatus = String(data.status || data.state || data.result || '').toLowerCase();

    if (SUCCESS_STATUSES.has(rawStatus) || resultCode === 0 || resultCode === 200) return 'success';
    if (FAILED_STATUSES.has(rawStatus) || (Number.isFinite(resultCode) && resultCode !== 0 && resultCode !== 200)) return 'failed';
    return rawStatus || 'pending';
}

export function normalizeProviderAmount(providerPayload = {}) {
    const data = getProviderPayloadData(providerPayload);
    const rawAmount = data.amount ?? data.Amount ?? data.value ?? data.transaction_amount;
    const amount = Number.parseFloat(rawAmount);
    return { rawAmount, amount };
}

export default {
    normalizeProviderPaymentStatus,
    normalizeProviderAmount
};
