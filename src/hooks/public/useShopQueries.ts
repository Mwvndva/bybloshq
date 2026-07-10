import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';
import { publicApiService } from '@/api/public';
import { commonQueryKeys } from '@/api/queryKeys';

export function useSellerByShopNameQuery(shopName: string, enabled = true) {
  return useQuery({
    queryKey: commonQueryKeys.public.shop(shopName),
    queryFn: () => sellerApi.getSellerByShopName(shopName),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: enabled && !!shopName
  });
}

export function usePublicSellerProductsQuery(sellerId: string | number, enabled = true) {
  return useQuery({
    queryKey: commonQueryKeys.public.products(sellerId),
    queryFn: () => sellerApi.getSellerProducts(sellerId),
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    enabled: enabled && !!sellerId
  });
}

export function usePublicSellersQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: commonQueryKeys.public.sellers(params),
    queryFn: () => publicApiService.getSellersPage(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useKnockSellerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sellerId: string | number) => publicApiService.knockSeller(sellerId),
    onSuccess: (_data, sellerId) => {
      void queryClient.invalidateQueries({ queryKey: ['public-sellers'] });
    },
  });
}


