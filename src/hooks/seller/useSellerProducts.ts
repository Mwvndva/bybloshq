import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/seller';
import { sellerQueryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';
import type { ApiSellerProduct } from '@/types';

// Products Queries
import { useQuery } from '@tanstack/react-query';

export function useSellerProductsQuery() {
  return useQuery({
    queryKey: sellerQueryKeys.products(),
    queryFn: sellerApi.getProducts,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export const sellerProductQuery = (id: string) => ({
  queryKey: sellerQueryKeys.product(id),
  queryFn: () => sellerApi.getProduct(id),
  staleTime: 60_000,
});

export function useSellerProductQuery(id: string, enabled = true) {
  return useQuery({
    ...sellerProductQuery(id),
    enabled: enabled && !!id
  });
}

// Product Mutations
export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Omit<ApiSellerProduct, 'id' | 'createdAt' | 'updatedAt' | 'sellerId' | 'seller'> & { digital_file?: File }) =>
      sellerApi.createProduct(product as unknown as Parameters<typeof sellerApi.createProduct>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Product created successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to create product');
    }
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; updates: Partial<ApiSellerProduct> }) =>
      sellerApi.updateProduct(args.id, args.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Product updated successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update product');
    }
  });
}

export function useUpdateInventoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; stockCount: number }) =>
      sellerApi.updateInventory(args.id, { stockCount: args.stockCount } as unknown as Parameters<typeof sellerApi.updateInventory>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Inventory updated successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to update inventory');
    }
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sellerApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Product deleted successfully');
    },
    onError: (error) => {
      const err = error as Error;
      toast.error(err.message || 'Failed to delete product');
    }
  });
}

export function useUploadDigitalProductMutation() {
  return useMutation({
    mutationFn: (args: { file: File; onProgress?: (progress: number) => void }) =>
      sellerApi.uploadDigitalProduct(args.file, args.onProgress),
  });
}


