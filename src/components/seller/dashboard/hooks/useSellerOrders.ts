import { useQuery } from '@tanstack/react-query';
import { sellerApi } from '@/api/sellerApi';
import { sellerDashboardQueryKeys } from '../queryKeys';

export function useSellerOrders() {
  return useQuery({
    queryKey: sellerDashboardQueryKeys.orders,
    queryFn: () => sellerApi.getOrders(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true
  });
}
