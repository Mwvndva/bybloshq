import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leavePromotedShop } from '../../api/marketplace';

export function useLeavePromotedShopMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sellerId: number) => leavePromotedShop(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['creator', 'available-shops'] });
    },
  });
}
