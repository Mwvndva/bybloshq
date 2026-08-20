import { useQuery } from '@tanstack/react-query';
import creatorApi from '@/features/creator/api';
import { creatorQueryKeys } from '@/features/creator/api/queryKeys';

export function useCreatorInviteQuery(token: string, enabled = true) {
  return useQuery({
    queryKey: creatorQueryKeys.invite(token),
    queryFn: () => creatorApi.getInvite(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: enabled && !!token,
    retry: false,
  });
}


