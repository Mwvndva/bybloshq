import { useQuery } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export function useBuyerOrdersQuery(enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.orders(),
    queryFn: () => buyerApi.getOrders(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


