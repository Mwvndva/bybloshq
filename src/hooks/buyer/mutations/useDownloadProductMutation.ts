import { useMutation } from '@tanstack/react-query';
import buyerApi from '@/api/buyer';
import { toast } from 'sonner';

export interface DownloadProductArgs {
  orderId: string;
  productId: string;
  onProgress?: (percent: number) => void;
}

export function useDownloadProductMutation() {
  return useMutation({
    mutationFn: ({ orderId, productId, onProgress }: DownloadProductArgs) =>
      buyerApi.downloadDigitalProduct(orderId, productId, onProgress),
    onSuccess: () => {
      toast.success('Download started');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to download digital product');
    },
  });
}


