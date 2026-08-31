import { useQuery, useMutation } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export function useOrderStatusQuery(orderNumber: string, enabled = true) {
  return useQuery({
    queryKey: buyerQueryKeys.orderStatus(orderNumber),
    queryFn: () => buyerApi.getOrderStatus(orderNumber),
    staleTime: 5 * 1000,
    gcTime: 60 * 1000,
    enabled: enabled && !!orderNumber,
  });
}

export function useGetOrderStatusMutation() {
  return useMutation({
    mutationFn: ({ orderNumber, clientCheckoutToken }: { orderNumber: string; clientCheckoutToken?: string | null }) =>
      buyerApi.getOrderStatus(orderNumber, clientCheckoutToken),
  });
}


