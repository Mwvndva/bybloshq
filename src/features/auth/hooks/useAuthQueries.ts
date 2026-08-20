import { useQuery, queryOptions } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { sellerApi } from '@/features/seller/api';
import adminApi from '@/features/admin/api';
import creatorApi from '@/features/creator/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';
import { sellerQueryKeys } from '@/features/seller/api/queryKeys';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import { creatorQueryKeys } from '@/features/creator/api/queryKeys';

import apiClient from '@/infrastructure/http/apiClient';

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

export const logisticsProfileQueryOptions = queryOptions({
  queryKey: ['logistics', 'profile'],
  queryFn: async () => {
    const res = await apiClient.get('/logistics/me');
    return res.data?.data?.partner;
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const marketingProfileQueryOptions = queryOptions({
  queryKey: ['marketing', 'profile'],
  queryFn: async () => {
    const res = await apiClient.get('/admin/me');
    return res.data?.data?.user;
  },
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


