import { Dispatch, SetStateAction, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { clearAllAuthData } from '@/lib/authCleanup';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/lib/mobileNotifications';
import { isNativeApp } from '@/lib/mobileApp';
import { getDashboardPath, getLoginPath } from '../utils/authRouting';
import { clearRoleSessionMarkers, markRoleSessionActive } from '../services/authSession';
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
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useUpdateProfileMutation,
} from '@/hooks/auth/useAuthMutations';
import {
  buyerProfileQueryOptions,
  sellerProfileQueryOptions,
  adminProfileQueryOptions,
  creatorProfileQueryOptions,
} from '@/hooks/auth/useAuthQueries';

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

  const buyerRegMut = useRegisterMutation('buyer');
  const sellerRegMut = useRegisterMutation('seller');

  const buyerForgotMut = useForgotPasswordMutation('buyer');
  const sellerForgotMut = useForgotPasswordMutation('seller');
  const creatorForgotMut = useForgotPasswordMutation('creator');

  const buyerResetMut = useResetPasswordMutation('buyer');
  const sellerResetMut = useResetPasswordMutation('seller');
  const creatorResetMut = useResetPasswordMutation('creator');

  const buyerUpdateMut = useUpdateProfileMutation('buyer');
  const sellerUpdateMut = useUpdateProfileMutation('seller');
  const creatorUpdateMut = useUpdateProfileMutation('creator');

  const login = useCallback(async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      let response;
      if (role === 'buyer') {
        response = await buyerLoginMut.mutateAsync({ email, password });
      } else if (role === 'seller') {
        response = await sellerLoginMut.mutateAsync({ email, password });
      } else if (role === 'creator') {
        response = await creatorLoginMut.mutateAsync({ email, password });
      } else {
        throw new Error(`Unsupported login role: ${role}`);
      }

      const profileData = role === 'buyer' ? response.buyer : role === 'creator' ? response.creator : response.seller;

      setUser({
        role,
        profile: profileData as UserProfile,
        isAuthenticated: true
      });

      if (isNativeApp() && response.token) {
        const { storage } = await import('@/lib/storage');
        await storage.set(`${role}Token`, response.token);
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
  }, [markAuthChecked, navigate, setIsLoading, setUser, buyerLoginMut, sellerLoginMut, creatorLoginMut]);

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
      markAuthChecked();
      void registerNativePushNotifications(role);
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser, queryClient]);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await adminLoginMut.mutateAsync({ email, password });
      const success = response?.status === 'success' || !!response?.data?.token;

      if (success) {
        const adminProfile = await queryClient.fetchQuery(adminProfileQueryOptions);
        if (!adminProfile?.id) {
          throw new Error('Admin profile could not be verified after login');
        }
        setUser({
          role: 'admin',
          profile: adminProfile,
          isAuthenticated: true
        });

        if (isNativeApp() && response?.data?.token) {
          const { storage } = await import('@/lib/storage');
          await storage.set('adminToken', response.data.token);
        }
        await markRoleSessionActive('admin');
        markAuthChecked();
        void registerNativePushNotifications('admin');

        toast.success('Welcome Admin', {
          description: 'You have successfully logged in.',
          duration: 2000,
        });

        navigate('/admin/dashboard', { replace: true });
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || 'Invalid email or password. Please try again.';
      toast.error('Login Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser, adminLoginMut, queryClient]);

  const register = useCallback(async (data: RegistrationData, role: UserRole) => {
    setIsLoading(true);
    try {
      let response;
      if (role === 'buyer') {
        response = await buyerRegMut.mutateAsync(data as BuyerRegistrationData);
      } else if (role === 'seller') {
        response = await sellerRegMut.mutateAsync(data as SellerRegistrationData);
      } else {
        throw new Error(`Unsupported registration role: ${role}`);
      }

      if (response?.status === 'pending_verification') {
        toast.success('Verification link sent!', {
          description: response.message || 'Please check your email to verify your account.',
          duration: 8000,
        });
        return { status: 'pending_verification', message: response.message };
      }

      const profileData = role === 'buyer' ? response?.buyer : response?.seller;

      setUser({
        role,
        profile: profileData!,
        isAuthenticated: true
      });

      if (isNativeApp() && response?.token) {
        const { storage } = await import('@/lib/storage');
        await storage.set(`${role}Token`, response.token);
      }
      await markRoleSessionActive(role);
      markAuthChecked();
      void registerNativePushNotifications(role);

      toast.success('Account created!', {
        description: 'Your account has been successfully created.',
        duration: 3000,
      });
      navigate(getDashboardPath(role), { replace: true });
      return { status: 'success' };
    } catch (error) {
      const err = error as AuthRequestError;
      if (err.response?.status === 409) {
        toast.error('Account Already Exists', {
          description: 'This email is already registered. Please login or use Forgot Password.',
          duration: 6000,
        });
        throw error;
      }

      const message = err.response?.data?.message || err.message || 'Registration failed';
      toast.error('Registration Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser, buyerRegMut, sellerRegMut]);

  const logout = useCallback(async () => {
    await clearRoleSessionMarkers();

    if (!user) {
      try { await clearAllAuthData(); } catch { /* ignore */ }
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
        await clearAllAuthData();
      } catch (error) {
        // Fail silently, always clear user state.
      }
      setUser(null);
      toast('Logged out', { description: 'You have been successfully logged out.' });
      navigate('/', { replace: true });
    }
  }, [navigate, setUser, user]);

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

  const forgotPassword = useCallback(async (email: string, role: UserRole): Promise<boolean> => {
    try {
      if (role === 'buyer') {
        await buyerForgotMut.mutateAsync(email);
      } else if (role === 'seller') {
        await sellerForgotMut.mutateAsync(email);
      } else if (role === 'creator') {
        await creatorForgotMut.mutateAsync(email);
      } else {
        throw new Error(`ForgotPassword not supported for role: ${role}`);
      }

      toast.success('Check your email', {
        description: 'If an account exists with this email, you will receive a password reset link.',
        duration: 5000,
      });

      return true;
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || 'Failed to send reset email';
      toast.error('Request Failed', { description: message });
      return false;
    }
  }, [buyerForgotMut, sellerForgotMut, creatorForgotMut]);

  const resetPassword = useCallback(async (token: string, newPassword: string, email: string, role: UserRole) => {
    try {
      setIsLoading(true);
      if (role === 'buyer') {
        await buyerResetMut.mutateAsync({ token, newPassword, email });
      } else if (role === 'seller') {
        await sellerResetMut.mutateAsync({ token, newPassword, email });
      } else if (role === 'creator') {
        await creatorResetMut.mutateAsync({ token, newPassword, email });
      } else {
        throw new Error(`ResetPassword not supported for role: ${role}`);
      }

      toast.success('Password updated', {
        description: 'You can now log in with your new password.',
        duration: 3000,
      });

      navigate(getLoginPath(role), { replace: true });
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || 'Failed to reset password';
      toast.error('Reset Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setIsLoading, buyerResetMut, sellerResetMut, creatorResetMut]);

  const getProfile = useCallback(async (role: UserRole) => {
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

    if (!profileData) throw new Error('Failed to fetch profile');

    setUser({
      role,
      profile: profileData as UserProfile,
      isAuthenticated: true
    });
    void registerNativePushNotifications(role);
  }, [setUser, queryClient]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>, role: UserRole) => {
    try {
      const updatesRecord = updates as Record<string, unknown>;
      if (role === 'buyer') {
        await buyerUpdateMut.mutateAsync(updatesRecord);
      } else if (role === 'seller') {
        await sellerUpdateMut.mutateAsync(updatesRecord);
      } else if (role === 'creator') {
        await creatorUpdateMut.mutateAsync(updatesRecord);
      } else {
        throw new Error(`UpdateProfile not supported for role: ${role}`);
      }

      await getProfile(role);

      toast.success('Profile updated', {
        description: 'Your profile has been successfully updated.',
        duration: 2000,
      });
    } catch (error) {
      const err = error as AuthRequestError;
      const message = err.response?.data?.message || 'Failed to update profile';
      toast.error('Update Failed', { description: message });
      throw error;
    }
  }, [getProfile, buyerUpdateMut, sellerUpdateMut, creatorUpdateMut]);

  return {
    login,
    loginWithToken,
    loginAdmin,
    register,
    logout,
    refreshRole,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
  };
}


