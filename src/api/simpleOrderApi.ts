import { apiRequest } from './apiClient';

// Simplified order interface
export interface SimpleOrder {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  buyer_id: number;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  items: Array<{
    id: number;
    product_name: string;
    quantity: number;
    subtotal: number;
  }>;
  metadata?: {
    autoConfirmSet?: boolean;
  };
}

interface SimpleOrderResponse {
  success: boolean;
  data: SimpleOrder[];
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Simplified function to fetch buyer orders
 */
export const fetchBuyerOrders = async ({
  page = 1,
  limit = 10,
  status,
}: {
  page?: number;
  limit?: number;
  status?: string;
} = {}): Promise<SimpleOrderResponse> => {
  try {
    // Build query parameters
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status && status !== 'all') {
      params.append('status', status);
    }

    // Make the API request
    const response = await apiRequest<SimpleOrderResponse>({
      url: `/api/buyers/orders?${params.toString()}`,
      method: 'GET',
    });

    console.log('API Response:', response);

    // Handle case where response is an array (direct data)
    if (Array.isArray(response)) {
      return {
        success: true,
        data: response,
        pagination: {
          total: response.length,
          page,
          limit,
          total_pages: Math.ceil(response.length / limit),
        },
      };
    }

    // Handle case where response has data property
    if (response && 'data' in response) {
      const data = Array.isArray(response.data) ? response.data : [];
      const pagination = response as { pagination?: { total: number } };
      const total = pagination?.pagination?.total ?? data.length;
      
      return {
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      };
    }

    // Default empty response
    return {
      success: true,
      data: [],
      pagination: {
        total: 0,
        page,
        limit,
        total_pages: 0,
      },
    };
  } catch (error: any) {
    console.error('Error in fetchBuyerOrders:', {
      error: error?.message,
      status: error?.response?.status,
    });

    // Return a user-friendly error response
    return {
      success: false,
      data: [],
      message: error?.response?.data?.message || 'Failed to fetch orders. Please try again later.',
      pagination: {
        total: 0,
        page,
        limit,
        total_pages: 0,
      },
    };
  }
};

/**
 * Simplified function to fetch a single order by ID
 */
/**
 * Update order status
 */
export const updateOrderStatus = async ({
  orderId,
  status,
  note
}: {
  orderId: number;
  status: string;
  note?: string;
}): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await apiRequest<{ success: boolean; message?: string }>({
      url: `/api/orders/${orderId}/status`,
      method: 'PATCH',
      data: { status, note }
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to update order status');
    }

    return { success: true, message: 'Order status updated successfully' };
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to update order status' 
    };
  }
};

/**
 * Fetch order details by ID
 */
export const fetchOrderDetails = async (orderId: number): Promise<{
  success: boolean;
  data: SimpleOrder | null;
  message?: string;
}> => {
  try {
    const response = await apiRequest<{ data: SimpleOrder }>({
      url: `/orders/${orderId}`,
      method: 'GET',
    });

    if (response.data) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      data: null,
      message: 'Order not found',
    };
  } catch (error: any) {
    console.error('Error in fetchOrderDetails:', {
      error: error?.message,
      status: error?.response?.status,
    });

    return {
      success: false,
      data: null,
      message: error?.response?.data?.message || 'Failed to fetch order details',
    };
  }
};
