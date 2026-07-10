import { useMutation, useQuery } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { buyerQueryKeys } from '@/api/queryKeys';

export function useInitiateProductMutation() {
  return useMutation({
    mutationFn: (args: { payload: Record<string, unknown>; idempotencyKey: string }) =>
      buyerApi.initiateProduct(args.payload, args.idempotencyKey),
  });
}

export function useValidateDiscountCodeMutation() {
  return useMutation({
    mutationFn: (args: { code: string; order_amount: number }) =>
      buyerApi.validateDiscountCode(args),
  });
}

export function usePaymentStatusQuery(reference: string, enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.orderStatus(reference),
    queryFn: () => buyerApi.getPaymentStatus(reference),
    staleTime: 5000,
    gcTime: 60000,
    enabled: enabled && !!reference,
    retry: 3,
  });
}

export function useAutoLoginMutation() {
  return useMutation({
    mutationFn: (autoLoginToken: string) => buyerApi.autoLogin(autoLoginToken),
  });
}

export function useLogisticsQuoteMutation() {
  return useMutation({
    mutationFn: (args: { payload: { legType: string; location: { address: string; latitude: number; longitude: number } }; signal?: AbortSignal }) =>
      buyerApi.getLogisticsQuote(args.payload, args.signal),
  });
}


