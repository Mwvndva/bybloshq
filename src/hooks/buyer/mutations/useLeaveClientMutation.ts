import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

export function useLeaveClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sellerId: string) => buyerApi.leaveClient(sellerId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.shops() });
      toast.success(res.message || 'Successfully unfollowed seller');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to unfollow seller');
    },
  });
}


