import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { adminQueryKeys } from '@/api/queryKeys';

export function useAdminRefundRequestsQuery(status: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.refunds(status),
    queryFn: () => adminApi.getRefundRequests(status),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: enabled && status !== undefined
  });
}

export function useConfirmRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number | string; adminNotes: string; idempotencyKey: string }) =>
      adminApi.confirmRefund(args.id, { adminNotes: args.adminNotes }, { 'Idempotency-Key': args.idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    }
  });
}

export function useRejectRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number | string; adminNotes: string; idempotencyKey: string }) =>
      adminApi.rejectRefund(args.id, { adminNotes: args.adminNotes }, { 'Idempotency-Key': args.idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    }
  });
}


