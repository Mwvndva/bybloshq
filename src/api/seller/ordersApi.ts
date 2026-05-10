import apiClient from '@/lib/apiClient';
import type { Order, OrderStatus } from '@/types/order';
import type { OrdersAnalytics, OrderQueryParams } from './types';

const sellerApiInstance = apiClient;

export const sellerOrdersApi = {
  async getOrders(params?: OrderQueryParams): Promise<Order[]> {
    const response = await sellerApiInstance.get<{ data: Order[] }>('/sellers/orders', { params });
    return response.data.data;
  },

  async getOrder(orderId: string): Promise<Order> {
    const response = await sellerApiInstance.get<{ data: Order }>(`/sellers/orders/${orderId}`);
    return response.data.data;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const response = await sellerApiInstance.patch<{ data: Order }>(
      `/sellers/orders/${orderId}`,
      { status }
    );
    return response.data.data;
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string; refundAmount: number }> {
    const response = await sellerApiInstance.patch<{ success: boolean; message: string; refundAmount: number }>(
      `/orders/${orderId}/seller-cancel`
    );
    return response.data;
  },

  async getOrdersAnalytics(): Promise<OrdersAnalytics> {
    const response = await sellerApiInstance.get<{ data: OrdersAnalytics }>('/sellers/orders/analytics');
    return response.data.data;
  },

  async quotePickup(location: { address: string; latitude: number; longitude: number }): Promise<{
    feeAmount: number;
    distanceKm: number;
    chargeableDistanceKm: number;
    rateKesPerKm: number;
    currency: string;
  }> {
    const response = await sellerApiInstance.post<{ data: any }>('/payments/logistics-quote', {
      legType: 'pickup',
      location
    });
    return response.data.data;
  },

  async requestPickup(orderId: string, payload: {
    mobilePayment: string;
    pickupLocation: { address: string; latitude: number; longitude: number };
    idempotencyKey?: string;
  }): Promise<any> {
    const response = await sellerApiInstance.post<{ data: any }>(
      `/sellers/orders/${orderId}/request-pickup`,
      payload,
      {
        headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : undefined
      }
    );
    return response.data.data;
  }
};
