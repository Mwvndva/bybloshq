// Simple orders API client
import { apiRequest } from '@/api/apiClient';

export interface SimpleOrder {
  id: number;
  buyer_id: number;
  order_number: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export interface SimpleOrderResponse {
  success: boolean;
  data: SimpleOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  message?: string;
}

// Simple orders fetch function
export const fetchBuyerOrdersSimple = async ({
  page = 1,
  limit = 10
}: {
  page?: number;
  limit?: number;
} = {}): Promise<SimpleOrderResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });

  const apiUrl = `/buyers-simple/orders-simple?${params.toString()}`;
  console.log('🚀 Making request to simple endpoint:', apiUrl);

  try {
    const { data: responseData } = await apiRequest<SimpleOrderResponse>({
      url: apiUrl,
      method: 'GET',
    });

    console.log('✅ Simple API response:', responseData);
    return responseData;
  } catch (error: any) {
    console.error('❌ Error in simple orders fetch:', {
      error: error?.message,
      response: error?.response?.data,
      status: error?.response?.status
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to fetch orders',
      data: [],
      pagination: {
        total: 0,
        page,
        limit,
        total_pages: 0,
      }
    };
  }
};
