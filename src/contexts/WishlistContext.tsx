import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Product, Aesthetic, Seller } from '@/types';
import { useBuyerAuth } from './BuyerAuthContext';
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
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Safely use the buyer auth context
  let user = null;
  let buyerAuthAvailable = true;

  try {
    const buyerAuth = useBuyerAuth?.();
    user = buyerAuth?.user || null;
  } catch (error) {
    // If useBuyerAuth throws an error, it means we're not in a BuyerAuthProvider
    buyerAuthAvailable = false;
    console.warn('WishlistProvider: BuyerAuth not available');
  }

  const { toast } = useToast?.() || {};

  console.log('🔄 WishlistProvider render:', {
    user: user ? { id: user.id, email: user.email } : null,
    wishlistLength: wishlist.length,
    isLoading,
    hasError: !!error,
    buyerAuthAvailable
  });

  // If buyer auth is not available, provide a default context value
  if (!buyerAuthAvailable) {
    return (
      <WishlistContext.Provider
        value={{
          wishlist: [],
          addToWishlist: async () => {},
          removeFromWishlist: async () => {},
          isInWishlist: () => false,
          isLoading: false,
          error: null,
          refreshWishlist: async () => {},
        }}
      >
        {children}
      </WishlistContext.Provider>
    );
  }

  // Convert WishlistItem to Product with seller information
  const mapWishlistItemToProduct = async (item: WishlistItem): Promise<Product> => {
    console.log('📝 Mapping wishlist item:', {
      id: item.id,
      name: item.name,
      price: item.price,
      priceType: typeof item.price,
      sellerName: (item as any).sellerName
    });
    
    // Create a seller object with shop name from the wishlist item
    const seller: Seller = {
      id: item.sellerId,
      fullName: (item as any).sellerName || 'Unknown Shop',
      email: '',
      phone: '',
      bannerUrl: '',
      shopName: (item as any).sellerName || 'Unknown Shop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const product: Product = {
      id: item.id,
      name: item.name,
      description: item.description,
      price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      image_url: item.image_url,
      sellerId: item.sellerId,
      seller: seller,
      isSold: item.isSold,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      aesthetic: item.aesthetic as Aesthetic,
    };
    
    console.log('✅ Mapped product:', {
      id: product.id,
      name: product.name,
      price: product.price,
      priceType: typeof product.price,
      shopName: product.seller.shopName
    });
    
    return product;
  };

  // Load wishlist from server
  const loadWishlist = useCallback(async () => {
    if (!user) {
      console.log('No user, clearing wishlist');
      setWishlist([]);
      return;
    }

    console.log('🔄 Loading wishlist for user:', user.id, user.email);
    setIsLoading(true);
    try {
      const serverWishlist = await buyerApi.getWishlist();
      console.log('📦 Server wishlist response:', serverWishlist);
      
      const products = Array.isArray(serverWishlist) 
        ? await Promise.all(serverWishlist.map(mapWishlistItemToProduct))
        : [];
      
      console.log('✅ Mapped products:', products.map(p => ({ id: p.id, name: p.name, hasSeller: !!p.seller })));
      setWishlist(products);
      console.log('🎯 Wishlist state updated, length:', products.length);
    } catch (error) {
      console.error('❌ Error loading wishlist:', error);
      setWishlist([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load wishlist when user changes
  useEffect(() => {
    console.log('🔄 Wishlist useEffect triggered:', {
      user: user ? { id: user.id, email: user.email } : null,
      hasUser: !!user
    });
    
    if (user) {
      console.log('👤 User found, loading wishlist...');
      loadWishlist();
    } else {
      console.log('🚫 No user, clearing wishlist');
      setWishlist([]);
    }
  }, [user, loadWishlist]);

  // Always provide the context, even if there's no user
  const contextValue: WishlistContextType = {
    wishlist,
    addToWishlist: async (product: Product) => {
      if (!user) throw new Error('User must be logged in');
      if (!product?.id) throw new Error('Invalid product data');
      
      console.log('➕ Adding to wishlist:', { productId: product.id, productName: product.name });

      try {
        setError(null);
        await buyerApi.addToWishlist({ id: product.id });
        
        // Refresh the wishlist to ensure we have the latest data
        await loadWishlist();
        
        toast({
          title: 'Added to wishlist',
          description: `${product.name} has been added to your wishlist.`,
        });
        
      } catch (error: any) {
        console.error('❌ Error adding to wishlist:', {
          error,
          message: error.message,
          code: error.code,
          response: error.response?.data
        });
        
        if (error.code === 'DUPLICATE_WISHLIST_ITEM' || error.response?.status === 409) {
          const errorMessage = error.response?.data?.message || error.message || 'This item is already in your wishlist.';
          toast({
            title: 'Already in wishlist',
            description: errorMessage,
            variant: 'default',
          });
        } else {
          const errorMessage = error.response?.data?.message || 'There was an error adding this item to your wishlist. Please try again.';
          toast({
            title: 'Failed to add to wishlist',
            description: errorMessage,
            variant: 'destructive',
          });
        }
        throw error;
      }
    },
    removeFromWishlist: async (productId: string) => {
      if (!user) throw new Error('User must be logged in');
      
      console.log('➖ Removing from wishlist:', productId);
      
      try {
        setError(null);
        await buyerApi.removeFromWishlist(productId);
        
        // Refresh the wishlist to ensure we have the latest data
        await loadWishlist();
        
        toast({
          title: 'Removed from wishlist',
          description: 'The item has been removed from your wishlist.',
        });
        
      } catch (error) {
        console.error('❌ Error removing from wishlist:', error);
        toast({
          title: 'Failed to remove from wishlist',
          description: 'There was an error removing this item from your wishlist. Please try again.',
          variant: 'destructive',
        });
        throw error;
      }
    },
    isInWishlist: (productId: string) => {
      return wishlist.some(item => item.id === productId);
    },
    refreshWishlist: loadWishlist,
    isLoading,
    error,
  };

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    // Return a default context when not in provider
    return {
      wishlist: [],
      addToWishlist: async () => {},
      removeFromWishlist: async () => {},
      isInWishlist: () => false,
      isLoading: false,
      error: null,
      refreshWishlist: async () => {},
    };
  }
  return context;
};