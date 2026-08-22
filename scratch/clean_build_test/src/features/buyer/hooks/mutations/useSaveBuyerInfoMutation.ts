import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export interface BuyerInfoData {
  fullName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  password?: string;
}

export function useSaveBuyerInfoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (buyerInfo: BuyerInfoData) => buyerApi.saveBuyerInfo(buyerInfo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buyerQueryKeys.profile() });
    },
  });
}


