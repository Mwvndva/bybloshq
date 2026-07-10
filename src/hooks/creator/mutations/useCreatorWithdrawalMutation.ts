import { useMutation, useQueryClient } from '@tanstack/react-query';
import creatorApi from '@/api/creator';
import { creatorQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

export function useCreatorWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => creatorApi.requestWithdrawal(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
      toast.success('Withdrawal request submitted successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Withdrawal request failed');
    },
  });
}


