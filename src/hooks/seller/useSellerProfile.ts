import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';
import { sellerQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

// Profile Query
export function useSellerProfileQuery(enabled = true) {
  return useQuery({
    queryKey: ['seller-profile'],
    queryFn: sellerApi.getProfile,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled,
  });
}

// Analytics Query
export function useSellerAnalyticsQuery(enabled = true) {
  return useQuery({
    queryKey: sellerQueryKeys.analytics(),
    queryFn: sellerApi.getAnalytics,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled,
  });
}

// Profile Mutations
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => sellerApi.updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.summary() });
    },
  });
}

export function useUpdateThemeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: string) => sellerApi.updateTheme(theme as import('@/api/seller').Theme),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
    },
  });
}

export function useUploadBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (base64Image: string) => sellerApi.uploadBanner(base64Image),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
    },
  });
}

export function useUploadBusinessPhotoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (base64Image: string) => sellerApi.uploadBusinessPhoto(base64Image),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.summary() });
    },
  });
}

// Referral & Invites
export function useSellerReferralDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: ['seller-referrals'],
    queryFn: sellerApi.getReferralDashboard,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled,
  });
}

export function useGenerateReferralCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sellerApi.generateReferralCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-referrals'] });
    },
  });
}

export function useInviteCreatorMutation() {
  return useMutation({
    mutationFn: (email: string) => sellerApi.inviteCreator(email),
  });
}

export function useGetCreatorInvitesQuery(enabled = true) {
  return useQuery({
    queryKey: ['seller-creator-invites'],
    queryFn: sellerApi.getCreatorInvites,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled,
  });
}


