import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { adminQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

export function useGetSellerByIdMutation() {
  return useMutation({
    mutationFn: (sellerId: string) => adminApi.getSellerById(sellerId),
  });
}

export function useUpdateSellerStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { sellerId: string; status: string }) =>
      adminApi.updateSellerStatus(args.sellerId, { status: args.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.sellers() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      toast.success('Seller status updated successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update seller status');
    },
  });
}

export function useGetBuyerByIdMutation() {
  return useMutation({
    mutationFn: (buyerId: string) => adminApi.getBuyerById(buyerId),
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.buyers() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      toast.success('User deleted successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to delete user');
    },
  });
}

export function useDeleteCreatorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (creatorId: string) => adminApi.deleteCreator(creatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.creators() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      toast.success('Creator deleted successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to delete creator');
    },
  });
}

export function useUpdateBuyerStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { buyerId: string; status: string }) =>
      adminApi.updateBuyerStatus(args.buyerId, { status: args.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.buyers() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      toast.success('Buyer status updated successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update buyer status');
    },
  });
}

export function useUpdateWithdrawalRequestStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { requestId: string; action: 'approve' | 'deny' }) =>
      adminApi.updateWithdrawalRequestStatus(args.requestId, args.action === 'approve' ? 'approved' : 'rejected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.withdrawals() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      toast.success('Withdrawal request status updated');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update withdrawal request status');
    },
  });
}


