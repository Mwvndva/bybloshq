import { useQuery } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';

export function useShopsQuery(params: { page?: number; limit?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.shops(params),
    queryFn: () => buyerApi.getShops(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}


