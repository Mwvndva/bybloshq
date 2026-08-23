import apiClient, { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import type { ApiOrder, OrderStatus } from '@/shared/types';
import type { OrdersAnalytics, OrderQueryParams } from '../types';
import { storage } from '@/infrastructure/storage/storage';
import { buildApiBaseUrl } from '@/infrastructure/http/apiBaseUrl';

const sellerApiInstance = apiClient;

export const sellerOrdersApi = {
  async getOrders(params?: OrderQueryParams): Promise<ApiOrder[]> {
    let responseBody: any = null;

    try {
      const response = await sellerApiInstance.get<any>('/sellers/orders', { params });
      responseBody = response?.data !== undefined ? response.data : response;
      if (typeof responseBody === 'string' && responseBody.trim()) {
        try {
          responseBody = JSON.parse(responseBody);
        } catch {
          /* ignore json parse error */
        }
      }
    } catch {
      /* ignore Axios error for fetch fallback */
    }

    if (!responseBody || typeof responseBody !== 'object' || responseBody.status === 'error' || responseBody.status === 'fail') {
      try {
        const token = (await storage.get('sellerToken')) || localStorage.getItem('sellerToken');
        const csrfToken = await getFreshCsrfToken();
        const baseUrl = buildApiBaseUrl();
        const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        const fetchRes = await fetch(`${baseUrl}/sellers/orders${queryString}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-CSRF-Token': csrfToken || ''
          },
          credentials: 'include'
        });
        const textData = await fetchRes.text();
        if (textData && typeof textData === 'string') {
          try {
            responseBody = JSON.parse(textData);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore fetch fallback error */
      }
    }

    if (!responseBody || typeof responseBody !== 'object') {
      return [];
    }

    const rawOrders = Array.isArray(responseBody)
      ? responseBody
      : (Array.isArray(responseBody?.data)
          ? responseBody.data
          : (Array.isArray(responseBody?.data?.orders)
              ? responseBody.data.orders
              : (Array.isArray(responseBody?.orders)
                  ? responseBody.orders
                  : [])));

    return rawOrders;
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
    return response.data.data as { feeAmount: number; distanceKm: number; chargeableDistanceKm: number; rateKesPerKm: number; currency: string; pricingModel?: string; cbdPickupFeeKes?: number; cbdRadiusKm?: number };
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


