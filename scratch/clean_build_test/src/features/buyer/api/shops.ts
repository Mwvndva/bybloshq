import { buyerApiInstance, ApiError } from './instance';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  status?: string;
}

export async function leaveClient(sellerId: string): Promise<{ success: boolean; message: string; wasClient?: boolean; clientCount?: number }> {
  try {
    const response = await buyerApiInstance.post<{ message: string; data: { wasClient: boolean; clientCount?: number } }>(`/buyers/sellers/${sellerId}/leave-client`);
    return {
      success: true,
      message: response.data.message || 'Successfully unfollowed',
      wasClient: response.data.data?.wasClient,
      clientCount: response.data.data?.clientCount
    };
  } catch (error) {
    const err = error as ApiError;
    console.error('Error leaving clientele:', err);
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to unfollow'
    };
  }
}

export async function getShops(params: { page?: number; limit?: number } = {}): Promise<unknown[]> {
  try {
    const response = await buyerApiInstance.get<ApiResponse<unknown[]>>('/buyers/shops', { params });
    const isSuccess = response.data?.success || response.data?.status === 'success';
    if (!isSuccess) {
      throw new Error('Failed to fetch shops');
    }
    return response.data.data;
  } catch (error) {
    console.error('Error fetching shops:', error);
    throw error;
  }
}


