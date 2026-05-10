export function getProviderPayloadData(payload = {}) {
    if (payload?.data && typeof payload.data === 'object') {
        return { ...payload, ...payload.data };
    }
    return payload || {};
}

export function normalizeProviderReference(payload = {}, explicitReference = null) {
    const data = getProviderPayloadData(payload);
    const reference = explicitReference
        || data.api_ref
        || data.transaction_reference
        || data.provider_reference
        || data.invoice_id
        || data.correlator_id
        || data.transaction_id
        || data.reference
        || data.transfer_code
        || data.transferCode
        || data.tracking_id
        || data.payment_reference
        || null;

    return reference === null || reference === undefined
        ? null
        : String(reference).trim() || null;
}
