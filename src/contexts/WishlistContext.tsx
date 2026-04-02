import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Aesthetic, Seller } from '@/types';
import { useBuyerAuth } from './GlobalAuthContext';
import buyerApi, { WishlistItem } from '@/api/buyerApi';
import { publicApiService } from '@/api/publicApi';
import { useToast } from '@/components/ui/use-toast';

interface WishlistContextType {
  wishlist: Product[];
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  isLoading: boolean;
  error: Error | null;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  // Always call hooks unconditionally at the top level
  const { user } = useBuyerAuth();
  const { toast } = useToast();

  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // mapWishlistItemToProduct doesn't need to be async — remove async keyword
  const mapWishlistItemToProduct = (item: WishlistItem): Product => {
    const seller: Seller = {
      id: item.sellerId,
      fullName: (item as any).sellerName || 'Unknown Shop',
      email: '',
      phone: '',
      whatsappNumber: '',
      bannerUrl: '',
      shopName: (item as any).sellerName || 'Unknown Shop',
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
      images: item.images,
    };
  };

  const loadWishlist = useCallback(async () => {
    if (!user) {
      setWishlist([]);
      return;
    }
    setIsLoading(true);
    try {
      const serverWishlist = await buyerApi.getWishlist();
      const products = Array.isArray(serverWishlist)
        ? serverWishlist.map(mapWishlistItemToProduct)
        : [];
      setWishlist(products);
    } catch {
      setWishlist([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWishlist();
    } else {
      setWishlist([]);
    }
  }, [user, loadWishlist]);

  const contextValue: WishlistContextType = useMemo(() => ({
    wishlist,
    addToWishlist: async (product: Product) => {
      if (!user) throw new Error('User must be logged in');
      if (!product?.id) throw new Error('Invalid product data');
      try {
        setError(null);
        await buyerApi.addToWishlist({ id: product.id });
        await loadWishlist();
        toast({ title: 'Added to wishlist', description: `${product.name} has been added to your wishlist.` });
      } catch (error: any) {
        if (error.code === 'DUPLICATE_WISHLIST_ITEM' || error.response?.status === 409) {
          toast({ title: 'Already in wishlist', description: 'This item is already in your wishlist.', variant: 'default' });
        } else {
          toast({ title: 'Failed to add to wishlist', description: 'There was an error adding this item.', variant: 'destructive' });
        }
        throw error;
      }
    },
    removeFromWishlist: async (productId: string) => {
      if (!user) throw new Error('User must be logged in');
      try {
        setError(null);
        await buyerApi.removeFromWishlist(productId);
        await loadWishlist();
        toast({ title: 'Removed from wishlist', description: 'The item has been removed from your wishlist.' });
      } catch (error: any) {
        toast({ title: 'Failed to remove', description: 'There was an error removing this item.', variant: 'destructive' });
        throw error;
      }
    },
    isInWishlist: (productId: string) => wishlist.some(item => String(item.id) === String(productId)),
    refreshWishlist: loadWishlist,
    isLoading,
    error,
  }), [wishlist, user, error, isLoading, loadWishlist, toast]);

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    return {
      wishlist: [],
      addToWishlist: async () => { },
      removeFromWishlist: async () => { },
      isInWishlist: () => false,
      isLoading: false,
      error: null,
      refreshWishlist: async () => { },
    };
  }
  return context;
}
