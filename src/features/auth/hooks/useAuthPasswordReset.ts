import { Dispatch, SetStateAction, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { getLoginPath } from '../utils/authRouting';
import type { UserRole } from '../types/authTypes';
import { useForgotPasswordMutation, useResetPasswordMutation } from '@/hooks/auth/useAuthMutations';

type AuthRequestError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

interface UseAuthPasswordResetOptions {
  navigate: NavigateFunction;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export function useAuthPasswordReset({ navigate, setIsLoading }: UseAuthPasswordResetOptions) {
  const buyerForgotMut = useForgotPasswordMutation('buyer');
  const sellerForgotMut = useForgotPasswordMutation('seller');
  const creatorForgotMut = useForgotPasswordMutation('creator');
  const buyerResetMut = useResetPasswordMutation('buyer');
  const sellerResetMut = useResetPasswordMutation('seller');
  const creatorResetMut = useResetPasswordMutation('creator');

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

  return { forgotPassword, resetPassword };
}
