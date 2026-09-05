import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import type { FlaggedEarning, FlaggedEarningAction } from '@/features/admin/types/detections';

export function useFlaggedEarningsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.flaggedEarnings(),
    queryFn: () => adminApi.getFlaggedEarnings(50),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled
  });
}

export function useResolveFlaggedEarningMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      earningType: FlaggedEarning['earning_type'];
      id: number;
      action: FlaggedEarningAction;
      notes?: string;
      idempotencyKey: string;
    }) =>
      adminApi.resolveFlaggedEarning(
        args.earningType,
        args.id,
        { action: args.action, notes: args.notes },
        { 'Idempotency-Key': args.idempotencyKey }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    }
  });
}
