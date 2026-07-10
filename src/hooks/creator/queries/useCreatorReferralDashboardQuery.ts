import { useQuery } from '@tanstack/react-query';
import creatorApi from '@/api/creator';
import { creatorQueryKeys } from '@/api/queryKeys';

export function useCreatorReferralDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: creatorQueryKeys.referrals(),
    queryFn: () => creatorApi.getReferralDashboard(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


