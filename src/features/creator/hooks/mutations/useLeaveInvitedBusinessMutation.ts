import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveInvitedBusiness } from '../../api/marketplace';

export function useLeaveInvitedBusinessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sellerId: number) => leaveInvitedBusiness(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['creator', 'referrals'] });
    },
  });
}
