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
  // Shape returned by sanitizeWithdrawalRequest (server/src/shared/utils/sanitize.js)
  // — camelCase, not the raw snake_case DB columns the admin/creator withdrawal
  // endpoints return unsanitized. Mixing the two up here previously crashed
  // this page (date-fns `format(new Date(undefined))` on a nonexistent
  // `requested_at` field throws instead of just rendering blank).
  pendingRequests: Array<{
    id: number;
    amount: number;
    status: string;
    createdAt: string;
    withdrawalFee?: number;
    totalDeducted?: number;
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


