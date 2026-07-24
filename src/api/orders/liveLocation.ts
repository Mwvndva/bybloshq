import apiClient from '@/lib/apiClient';
import { buyerApiInstance } from '@/api/buyer/instance';
import type { OrderLiveLocation } from '@/types/api/order';

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
