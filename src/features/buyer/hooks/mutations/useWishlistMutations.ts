import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export function useAddWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => buyerApi.addToWishlist({ id: productId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: buyerQueryKeys.wishlist() });
    },
  });
}

export function useRemoveWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => buyerApi.removeFromWishlist(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: buyerQueryKeys.wishlist() });
    },
  });
}


