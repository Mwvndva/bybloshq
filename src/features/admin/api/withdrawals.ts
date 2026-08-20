import { api } from './instance';

export async function getWithdrawalRequests() {
  try {
    const response = await api.get('/admin/withdrawal-requests');

    let withdrawalRequests = [];
    if (response.data && Array.isArray(response.data.data)) {
      withdrawalRequests = response.data.data;
    } else if (Array.isArray(response.data)) {
      withdrawalRequests = response.data;
    } else {
      return [];
    }

    const requests = withdrawalRequests.map((request: Record<string, unknown>) => ({
      id: String(request.id || `withdrawal-${globalThis.crypto.randomUUID()}`),
      amount: Number(request.amount || 0),
      mpesaNumber: String(request.mpesa_number || request.mpesaNumber || ''),
      mpesaName: String(request.mpesa_name || request.mpesaName || ''),
      status: String(request.status || 'pending'),
      sellerId: String(request.seller_id || request.sellerId || ''),
      sellerName: String(request.entityName || request.entity_name || request.seller_name || request.sellerName || request.mpesaName || request.mpesa_name || 'Seller'),
      sellerEmail: String(request.entityEmail || request.entity_email || request.seller_email || request.sellerEmail || ''),
      providerReference: request.provider_reference || request.providerReference || null,
      createdAt: request.created_at || request.createdAt || new Date().toISOString(),
      processedAt: request.processed_at || request.processedAt || null,
      processedBy: request.processed_by || request.processedBy || null
    }));

    return requests;
  } catch (error) {
    return [];
  }
}

export async function updateWithdrawalRequestStatus(requestId: string, status: 'approved' | 'rejected') {
  return api.patch(`/admin/withdrawal-requests/${requestId}/status`, { status });
}


