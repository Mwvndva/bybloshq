const TRANSFER_SUCCESS_STATUSES = new Set(['success', 'successful', 'completed', 'paid']);
const TRANSFER_FAILED_STATUSES = new Set(['failed', 'failure', 'reversed', 'cancelled', 'canceled', 'rejected']);

function normalizeRawStatus(value) {
    return String(value || '').trim().toLowerCase();
}

export function normalizePaystackTransferStatus(input = {}) {
    const data = input?.data && typeof input.data === 'object' ? input.data : input;
    const event = normalizeRawStatus(input?.event || data?.event);
    const status = event === 'transfer.success'
        ? 'success'
        : event === 'transfer.failed' || event === 'transfer.reversed'
            ? 'failed'
            : normalizeRawStatus(data?.status || input?.status);

    if (TRANSFER_SUCCESS_STATUSES.has(status)) return 'success';
    if (TRANSFER_FAILED_STATUSES.has(status)) return 'failed';
    return status || 'pending';
}

export function normalizePaystackTransferAmount(rawPayload = {}) {
    const root = rawPayload || {};
    const data = root.data && typeof root.data === 'object' ? root.data : root;
    const rawAmount = data.amount ?? root.amount;
    const amountSubunit = Number.parseFloat(rawAmount);
    const amount = Number.isFinite(amountSubunit)
        ? Math.round(amountSubunit) / 100
        : Number.parseFloat(data.amount_major ?? root.amount_major);

    return {
        amount,
        rawAmount,
        paystackAmountSubunit: Number.isFinite(amountSubunit) ? amountSubunit : null
    };
}

export function normalizePaystackTransferPayload(rawPayload = {}, explicitReference = null) {
    const root = rawPayload || {};
    const data = root.data && typeof root.data === 'object' ? root.data : root;
    const { amount, rawAmount, paystackAmountSubunit } = normalizePaystackTransferAmount(root);
    const reference = explicitReference
        || data.reference
        || data.transfer_code
        || root.reference
        || null;
    const status = normalizePaystackTransferStatus(root);

    return {
        ...data,
        success: status === 'success',
        status,
        reference,
        transaction_reference: reference,
        provider_reference: reference,
        client_reference: data.reference || reference,
        transfer_code: data.transfer_code || data.transferCode || null,
        amount,
        raw_amount: rawAmount,
        paystack_amount_subunit: paystackAmountSubunit,
        mpesa_receipt: data.transfer_code || data.transferCode || null,
        paystack_event: root.event || null,
        raw_response: root,
        original_response: root
    };
}

export default {
    normalizePaystackTransferStatus,
    normalizePaystackTransferAmount,
    normalizePaystackTransferPayload
};
