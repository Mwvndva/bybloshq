import { Dispatch, SetStateAction, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { registerNativePushNotifications } from '@/lib/mobileNotifications';
import { isNativeApp } from '@/lib/mobileApp';
import { getDashboardPath } from '../utils/authRouting';
import { markRoleSessionActive } from '../services/authSession';
import type { BuyerRegistrationData, GlobalUser, RegistrationData, SellerRegistrationData, UserRole } from '../types/authTypes';
import { useRegisterMutation } from '@/hooks/auth/useAuthMutations';

type AuthRequestError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

interface UseAuthRegistrationOptions {
  navigate: NavigateFunction;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  markAuthChecked: () => void;
}

export function useAuthRegistration({ navigate, setUser, setIsLoading, markAuthChecked }: UseAuthRegistrationOptions) {
  const buyerRegMut = useRegisterMutation('buyer');
  const sellerRegMut = useRegisterMutation('seller');

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

  return { register };
}
