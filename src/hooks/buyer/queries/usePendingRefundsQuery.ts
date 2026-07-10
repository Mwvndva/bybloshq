import { useQuery } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';

export function usePendingRefundsQuery(enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.refunds(),
    queryFn: () => buyerApi.getPendingRefundRequests(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


