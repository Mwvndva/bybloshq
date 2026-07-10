import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { sellerApi } from '@/api/seller';
import adminApi from '@/api/admin';
import creatorApi from '@/api/creator';
import { getApiForRole } from '@/features/auth/api/authApi';
import type { UserRole, BuyerRegistrationData, SellerRegistrationData } from '@/features/auth/types/authTypes';
import { buyerQueryKeys, sellerQueryKeys, adminQueryKeys, creatorQueryKeys } from '@/api/queryKeys';

type AuthApiObject = {
  register?: (data: unknown) => Promise<unknown>;
  forgotPassword?: (email: string) => Promise<unknown>;
  resetPassword?: (token: string, password: string, email: string) => Promise<unknown>;
  updateProfile?: (updates: Record<string, unknown>) => Promise<unknown>;
};

export function useBuyerLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      buyerApi.login(credentials),
  });
}

export function useSellerLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      sellerApi.login(credentials),
  });
}

export function useAdminLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email?: string; password?: string; pin?: string }) =>
      adminApi.login(credentials),
  });
}

export function useCreatorLoginMutation() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      creatorApi.login(credentials),
  });
}

export function useRegisterMutation(role: UserRole) {
  return useMutation({
    mutationFn: (data: unknown) => {
      const api = getApiForRole(role) as AuthApiObject;
      if (role === 'buyer' && api.register) {
        return api.register(data as BuyerRegistrationData);
      } else if (api.register) {
        return api.register(data as SellerRegistrationData);
      }
      throw new Error(`Register method not implemented for role: ${role}`);
    },
  });
}

export function useForgotPasswordMutation(role: UserRole) {
  return useMutation({
    mutationFn: (email: string) => {
      const api = getApiForRole(role) as AuthApiObject;
      if (api.forgotPassword) {
        return api.forgotPassword(email);
      }
      throw new Error(`ForgotPassword method not implemented for role: ${role}`);
    },
  });
}

export function useResetPasswordMutation(role: UserRole) {
  return useMutation({
    mutationFn: (args: { token: string; newPassword?: string; password?: string; email: string }) => {
      const api = getApiForRole(role) as AuthApiObject;
      if (api.resetPassword) {
        // seller/creator/buyer resetting signatures might be slightly different in arguments
        if (role === 'seller') {
          return api.resetPassword(args.token, args.password || args.newPassword || '', args.email);
        }
        return api.resetPassword(args.token, args.newPassword || args.password || '', args.email);
      }
      throw new Error(`ResetPassword method not implemented for role: ${role}`);
    },
  });
}

export function useUpdateProfileMutation(role: UserRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => {
      const api = getApiForRole(role) as AuthApiObject;
      if (api.updateProfile) {
        return api.updateProfile(updates);
      }
      throw new Error(`UpdateProfile method not implemented for role: ${role}`);
    },
    onSuccess: () => {
      if (role === 'buyer') {
        queryClient.invalidateQueries({ queryKey: buyerQueryKeys.profile() });
      } else if (role === 'seller') {
        queryClient.invalidateQueries({ queryKey: sellerQueryKeys.profile() });
        queryClient.invalidateQueries({ queryKey: sellerQueryKeys.dashboard() });
        queryClient.invalidateQueries({ queryKey: sellerQueryKeys.summary() });
      } else if (role === 'creator') {
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.profile() });
      } else if (role === 'admin') {
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.profile() });
      }
    },
  });
}


