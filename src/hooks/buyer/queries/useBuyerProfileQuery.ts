import { useQuery } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';

export function useBuyerProfileQuery(enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.profile(),
    queryFn: () => buyerApi.getProfile(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}


