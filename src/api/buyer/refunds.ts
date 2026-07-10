import { buyerApiInstance, ApiError } from './instance';

export async function requestRefund(data: { amount: number }): Promise<{ success: boolean; message?: string }> {
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
  }>;
  hasPending: boolean;
}> {
  try {
    const response = await buyerApiInstance.get('/buyers/refund-requests/pending');
    return response.data?.data || { hasPending: false, requests: [] };
  } catch (error) {
    const err = error as ApiError;
    console.error('Error fetching pending refund requests:', err);
    throw new Error(err.response?.data?.message || 'Failed to fetch pending refund requests');
  }
}


