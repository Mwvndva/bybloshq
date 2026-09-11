import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';

// Every mutation below calls a `src/features/admin/api/*` function that
// returns the raw axios promise uncaught (no try/catch, or a catch that just
// re-throws unchanged) — so `error` here is always the raw axios error, and
// `(error as Error).message` was always axios's own generic "Request failed
// with status code 400", never the backend's real validation reason.
// classifyApiError reads the actual response body instead. Same fix as
// checkout's useBagCheckout.ts (fd1c686e).

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
      toast.error(classifyApiError(error, 'Failed to update seller status').message);
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
      toast.error(classifyApiError(error, 'Failed to delete user').message);
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
      toast.error(classifyApiError(error, 'Failed to delete creator').message);
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
      toast.error(classifyApiError(error, 'Failed to update buyer status').message);
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
      toast.error(classifyApiError(error, 'Failed to update withdrawal request status').message);
    },
  });
}


