import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';
import { sellerQueryKeys } from '@/api/queryKeys';

export function useSellerWithdrawalsQuery(enabled = true) {
  return useQuery({
    queryKey: sellerQueryKeys.withdrawals(),
    queryFn: sellerApi.getWithdrawalRequests,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export function useRequestWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { amount: number; mpesaNumber: string; mpesaName: string; idempotencyKey?: string }) =>
      sellerApi.requestWithdrawal(args as unknown as Parameters<typeof sellerApi.requestWithdrawal>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.withdrawals() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
    },
  });
}


