import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestCollaboration } from '../../api/marketplace';

export function useRequestCollaborationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sellerId, message }: { sellerId: number; message?: string }) =>
      requestCollaboration(sellerId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', 'available-shops'] });
      queryClient.invalidateQueries({ queryKey: ['creator', 'dashboard'] });
    },
  });
}
