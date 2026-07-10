import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

export function useRefundRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number }) => buyerApi.requestRefund(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.refunds() });
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.profile() });
      toast.success(res.message || 'Refund requested successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to submit refund request');
    },
  });
}


