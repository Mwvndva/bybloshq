import { useQuery, queryOptions } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { sellerApi } from '@/api/seller';
import adminApi from '@/api/admin';
import creatorApi from '@/api/creator';
import { buyerQueryKeys, sellerQueryKeys, adminQueryKeys, creatorQueryKeys } from '@/api/queryKeys';

export const buyerProfileQueryOptions = queryOptions({
  queryKey: buyerQueryKeys.profile(),
  queryFn: () => buyerApi.getProfile(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const sellerProfileQueryOptions = queryOptions({
  queryKey: sellerQueryKeys.profile(),
  queryFn: () => sellerApi.getProfile(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const adminProfileQueryOptions = queryOptions({
  queryKey: adminQueryKeys.profile(),
  queryFn: () => adminApi.getMe(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const creatorProfileQueryOptions = queryOptions({
  queryKey: creatorQueryKeys.profile(),
  queryFn: () => creatorApi.getProfile(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export function useBuyerProfileQuery(enabled = true) {
  return useQuery({
    ...buyerProfileQueryOptions,
    enabled,
  });
}

export function useSellerProfileQuery(enabled = true) {
  return useQuery({
    ...sellerProfileQueryOptions,
    enabled,
  });
}

export function useAdminProfileQuery(enabled = true) {
  return useQuery({
    ...adminProfileQueryOptions,
    enabled,
  });
}

export function useCreatorProfileQuery(enabled = true) {
  return useQuery({
    ...creatorProfileQueryOptions,
    enabled,
  });
}


