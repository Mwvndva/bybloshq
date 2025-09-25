import { apiRequest } from '@/api/apiClient';
import { OrderFilters, OrderStats, OrderWithTimeline, OrderTimelineEvent } from '@/types/order';

export interface OrderItem {
  id: number;
  product_id: number | string;
  product_name: string;
  product_description?: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Order status types
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled' | 'awaiting_payment';

export interface OrderAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

export interface Order {
  id: number;
  buyer_id: number;
  order_number: string;
  total_amount: number;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  status_updated_at?: string;
  status_updated_by?: string;
  shipping_address: OrderAddress;
  billing_address: OrderAddress;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payments: Payment[];
  status_history?: Array<{
    status: OrderStatus;
    created_at: string;
    changed_by?: string;
    notes?: string;
  }>;
  metadata?: Record<string, any>;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery_date?: string;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string;
  transaction_id: string;
  status: PaymentStatus;
  captured: boolean;
  refunded_amount: number;
  failure_code?: string;
  failure_message?: string;
  card_last4?: string;
  card_brand?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

// Response from the backend
interface OrderListBackendResponse {
  data: Order[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  total?: number;
  total_pages?: number;
  stats?: OrderStats;
  success?: boolean;
  message?: string;
}

export interface OrderListResponse {
  data: Order[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  stats?: OrderStats;
  success: boolean;
  message?: string;
}

export interface OrderResponse {
  data: Order | OrderWithTimeline;
}

/**
 * Fetch orders with filtering and pagination
 */
export const fetchBuyerOrders = async (
  filters: Partial<OrderFilters> = {}
): Promise<OrderListResponse> => {
  const {
    status,
    paymentStatus,
    startDate,
    endDate,
    searchQuery,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = filters;

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  });

  if (status && status !== 'all') params.append('status', status);
  if (paymentStatus && paymentStatus !== 'all') params.append('paymentStatus', paymentStatus);
  if (startDate) params.append('startDate', new Date(startDate).toISOString());
  if (endDate) params.append('endDate', new Date(endDate).toISOString());
  if (searchQuery) params.append('search', searchQuery);

  const apiUrl = `/buyer/orders?${params.toString()}`;
  console.log('Making API request to:', apiUrl);
  
