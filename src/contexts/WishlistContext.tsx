import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Product, Aesthetic, Seller } from '@/types';
import { useBuyerAuth } from './BuyerAuthContext';
import buyerApi, { WishlistItem } from '@/api/buyerApi';
import { publicApiService } from '@/api/publicApi';

interface WishlistContextType {
  wishlist: Product[];
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useBuyerAuth();
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  console.log('🔄 WishlistProvider render:', {
    user: user ? { id: user.id, email: user.email } : null,
    wishlistLength: wishlist.length,
    isLoading
  });

  // Always provide the context, even if there's no user
  const contextValue: WishlistContextType = {
    wishlist,
    addToWishlist: async (product: Product) => {
      if (!user) throw new Error('User must be logged in');
      if (!product?.id) throw new Error('Invalid product data');
      
      console.log('➕ Adding to wishlist:', { productId: product.id, productName: product.name });

      try {
        await buyerApi.addToWishlist({ id: product.id });
        setWishlist(prev => {
          console.log('✅ Wishlist updated, adding product:', product.id);
          return [...prev, product];
        });
      } catch (error) {
        console.error('❌ Error adding to wishlist:', error);
        throw error;
      }
    },
    removeFromWishlist: async (productId: string) => {
      if (!user) throw new Error('User must be logged in');
      
      console.log('➖ Removing from wishlist:', productId);
      
      try {
        await buyerApi.removeFromWishlist(productId);
        setWishlist(prev => {
          console.log('✅ Wishlist updated, removing product:', productId);
          return prev.filter(item => item.id !== productId);
        });
      } catch (error) {
        console.error('❌ Error removing from wishlist:', error);
        throw error;
      }
    },
    isInWishlist: (productId: string) => {
      const result = wishlist.some(item => item.id === productId);
      console.log(`isInWishlist(${productId}): ${result}, wishlist length: ${wishlist.length}`, {
        wishlist: wishlist.map(item => ({ id: item.id, name: item.name })),
        productId,
        user: user ? { id: user.id, email: user.email } : null
      });
      return result;
    },
    isLoading
  };

  // Convert WishlistItem to Product with seller information
  const mapWishlistItemToProduct = async (item: WishlistItem): Promise<Product> => {
    let seller: Seller | undefined;
    
    try {
      seller = await publicApiService.getSellerInfo(item.sellerId);
    } catch (error) {
      console.error(`Error fetching seller info for ${item.sellerId}:`, error);
    }
    
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      sellerId: item.sellerId,
      seller: seller,
      isSold: item.isSold,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      aesthetic: item.aesthetic as Aesthetic,
    };
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

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = (): WishlistContextType => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};