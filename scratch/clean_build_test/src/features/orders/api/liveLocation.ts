import apiClient from '@/infrastructure/http/apiClient';
import { buyerApiInstance } from '@/features/buyer/api/instance';
import type { OrderLiveLocation } from '@/shared/types';

export async function fetchOrderLiveLocation(
  orderId: string,
  view: 'buyer' | 'seller',
): Promise<OrderLiveLocation | null> {
  try {
    const client = view === 'buyer' ? buyerApiInstance : apiClient;
    const response = await client.get<{ data?: OrderLiveLocation }>(`/orders/${orderId}/live-location`);
    return response.data?.data ?? null;
  } catch {
    return null;
  }
}
