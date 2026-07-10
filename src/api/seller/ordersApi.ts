import apiClient from '@/lib/apiClient';
import type { OrderStatus } from '@/types';
import type { ApiOrder } from '@/types/api/order';
import type { OrdersAnalytics, OrderQueryParams } from './types';

const sellerApiInstance = apiClient;

export const sellerOrdersApi = {
  async getOrders(params?: OrderQueryParams): Promise<ApiOrder[]> {
    const response = await sellerApiInstance.get<{ data: ApiOrder[] }>('/sellers/orders', { params });
    return response.data.data;
  },

  async getOrder(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.get<{ data: ApiOrder }>(`/sellers/orders/${orderId}`);
    return response.data.data;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<ApiOrder> {
    const response = await sellerApiInstance.patch<{ data: ApiOrder }>(
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
    pricingModel?: string;
    cbdPickupFeeKes?: number;
    cbdRadiusKm?: number;
  }> {
    const response = await sellerApiInstance.post<{ data: unknown }>('/payments/logistics-quote', {
      legType: 'pickup',
      location
    });
    return response.data.data;
  },

  async requestPickup(orderId: string, payload: {
    mobilePayment: string;
    pickupLocation: { address: string; latitude: number; longitude: number };
    idempotencyKey?: string;
  }): Promise<unknown> {
    const response = await sellerApiInstance.post<{ data: unknown }>(
      `/sellers/orders/${orderId}/request-pickup`,
      payload,
      {
        headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : undefined
      }
    );
    return response.data.data;
  },

  async selectHubDropoff(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.post<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}/select-hub-dropoff`
    );
    return response.data.data;
  },

  async markDroppedAtHub(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.post<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}/mark-dropped-at-hub`
    );
    return response.data.data;
  },

  async confirmBooking(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.post<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}/confirm-booking`
    );
    return response.data.data;
  }
};


