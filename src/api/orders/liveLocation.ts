import apiClient from '@/lib/apiClient';
import { buyerApiInstance } from '@/api/buyer/instance';
import type { OrderLiveLocation } from '@/types/api/order';

const EMPTY: OrderLiveLocation = { available: false, phase: null, location: null };

/**
 * Phase-scoped live courier location for an order. Uses the buyer or seller
 * axios instance so the caller's own session token authorizes the read; the
 * server decides whether the caller's leg is currently trackable.
 */
export async function fetchOrderLiveLocation(
  orderId: string,
  view: 'buyer' | 'seller'
): Promise<OrderLiveLocation> {
  const client = view === 'buyer' ? buyerApiInstance : apiClient;
  const response = await client.get(`/orders/${orderId}/live-location`);
  return (response.data?.data as OrderLiveLocation) || EMPTY;
}
