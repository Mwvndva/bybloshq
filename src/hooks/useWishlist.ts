import { useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBuyerAuth } from '@/features/auth/contexts';
import { useBuyerWishlistQuery } from '@/hooks/buyer/queries/useBuyerWishlistQuery';
import { useAddWishlistMutation, useRemoveWishlistMutation } from '@/hooks/buyer/mutations/useWishlistMutations';
import { useWishlistStore } from '@/stores/wishlistStore';
import { buyerQueryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/use-toast';
import type { Product, Seller, Aesthetic } from '@/types';
import type { WishlistItem } from '@/api/buyer';


export function useWishlist() {
  const { user } = useBuyerAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: serverWishlist = [], isLoading, error } = useBuyerWishlistQuery(!!user);

  // Pull individual stable action references to satisfy exhaustive-deps
  const setWishlistIds = useWishlistStore((s) => s.setWishlistIds);
  const addWishlistId = useWishlistStore((s) => s.addWishlistId);
  const removeWishlistId = useWishlistStore((s) => s.removeWishlistId);
  const addOptimisticAddition = useWishlistStore((s) => s.addOptimisticAddition);
  const removeOptimisticAddition = useWishlistStore((s) => s.removeOptimisticAddition);
  const addOptimisticRemoval = useWishlistStore((s) => s.addOptimisticRemoval);
  const clearOptimistic = useWishlistStore((s) => s.clearOptimistic);
  const isInWishlistSelector = useWishlistStore((s) => s.isInWishlist);

  const addMutation = useAddWishlistMutation();
  const removeMutation = useRemoveWishlistMutation();

  const mapWishlistItemToProduct = useCallback((item: WishlistItem): Product => {
    const seller: Seller = {
      id: item.sellerId,
      fullName: (item as unknown as Record<string, unknown>).sellerName as string || 'Unknown Shop',
      email: '',
      phone: '',
      whatsappNumber: '',
      bannerUrl: '',
      shopName: (item as unknown as Record<string, unknown>).sellerName as string || 'Unknown Shop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      id: String(item.id),
      name: item.name,
      description: item.description,
      price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      image_url: item.image_url,
      sellerId: item.sellerId,
      seller,
      isSold: item.isSold,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      aesthetic: item.aesthetic as Aesthetic,
      product_type: item.product_type,
      is_digital: item.is_digital,
      service_options: item.service_options,
      service_locations: item.service_locations,
      images: item.images || (item as unknown as Record<string, unknown>).image_urls as string[] || (item as unknown as Record<string, unknown>).imageUrls as string[],
    };
  }, []);

  const wishlist = useMemo(() => {
    if (!user) return [];
    return serverWishlist.map(mapWishlistItemToProduct);
  }, [serverWishlist, user, mapWishlistItemToProduct]);

  useEffect(() => {
    if (user && serverWishlist) {
      setWishlistIds(serverWishlist.map(item => String(item.id)));
    } else if (!user) {
      setWishlistIds([]);
    }
  }, [serverWishlist, user, setWishlistIds]);

  const addToWishlist = useCallback(async (product: Product) => {
    if (!user) throw new Error('User must be logged in');
    if (!product?.id) throw new Error('Invalid product data');

    // Optimistic update
    addOptimisticAddition(product.id);
    addWishlistId(product.id);

    try {
      await addMutation.mutateAsync(product.id);
      toast({ title: 'Added to wishlist', description: `${product.name} has been added to your wishlist.` });
    } catch (err) {
      const error = err as { code?: string; response?: { status?: number }; message?: string };
      // Rollback
      removeWishlistId(product.id);
      removeOptimisticAddition(product.id);
      if (error.code === 'DUPLICATE_WISHLIST_ITEM' || error.response?.status === 409) {
        toast({ title: 'Already in wishlist', description: 'This item is already in your wishlist.', variant: 'default' });
      } else {
        toast({ title: 'Failed to add to wishlist', description: 'There was an error adding this item.', variant: 'destructive' });
      }
      throw err;
    } finally {
      clearOptimistic();
    }
  }, [user, addOptimisticAddition, addWishlistId, removeWishlistId, removeOptimisticAddition, clearOptimistic, addMutation, toast]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user) throw new Error('User must be logged in');

    // Optimistic update
    addOptimisticRemoval(productId);
    removeWishlistId(productId);

    try {
      await removeMutation.mutateAsync(productId);
      toast({ title: 'Removed from wishlist', description: 'The item has been removed from your wishlist.' });
    } catch (err) {
      // Rollback
      addWishlistId(productId);
      toast({ title: 'Failed to remove', description: 'There was an error removing this item.', variant: 'destructive' });
      throw err;
    } finally {
      clearOptimistic();
    }
  }, [user, addOptimisticRemoval, removeWishlistId, addWishlistId, clearOptimistic, removeMutation, toast]);

  const isInWishlist = useCallback((productId: string) => isInWishlistSelector(productId), [isInWishlistSelector]);

  const refreshWishlist = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: buyerQueryKeys.wishlist() });
  }, [queryClient]);


  return {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist,
    isLoading,
    error: error as Error | null,
  };
}


