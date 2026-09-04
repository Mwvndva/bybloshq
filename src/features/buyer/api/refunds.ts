import { buyerApiInstance, ApiError } from './instance';

export async function requestRefund(data: {
  amount: number;
  mpesaNumber?: string;
  mpesaName?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await buyerApiInstance.post('/buyers/refund-request', data);
    return { success: true, message: response.data?.message || 'Refund request submitted successfully' };
  } catch (error) {
    const err = error as ApiError;
    console.error('Error requesting refund:', err);
    throw new Error(err.response?.data?.message || 'Failed to submit refund request');
  }
}

export async function getPendingRefundRequests(): Promise<{
  pendingRequests: Array<{
    id: number;
    amount: number;
    status: string;
    requested_at: string;
    withdrawal_fee?: number;
    total_deducted?: number;
  }>;
  hasPending: boolean;
  totalRefunds?: number;
  availableBalance?: number;
  clearingBalance?: number;
  nextAvailableAt?: string | null;
  isClearing?: boolean;
  buyerPhone?: string;
  buyerName?: string;
}> {
  try {
    const response = await buyerApiInstance.get('/buyers/refund-requests/pending');
    return response.data?.data || { hasPending: false, pendingRequests: [] };
  } catch (error) {
    const err = error as ApiError;
    console.error('Error fetching pending refund requests:', err);
    throw new Error(err.response?.data?.message || 'Failed to fetch pending refund requests');
  }
}


