import apiClient from '@/infrastructure/http/apiClient';

export interface ApiLiveEtaResponse {
  orderId: string;
  legId: string | null;
  trackingStatus: 'preparing' | 'waiting_for_location' | 'in_transit' | 'arriving' | 'delivered' | string;
  etaMinutes: number | null;
  estimatedArrival: string | null;
  routeProgress: number;
  lastUpdatedAt: string | null;
  isStale: boolean;
}

export interface RiderLocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
}

export async function fetchOrderLiveEta(orderId: string): Promise<ApiLiveEtaResponse> {
  const response = await apiClient.get<{ status: string; data: ApiLiveEtaResponse }>(`/orders/${orderId}/live-eta`);
  return response.data;
}

export async function postRiderLocation(legId: string, payload: RiderLocationPayload): Promise<void> {
  await apiClient.post(`/logistics/legs/${legId}/location`, payload);
}
