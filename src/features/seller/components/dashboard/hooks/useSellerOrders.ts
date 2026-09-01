import { useQuery } from '@tanstack/react-query';
import { sellerApi } from '@/features/seller/api';
import { sellerDashboardQueryKeys } from '../queryKeys';

export function useSellerOrders() {
  return useQuery({
    queryKey: sellerDashboardQueryKeys.orders,
    queryFn: () => sellerApi.getOrders(),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const orders = query.state.data;
      if (!Array.isArray(orders)) return false;
      const hasActive = orders.some((o: any) =>
        ['PAID', 'FULFILLING', 'PROCESSING', 'READY_FOR_BUYER', 'COLLECTION_PENDING', 'DELIVERY_PENDING'].includes(
          String(o.status || '').toUpperCase()
        )
      );
      return hasActive ? 10_000 : false;
    },
  });
}


