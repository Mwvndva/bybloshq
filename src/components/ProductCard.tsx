import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Image as ImageIcon, X, Heart, Loader2, ShoppingCart } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { cn, formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface ProductCardProps {
  product: Product & {
    seller?: Seller;
    isSold?: boolean;
  };
  seller?: Seller;
  hideWishlist?: boolean;
}

// Hook to safely use wishlist context
const useWishlistSafe = () => {
  try {
    return useWishlist();
  } catch (error) {
    return {
      addToWishlist: async () => {},
      removeFromWishlist: async () => {},
      isInWishlist: () => false,
      isLoading: false,
    } as any;
  }
};

export function ProductCard({ product, seller, hideWishlist = false }: ProductCardProps) {
  const { toast } = useToast();
  const { addToWishlist, isInWishlist, isLoading: isWishlistLoading } = useWishlistSafe();
  
  // Dialog state
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  
  // Loading states
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  
  // Derived state
  const displaySeller = seller || product.seller;
  const displaySellerName = displaySeller?.fullName || 'Unknown Seller';
  const sellerLocation = displaySeller?.location;
  const isSold = product.status === 'sold' || product.isSold;
  
  const hasContactInfo = Boolean(
    displaySeller?.phone || 
    displaySeller?.email || 
    displaySeller?.website || 
    sellerLocation
  );
  
  const isWishlisted = isInWishlist(product.id);



  useEffect(() => {
    console.log(`ProductCard ${product.id}: isWishlisted=${isWishlisted}`);
  }, [product.id, isWishlisted]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWishlistLoading || wishlistActionLoading || isSold) return;
    setWishlistActionLoading(true);
    try {
      await addToWishlist(product);
      toast({ 
        title: 'Added to Wishlist', 
        description: `${product.name} added to your wishlist.` 
      });
    } catch (error: any) {
      if (error.code === 'DUPLICATE_WISHLIST_ITEM' || error.response?.status === 409) {
        toast({ 
          title: 'Already in Wishlist', 
          description: 'Product already in wishlist',
          variant: 'default'
        });
      } else {
        toast({ 
          title: 'Error', 
          description: 'Failed to add item to wishlist.', 
          variant: 'destructive' 
        });
      }
    } finally {
      setWishlistActionLoading(false);
    }
  };
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open image dialog if clicking on interactive elements
    const target = e.target as HTMLElement;
    const isInteractiveElement = 
      target.closest('button') || 
      target.closest('a') ||
      target.closest('[role="button"]');
    
    if (!isInteractiveElement) {
      setIsImageDialogOpen(true);
    }
  };
  
  const { isAuthenticated, user: userData, isLoading } = useBuyerAuth();
  
  const handleBuyClick = async (e: React.MouseEvent) => {
    // 1. Prevent default behavior and stop propagation
    e?.preventDefault?.();
    e?.stopPropagation?.();
    e?.nativeEvent?.stopImmediatePropagation?.();
    
    // 2. Set loading state
    setIsProcessingPurchase(true);
    
    try {
      console.debug('Auth Debug:', { isAuthenticated, userData, isLoading, product });
      
      // 3. Check authentication status
      if (isLoading) {
        toast({
          title: 'Please wait',
          description: 'Checking your authentication status...',
          variant: 'default',
          duration: 2000
        });
        return;
      }
      
      // 4. Verify user is authenticated
      if (!isAuthenticated || !userData) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to complete your purchase.',
          variant: 'destructive',
          action: (
            <button 
              onClick={() => {
                // Store current URL for redirect after login
                localStorage.setItem('post_login_redirect', window.location.pathname);
                window.location.href = '/buyer/login';
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Sign In
            </button>
          )
        });
        return;
      }
      
      // 5. Validate required user data
      if (!userData.email) {
        toast({
          title: 'Profile Incomplete',
          description: 'Please complete your profile information before making a purchase.',
          variant: 'destructive',
          action: (
            <button 
              onClick={() => {
                window.location.href = '/buyer/profile';
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Complete Profile
            </button>
          )
        });
        return;
      }
      
      // 6. Prepare payment payload
      const [firstName = 'Customer', ...lastNameParts] = userData.fullName?.split(' ') || [];
      const lastName = lastNameParts.join(' ') || 'User';
      
      const payload = {
        amount: product.price,
        description: `Purchase of ${product.name}`,
        customer: {
          id: String(userData.id || 'N/A'),
          email: userData.email,
          phone: userData.phone || '',
          firstName: firstName,
          lastName: lastName,
        },
        items: [
          {
            id: String(product.id),
            name: product.name,
            quantity: 1,
            unitPrice: product.price,
            totalPrice: product.price,
            description: product.description || '',
            category: product.category || 'General',
            currency: 'KES'
          },
        ],
        currency: 'KES',
        callbackUrl: `${window.location.origin}/orders`,
        cancelUrl: `${window.location.origin}/products/${product.id}`,
        notificationId: process.env.VITE_PESAPAL_IPN_ID || '',
        billingAddress: {
          emailAddress: userData.email,
          phoneNumber: userData.phone || '',
          firstName: firstName,
          lastName: lastName,
        }
      };
      
      console.debug('Checkout Request:', { payload });
      
      // 7. Get authentication token
      const token = localStorage.getItem('buyer_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // 8. Call checkout API
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiUrl}/pesapal/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      
      // 9. Handle API response
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        const errorMessage = responseData.message || 'Failed to initiate payment';
        console.error('Checkout API Error:', { status: response.status, responseData });
        throw new Error(errorMessage);
      }
      
      // Extract redirect URL from the nested data object
      const redirectUrl = responseData.data?.redirect_url;
      
      if (!redirectUrl) {
        console.error('Invalid response format from payment gateway:', responseData);
        throw new Error('Invalid response from payment gateway');
      }
      
      // 10. Redirect to payment page
      console.debug('Redirecting to payment gateway:', redirectUrl);
      window.location.href = redirectUrl;
      
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: error.message || 'Failed to process your payment. Please try again.',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      // 11. Always reset loading state
      setIsProcessingPurchase(false);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
    setIsImageLoading(false);
  };

  const handleImageLoad = () => setIsImageLoading(false);

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-500 bg-white/80 backdrop-blur-sm border-0 shadow-lg',
        isSold ? 'opacity-60' : 'hover:shadow-2xl hover:-translate-y-2',
        'cursor-pointer'
      )}
      aria-label={`Product: ${product.name}`}
      onClick={handleCardClick}
    >
      {/* Wishlist Button */}
      {!hideWishlist && (
        <button
          onClick={toggleWishlist}
          className={cn(
            'absolute top-4 right-4 z-10 p-3 rounded-2xl bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm transition-all duration-300',
            wishlistActionLoading || isWishlistLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'
          )}
          aria-label="Add to wishlist"
          disabled={isSold || wishlistActionLoading || isWishlistLoading}
          aria-busy={wishlistActionLoading}
        >
          {wishlistActionLoading || isWishlistLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
          ) : (
            <Heart className={cn('h-5 w-5', isWishlisted ? 'text-red-500 fill-current' : 'text-gray-600')} />
          )}
        </button>
      )}

      {/* Image */}
      <div className="relative overflow-hidden rounded-t-xl">
        {isImageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <ImageIcon className="h-8 w-8 text-gray-300 animate-pulse" />
          </div>
        )}
        <img
          src={product.image_url}
          alt={product.name}
          className={cn('w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110 cursor-zoom-in', isImageLoading ? 'opacity-0' : 'opacity-100')}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={(e) => {
            e.stopPropagation();
            setIsImageDialogOpen(true);
          }}
        />
      </div>

      <CardContent className="p-4">
        <div className="mb-2">
          <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-gray-700 transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-yellow-600">{formatCurrency(product.price)}</span>
            {product.aesthetic && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                {product.aesthetic}
              </Badge>
            )}
          </div>
        </div>

        {product.description && (
          <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed">{product.description}</p>
        )}

        {/* Seller and Buy Button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-3">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 font-medium">{displaySellerName}</span>
          </div>
          <button
            type="button"
            className={cn(
              'text-xs bg-yellow-600 hover:bg-yellow-700 text-white transition-all duration-200',
              'flex items-center justify-center space-x-1 px-3 py-2 rounded-md',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2',
              'h-8 text-sm font-medium'
            )}
            onClick={(e) => {
              // Stop all event propagation
              e.preventDefault();
              e.stopPropagation();
              if (e.nativeEvent) {
                e.nativeEvent.stopImmediatePropagation();
              }
              
              // Call the handler
              handleBuyClick(e);
            }}
            disabled={isSold || isProcessingPurchase}
            aria-busy={isProcessingPurchase}
          >
            {isProcessingPurchase ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                <span>Buy Now</span>
              </>
            )}
          </button>
        </div>
      </CardContent>

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-0 shadow-none">
          <div className="relative w-full h-full bg-black/90 flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsImageDialogOpen(false);
              }}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Close image"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={product.image_url}
                alt={product.name}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

