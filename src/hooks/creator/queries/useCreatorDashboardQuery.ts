import { useQuery } from '@tanstack/react-query';
import creatorApi from '@/api/creator';
import { creatorQueryKeys } from '@/api/queryKeys';

export function useCreatorDashboardQuery(period = '30d', enabled = true) {
  return useQuery({
    queryKey: creatorQueryKeys.dashboard(period),
    queryFn: () => creatorApi.getDashboard(period as 'daily' | 'weekly' | 'monthly'),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


