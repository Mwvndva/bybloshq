import { useQuery } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export function useBuyerOrdersQuery(enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.orders(),
    queryFn: () => buyerApi.getOrders(),
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const orders = query.state.data;
      if (!Array.isArray(orders)) return false;
      const hasActive = orders.some((o) =>
        ['PAID', 'FULFILLING', 'PROCESSING', 'READY_FOR_BUYER', 'COLLECTION_PENDING', 'DELIVERY_PENDING'].includes(
          String(o.status || '').toUpperCase()
        )
      );
      return hasActive ? 10_000 : false;
    },
    enabled,
  });
}


