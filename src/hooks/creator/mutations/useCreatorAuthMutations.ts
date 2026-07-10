import { useMutation } from '@tanstack/react-query';
import creatorApi from '@/api/creator';

export function useCreatorVerifyEmailMutation() {
  return useMutation({
    mutationFn: (args: { token: string; email: string }) =>
      creatorApi.verifyEmail(args.token, args.email),
  });
}

export function useCreatorResendVerificationMutation() {
  return useMutation({
    mutationFn: (email: string) => creatorApi.resendVerification(email),
  });
}

export function useCreatorRegisterMutation() {
  return useMutation({
    mutationFn: (args: { token: string; fullName: string; email: string; phone: string; whatsappNumber: string; mpesaNumber: string; city: string; location: string; bio: string; password?: string; confirmPassword?: string; referralCode?: string }) =>
      creatorApi.register(args),
  });
}

export function useCreatorLogoutMutation() {
  return useMutation({
    mutationFn: () => creatorApi.logout(),
  });
}


