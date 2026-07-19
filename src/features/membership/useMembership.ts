import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMembership, joinMembership, type MembershipStatus } from '@/api/membership';

export const MEMBERSHIP_QUERY_KEY = ['membership'] as const;

/** Current buyer's membership status. Only enable once a buyer session exists. */
export function useMembership(enabled = true) {
  return useQuery<MembershipStatus>({
    queryKey: MEMBERSHIP_QUERY_KEY,
    queryFn: getMembership,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** Opt in to membership; seeds the cache with the minted number on success. */
export function useJoinMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: joinMembership,
    onSuccess: (data) => {
      queryClient.setQueryData(MEMBERSHIP_QUERY_KEY, data);
    },
  });
}
