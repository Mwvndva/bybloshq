import { Dispatch, SetStateAction, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import adminApi from '@/api/adminApi';
import apiClient from '@/lib/apiClient';
import { clearAllAuthData } from '@/lib/authCleanup';
import { registerNativePushNotifications, unregisterNativePushNotifications } from '@/lib/mobileNotifications';
import { isNativeApp } from '@/lib/mobileApp';
import { getApiForRole } from './authApi';
import { getDashboardPath, getLoginPath } from './authRouting';
import { clearRoleSessionMarkers, markRoleSessionActive } from './authSession';
import type {
  BuyerRegistrationData,
  GlobalUser,
  RegistrationData,
  SellerRegistrationData,
  UserProfile,
  UserRole,
} from './authTypes';

interface UseAuthActionsOptions {
  navigate: NavigateFunction;
  user: GlobalUser | null;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  markAuthChecked: () => void;
}

export function useAuthActions({
  navigate,
  user,
  setUser,
  setIsLoading,
  markAuthChecked,
}: UseAuthActionsOptions) {
  const login = useCallback(async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const api = getApiForRole(role);
      const response = await api.login({ email, password });
      const profileData = role === 'buyer' ? response.buyer : role === 'creator' ? response.creator : response.seller;

      setUser({
        role,
        profile: profileData,
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
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error('Login Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser]);

  const loginWithToken = useCallback(async (token: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const api = getApiForRole(role);
      const profileData = await api.getProfile();

      setUser({
        role,
        profile: profileData,
        isAuthenticated: true
      });

      await markRoleSessionActive(role);
      markAuthChecked();
      void registerNativePushNotifications(role);
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser]);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await adminApi.login({ email, password });
      const success = response?.status === 'success' || !!response?.data?.token;

      if (success) {
        const adminProfile = await adminApi.getMe();
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
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid email or password. Please try again.';
      toast.error('Login Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser]);

  const register = useCallback(async (data: RegistrationData, role: UserRole) => {
    setIsLoading(true);
    try {
      const api = getApiForRole(role);
      let response;

      if (role === 'buyer') {
        response = await api.register(data as BuyerRegistrationData);
      } else if (role === 'seller') {
        response = await api.register(data as SellerRegistrationData);
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
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Account Already Exists', {
          description: 'This email is already registered. Please login or use Forgot Password.',
          duration: 6000,
        });
        throw error;
      }

      const message = error.response?.data?.message || error.message || 'Registration failed';
      toast.error('Registration Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, navigate, setIsLoading, setUser]);

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
      const api = getApiForRole(newRole);
      const profileData = newRole === 'admin'
        ? await adminApi.getMe()
        : await api.getProfile();

      if (!profileData) throw new Error('Failed to fetch admin profile');

      setUser({
        role: newRole,
        profile: profileData,
        isAuthenticated: true
      });

      await markRoleSessionActive(newRole);
      markAuthChecked();
      void registerNativePushNotifications(newRole);

      toast.success('Role Switched', {
        description: `Switched to ${newRole} dashboard`,
        duration: 2000,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to switch role';
      toast.error('Role Switch Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [markAuthChecked, setIsLoading, setUser]);

  const forgotPassword = useCallback(async (email: string, role: UserRole): Promise<boolean> => {
    try {
      const api = getApiForRole(role);
      await api.forgotPassword(email);

      toast.success('Check your email', {
        description: 'If an account exists with this email, you will receive a password reset link.',
        duration: 5000,
      });

      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send reset email';
      toast.error('Request Failed', { description: message });
      return false;
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string, email: string, role: UserRole) => {
    try {
      setIsLoading(true);
      const api = getApiForRole(role);
      await api.resetPassword(token, newPassword, email);

      toast.success('Password updated', {
        description: 'You can now log in with your new password.',
        duration: 3000,
      });

      navigate(getLoginPath(role), { replace: true });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reset password';
      toast.error('Reset Failed', { description: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setIsLoading]);

  const getProfile = useCallback(async (role: UserRole) => {
    try {
      const api = getApiForRole(role);
      const profileData = role === 'admin'
        ? await adminApi.getMe()
        : await api.getProfile();

      if (!profileData) throw new Error('Failed to fetch admin profile');

      setUser({
        role,
        profile: profileData,
        isAuthenticated: true
      });
      void registerNativePushNotifications(role);
    } catch (error: any) {
      throw error;
    }
  }, [setUser]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>, role: UserRole) => {
    try {
      const api = getApiForRole(role);

      if (api.updateProfile) {
        await api.updateProfile(updates);
      }

      await getProfile(role);

      toast.success('Profile updated', {
        description: 'Your profile has been successfully updated.',
        duration: 2000,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error('Update Failed', { description: message });
      throw error;
    }
  }, [getProfile]);

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
