import { useMutation } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';

export function useBuyerVerifyEmailMutation() {
  return useMutation({
    mutationFn: (args: { email: string; token: string }) =>
      buyerApi.verifyEmail(args.email, args.token),
  });
}

export function useBuyerResendVerificationMutation() {
  return useMutation({
    mutationFn: (email: string) => buyerApi.resendVerification(email),
  });
}

export function useCheckBuyerByPhoneMutation() {
  return useMutation({
    mutationFn: (phone: string) => buyerApi.checkBuyerByPhone(phone),
  });
}


