import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApiService } from '@/api/public';
import { buyerQueryKeys } from '@/api/queryKeys';

export function useBecomeClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sellerId: string) => publicApiService.becomeClient(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.shops() });
      queryClient.invalidateQueries({ queryKey: ['public-sellers'] });
    },
  });
}


