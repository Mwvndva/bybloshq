import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

export function useConfirmOrderReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => buyerApi.confirmOrderReceipt(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.orders() });
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.order(orderId) });
      toast.success('Order receipt confirmed successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to confirm order receipt');
    },
  });
}


