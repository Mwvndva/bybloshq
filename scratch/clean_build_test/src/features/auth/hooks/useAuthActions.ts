import { Dispatch, SetStateAction, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/http/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { clearRoleSessionMarkers, enforceSingleActiveRole, markRoleSessionActive, setActiveRole } from '../services/authSession';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/features/notifications/utils/mobileNotifications';
import { getDashboardPath } from '../utils/authRouting';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { storage } from '@/infrastructure/storage/storage';





import { switchAccountRequest, type SwitchableRole } from '@/features/auth/api/account';
import type {
  BuyerRegistrationData,
  GlobalUser,
  RegistrationData,
  SellerRegistrationData,
  UserProfile,
  UserRole,
} from '../types/authTypes';
import {
  useBuyerLoginMutation,
  useSellerLoginMutation,
  useAdminLoginMutation,
  useCreatorLoginMutation,
  useLogisticsLoginMutation,
  useMarketingLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useUpdateProfileMutation,
} from './useAuthMutations';
import {
  buyerProfileQueryOptions,
  sellerProfileQueryOptions,
  adminProfileQueryOptions,
  creatorProfileQueryOptions,
} from './useAuthQueries';
import { useAuthRegistration } from './useAuthRegistration';
import { useAuthPasswordReset } from './useAuthPasswordReset';
import { useAuthProfile } from './useAuthProfile';

interface UseAuthActionsOptions {
  navigate: NavigateFunction;
  user: GlobalUser | null;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  markAuthChecked: () => void;
}

type AuthRequestError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

export function useAuthActions({
  navigate,
  user,
  setUser,
  setIsLoading,
  markAuthChecked,
}: UseAuthActionsOptions) {
  const queryClient = useQueryClient();

  const buyerLoginMut = useBuyerLoginMutation();
  const sellerLoginMut = useSellerLoginMutation();
  const adminLoginMut = useAdminLoginMutation();
  const creatorLoginMut = useCreatorLoginMutation();
  const logisticsLoginMut = useLogisticsLoginMutation();
  const marketingLoginMut = useMarketingLoginMutation();

  const { register } = useAuthRegistration({ navigate, setUser, setIsLoading, markAuthChecked });
  const { forgotPassword, resetPassword } = useAuthPasswordReset({ navigate, setIsLoading });
  const { getProfile, updateProfile } = useAuthProfile({ setUser });

  const login = useCallback(async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      let response: any;
      if (role === 'buyer') {
        response = await buyerLoginMut.mutateAsync({ email, password });
      } else if (role === 'seller') {
        response = await sellerLoginMut.mutateAsync({ email, password });
      } else if (role === 'creator') {
        response = await creatorLoginMut.mutateAsync({ email, password });
      } else if (role === 'admin') {
        response = await adminLoginMut.mutateAsync({ email, password });
      } else if (role === 'logistics') {
        response = await logisticsLoginMut.mutateAsync({ email, password });
      } else if (role === 'marketing') {
        response = await marketingLoginMut.mutateAsync({ email, password });
      } else {
        throw new Error(`Unsupported login role: ${role}`);
      }

      const profileData = role === 'buyer' ? response.buyer
        : role === 'creator' ? response.creator
        : role === 'seller' ? response.seller
        : role === 'logistics' ? response.partner
        : response.user || response.data?.user;

      // Single active account: drop any other account's cached data and evict its
      // stored credentials/session before establishing this one, so the app can
      // never bind to a leftover session from a different user.
      queryClient.clear();
      await enforceSingleActiveRole(role);

      setUser({
        role,
        profile: profileData as UserProfile,
        isAuthenticated: true
      });

      if (response.token) {
        await storage.set(`${role}Token`, response.token);
        const refreshToken = (response as { refreshToken?: string }).refreshToken;
        if (refreshToken) await storage.set(`${role}RefreshToken`, refreshToken);
      }
      await markRoleSessionActive(role);
      markAuthChecked();
      void registerNativePushNotifications(role);

      toast.success('Login successful', {
        id: `${role}-login-success`,
        description: 'Welcome back to Byblos.',
        duration: 2000,
      });

      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && typeof redirectPath === 'string') {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath, { replace: true });
      } else {
        const dashboardPath = getDashboardPath(role);
        if (typeof dashboardPath === 'string') {
          navigate(dashboardPath, { replace: true });
        } else {
          console.error('[Auth] Invalid dashboard path:', dashboardPath);
          navigate('/', { replace: true });
        }
      }
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || err.message || 'Login failed';
      toast.error('Login Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser, buyerLoginMut, sellerLoginMut, creatorLoginMut, adminLoginMut, logisticsLoginMut, marketingLoginMut, queryClient]);

  const loginWithToken = useCallback(async (token: string, role: UserRole) => {
    setIsLoading(true);
    try {
      let queryOpts;
      if (role === 'buyer') {
        queryOpts = buyerProfileQueryOptions;
      } else if (role === 'seller') {
        queryOpts = sellerProfileQueryOptions;
      } else if (role === 'creator') {
        queryOpts = creatorProfileQueryOptions;
      } else {
        queryOpts = adminProfileQueryOptions;
      }

      const profileData = await queryClient.fetchQuery(queryOpts);

      setUser({
        role,
        profile: profileData as UserProfile,
        isAuthenticated: true
      });

      await markRoleSessionActive(role);
      await setActiveRole(role);
      markAuthChecked();
      void registerNativePushNotifications(role);
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser, queryClient]);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    return login(email, password, 'admin');
  }, [login]);

  const logout = useCallback(async () => {
    await clearRoleSessionMarkers();
    queryClient.clear();

    if (!user) {
      try { await clearRoleSessionMarkers(); } catch { /* ignore */ }
      return;
    }

    const role = user.role;

    try {
      await unregisterNativePushNotifications(role);
      const logoutUrl = role === 'seller'
        ? '/sellers/logout'
        : role === 'admin'
          ? '/admin/logout'
          : '/buyers/logout';
      await apiClient.post(logoutUrl);
    } catch (error) {
      // Fail silently
    } finally {
      try {
        await clearRoleSessionMarkers();
      } catch (error) {
        // Fail silently, always clear user state.
      }

      setUser(null);
      toast('Logged out', { description: 'You have been successfully logged out.' });
      navigate('/', { replace: true });
    }
  }, [navigate, setUser, user, queryClient]);

  const switchAccount = useCallback(async (role: SwitchableRole) => {
    setIsLoading(true);
    try {
      const { token, refreshToken } = await switchAccountRequest(role);

      // Establish the target role as the single active account: drop the prior
      // account's cache + credentials, then persist the freshly-minted token.
      queryClient.clear();
      await enforceSingleActiveRole(role);
      if (isNativeApp() && token) {
        await storage.set(`${role}Token`, token);
        if (refreshToken) await storage.set(`${role}RefreshToken`, refreshToken);
      }

      let queryOpts;
      if (role === 'buyer') queryOpts = buyerProfileQueryOptions;
      else if (role === 'seller') queryOpts = sellerProfileQueryOptions;
      else queryOpts = creatorProfileQueryOptions;

      const profileData = await queryClient.fetchQuery(queryOpts);

      setUser({
        role,
        profile: profileData as UserProfile,
        isAuthenticated: true,
      });

      await markRoleSessionActive(role);
      await setActiveRole(role);
      markAuthChecked();
      void registerNativePushNotifications(role);

      const dashboardPath = getDashboardPath(role);
      navigate(typeof dashboardPath === 'string' ? dashboardPath : '/', { replace: true });

      toast.success('Account switched', {
        description: `You are now using your ${role} account.`,
        duration: 2000,
      });
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || err.message || 'Could not switch account';
      toast.error('Switch failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser, queryClient]);

  const refreshRole = useCallback(async (newRole: UserRole) => {
    setIsLoading(true);
    try {
      let queryOpts;
      if (newRole === 'buyer') {
        queryOpts = buyerProfileQueryOptions;
      } else if (newRole === 'seller') {
        queryOpts = sellerProfileQueryOptions;
      } else if (newRole === 'creator') {
        queryOpts = creatorProfileQueryOptions;
      } else {
        queryOpts = adminProfileQueryOptions;
      }

      const profileData = await queryClient.fetchQuery(queryOpts);

      if (!profileData) throw new Error('Failed to fetch profile');

      setUser({
        role: newRole,
        profile: profileData as UserProfile,
        isAuthenticated: true
      });

      await markRoleSessionActive(newRole);
      await setActiveRole(newRole);
      markAuthChecked();
      void registerNativePushNotifications(newRole);

      toast.success('Role Switched', {
        description: `Switched to ${newRole} dashboard`,
        duration: 2000,
      });
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || 'Failed to switch role';
      toast.error('Role Switch Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser, queryClient]);

  return {
    login,
    loginWithToken,
    loginAdmin,
    register,
    logout,
    switchAccount,
    refreshRole,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
  };
}


