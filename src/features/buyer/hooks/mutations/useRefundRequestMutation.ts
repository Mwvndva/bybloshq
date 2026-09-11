import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';

export function useRefundRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; mpesaNumber?: string; mpesaName?: string }) => buyerApi.requestRefund(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.refunds() });
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.profile() });
      toast.success(res.message || 'Refund requested successfully');
    },
    onError: (error) => {
      // The raw axios error's .message is always the generic "Request failed
      // with status code 400" — never the real backend validation reason
      // (e.g. "Insufficient balance..."). classifyApiError reads the actual
      // response body instead. Same fix as checkout's useBagCheckout.ts.
      toast.error(classifyApiError(error, 'Failed to submit refund request').message);
    },
  });
}


