import { useQuery } from '@tanstack/react-query';
import { fetchOrderLiveEta, type ApiLiveEtaResponse } from '../api/eta';

export function useOrderLiveEtaQuery(orderId: string | undefined, isTrackingActive: boolean) {
  return useQuery<ApiLiveEtaResponse>({
    queryKey: ['order', orderId, 'live-eta'],
    queryFn: () => fetchOrderLiveEta(orderId!),
    enabled: Boolean(orderId && isTrackingActive),
    refetchInterval: isTrackingActive ? 10_000 : false,
    staleTime: 5_000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
