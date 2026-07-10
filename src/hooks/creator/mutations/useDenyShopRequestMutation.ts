import { useMutation, useQueryClient } from '@tanstack/react-query';
import creatorApi from '@/api/creator';
import { creatorQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

export function useDenyShopRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string | number) => creatorApi.denyShopRequest(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.dashboard() });
      toast.success('Successfully denied shop request');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to deny shop request');
    },
  });
}