  try {
    const { data: responseData } = await apiRequest<OrderListBackendResponse>({
      url: apiUrl,
      method: 'GET',
    });

    console.log('API response received:', responseData);
    
    // Transform the backend response to match our frontend types
    const result: OrderListResponse = {
      data: Array.isArray(responseData) ? responseData : (responseData?.data || []),
      pagination: responseData.pagination || {
        total: responseData.total || 0,
        page: page,
        limit: limit,
        total_pages: responseData.total_pages || Math.ceil((responseData.total || 0) / limit),
      },
      stats: responseData.stats,
      success: responseData.success !== false,
      message: responseData.message,
    };
    
    console.log('Processed orders response:', {
      dataCount: result.data.length,
      pagination: result.pagination,
      success: result.success,
      hasItems: result.data.length > 0
    });
    
    return result;
  } catch (error: any) {
    console.error('Error in fetchBuyerOrders:', {
      error: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      url: error?.config?.url,
      method: error?.config?.method,
    });
    
    // Return a properly structured error response
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

/**
 * Fetch detailed order information including timeline
 */
export const fetchOrderDetails = async (
  orderId: number, 
  buyerId?: number
): Promise<OrderResponse> => {
  const params = new URLSearchParams();
  if (buyerId) {
    params.append('buyerId', buyerId.toString());
  }
  params.append('include', 'timeline,statusHistory,payments,items');
  
  const url = `/api/orders/${orderId}?${params.toString()}`;
  
  try {
    const response = await apiRequest<OrderWithTimeline>({ 
      url, 
      method: 'GET' 
    });
    
    // Transform the response to ensure consistent structure
    const order = response.data;
    
    // Ensure statusHistory is always an array
    if (!order.statusHistory) {
      order.statusHistory = [{
        status: order.status,
        created_at: order.created_at,
        changed_by: 'system',
      }];
    }
    
    // Create a timeline from status history and payment events
    const timeline: OrderTimelineEvent[] = [
      {
        id: 0,
        status: 'created',
        timestamp: order.created_at,
        changedBy: 'system',
      },
      ...order.statusHistory.map((entry, index) => ({
        id: index + 1,
        status: entry.status,
        timestamp: entry.created_at,
        changedBy: entry.changed_by || 'system',
        notes: entry.notes,
      })),
      ...(order.payments || []).map((payment, index) => ({
        id: 1000 + index, // Ensure unique IDs
        status: `payment_${payment.status}`,
        timestamp: payment.updated_at,
        changedBy: 'system',
        amount: payment.amount,
        paymentMethod: payment.payment_method,
      })),
    ].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    return {
      data: {
        ...order,
        timeline,
      },
    };
  } catch (error) {
    console.error('Error fetching order details:', error);
    throw new Error('Failed to fetch order details. Please try again later.');
  }
};

/**
 * Get order statistics for a buyer
 */
export const getOrderStats = async (buyerId: number): Promise<OrderStats> => {
  try {
    const response = await apiRequest<OrderStats>({
      url: `/buyers/${buyerId}/orders/stats`,
      method: 'GET',
    });
    
    return response.data || {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      totalAmount: 0,
    };
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      totalAmount: 0,
    };
  }
};

/**
 * Create a new order
 */
export const createOrder = async (orderData: {
  buyer_id: number;
  items: Array<{
    product_id: number | string;
    product_name: string;
    product_price: number;
    quantity: number;
    metadata?: Record<string, any>;
  }>;
  shipping_address: OrderAddress;
  billing_address?: OrderAddress;
  payment_method: string;
  payment_intent_id?: string;
  notes?: string;
  metadata?: Record<string, any>;
  source?: string;
}): Promise<OrderResponse> => {
  try {
    const response = await apiRequest<Order>({
      url: '/api/orders',
      method: 'POST',
      data: orderData,
    });

    return {
      data: response.data,
    };
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order. Please try again.');
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  orderId: number, 
  status: OrderStatus, 
  notes?: string,
  changedBy: string = 'system'
): Promise<OrderResponse> => {
  try {
    const response = await apiRequest<Order>({
      url: `/api/orders/${orderId}/status`,
      method: 'PATCH',
      data: { 
        status, 
        notes, 
        changed_by: changedBy,
        status_updated_at: new Date().toISOString(),
      },
    });

    return {
      data: response.data,
    };
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status. Please try again.');
  }
};

/**
 * Request order cancellation
 */
export const requestOrderCancellation = async (
  orderId: number,
  reason: string,
  userId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    await apiRequest({
      url: `/api/orders/${orderId}/cancel`,
      method: 'POST',
      data: { reason, user_id: userId },
    });
    
    return { 
      success: true, 
      message: 'Cancellation request submitted successfully.' 
    };
  } catch (error) {
    console.error('Error requesting cancellation:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to submit cancellation request.' 
    };
  }
};

/**
 * Confirm an order
 */
export async function confirmOrder(
  orderId: number,
  buyerId: number
): Promise<OrderResponse> {
  try {
    const response = await apiRequest<OrderResponse>({
      method: 'POST',
      url: `/orders/${orderId}/confirm`,
      data: { buyerId }
    });
    // Return the nested data property which matches OrderResponse
    return response.data;
  } catch (error) {
    console.error('Error confirming order:', error);
    throw error;
  }
}

/**
 * Track order by order number and email/phone
 */
export async function trackOrder(
  orderNumber: string, 
  email: string,
  phone?: string
): Promise<OrderResponse> {
  try {
    const params = new URLSearchParams({
      orderNumber,
      email,
      ...(phone ? { phone } : {})
    });
    
    const response = await apiRequest<Order>({
      url: `/api/orders/track?${params.toString()}`,
      method: 'GET',
    });
    
    return { data: response.data };
  } catch (error) {
    console.error('Error tracking order:', error);
    throw new Error('Order not found. Please check your details and try again.');
  }
};

/**
 * Create a return/refund request
 */
export const createReturnRequest = async (data: {
  order_id: number;
  items: Array<{
    order_item_id: number;
    quantity: number;
    reason: string;
    condition: 'unopened' | 'opened' | 'damaged';
  }>;
  reason: string;
  preferred_outcome: 'refund' | 'replacement' | 'store_credit';
  notes?: string;
}): Promise<{ success: boolean; return_id?: number; message: string }> => {
  try {
    const response = await apiRequest<{ id: number }>({
      url: '/api/returns',
      method: 'POST',
      data,
    });
    
    return { 
      success: true, 
      return_id: response.data.id,
      message: 'Return request submitted successfully.' 
    };
  } catch (error) {
    console.error('Error creating return request:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to submit return request.' 
    };
  }
};
