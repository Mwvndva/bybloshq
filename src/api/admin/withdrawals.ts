import { api } from './instance';

export async function getWithdrawalRequests() {
  try {
    console.log('Fetching withdrawal requests from API...');
    const response = await api.get('/admin/withdrawal-requests');
    console.log('Withdrawal requests API response:', response);

    let withdrawalRequests = [];
    if (response.data && Array.isArray(response.data.data)) {
      withdrawalRequests = response.data.data;
    } else if (Array.isArray(response.data)) {
      withdrawalRequests = response.data;
    } else {
      console.error('Unexpected API response format:', response);
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

    console.log(`Fetched ${requests.length} withdrawal requests`);
    return requests;
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    return [];
  }
}

export async function updateWithdrawalRequestStatus(requestId: string, status: 'approved' | 'rejected') {
  return api.patch(`/admin/withdrawal-requests/${requestId}/status`, { status });
}


