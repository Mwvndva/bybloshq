import { Dispatch, SetStateAction, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { registerNativePushNotifications } from '@/lib/mobileNotifications';
import type { GlobalUser, UserProfile, UserRole } from '../types/authTypes';
import { useUpdateProfileMutation } from '@/hooks/auth/useAuthMutations';
import { buyerProfileQueryOptions, sellerProfileQueryOptions, adminProfileQueryOptions, creatorProfileQueryOptions } from '@/hooks/auth/useAuthQueries';

type AuthRequestError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

interface UseAuthProfileOptions {
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
}

export function useAuthProfile({ setUser }: UseAuthProfileOptions) {
  const queryClient = useQueryClient();
  const buyerUpdateMut = useUpdateProfileMutation('buyer');
  const sellerUpdateMut = useUpdateProfileMutation('seller');
  const creatorUpdateMut = useUpdateProfileMutation('creator');

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

  return { getProfile, updateProfile };
}
