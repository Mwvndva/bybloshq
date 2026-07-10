import { useMutation } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';

export function useSellerVerifyEmailMutation() {
  return useMutation({
    mutationFn: (args: { email: string; token: string }) =>
      sellerApi.verifyEmail(args.email, args.token),
  });
}

export function useSellerResendVerificationMutation() {
  return useMutation({
    mutationFn: (email: string) => sellerApi.resendVerification(email),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (args: { token: string; password: string; email: string }) =>
      sellerApi.resetPassword(args.token, args.password, args.email),
  });
}


