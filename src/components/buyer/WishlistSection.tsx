import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, X, Loader2, ShoppingCart, User } from 'lucide-react';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function WishlistSection() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const { isAuthenticated, user: userData, isLoading: isAuthLoading } = useBuyerAuth();
  const { toast } = useToast();

  const handleImageClick = (product: any) => {
    setSelectedProduct(product);
    setIsImageDialogOpen(true);
  };

  const handleBuyClick = async (e: React.MouseEvent, product: any) => {
    // 1. Prevent default behavior and stop propagation
    e?.preventDefault?.();
    e?.stopPropagation?.();
    e?.nativeEvent?.stopImmediatePropagation?.();
    
    // 2. Set loading state
    setIsProcessingPurchase(true);
    
    try {
      console.debug('Auth Debug:', { isAuthenticated, userData, isAuthLoading, product });
      
      // 3. Check authentication status
      if (isAuthLoading) {
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
        amount: product.price.toString(),
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
            productId: String(product.id),
            productName: product.name,
            quantity: 1,
            price: product.price,
          },
        ],
      };
      
      console.debug('Checkout Request:', { payload });
      
      // 7. Get authentication token
      const token = localStorage.getItem('buyer_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // 8. Call checkout API
      const response = await fetch('/api/pesapal/checkout', {
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
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      
      // Handle specific error cases
      if (error.name === 'AbortError') {
        toast({
          title: 'Request Timeout',
          description: 'The request took too long. Please check your connection and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Checkout Failed',
          description: error.message || 'Failed to process your payment. Please try again.',
          variant: 'destructive',
          duration: 5000
        });
      }
    } finally {
      // 11. Always reset loading state
      setIsProcessingPurchase(false);
    }
  };

  if (wishlist.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16 lg:py-20">
        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-6 sm:mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg">
          <Heart className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-yellow-600" />
        </div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-black mb-2 sm:mb-3">Your wishlist is empty</h3>
        <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium max-w-md mx-auto px-4">
          Start adding items you love to your wishlist and they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {wishlist.map((product, index) => {
          const displaySeller = product.seller;
          const displaySellerName = displaySeller?.fullName || 'Unknown Seller';
          const hasContactInfo = Boolean(displaySeller?.phone || displaySeller?.email);

          return (
            <Card key={`wishlist-${product.id}-${index}`} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
              <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-40 sm:h-48 lg:h-56 object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImageClick(product);
                  }}
                  className="absolute inset-0 w-full h-full bg-transparent cursor-pointer"
                  aria-label="View full size image"
                />
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/90 hover:bg-white rounded-xl sm:rounded-2xl h-8 w-8 sm:h-10 sm:w-10 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 z-10"
                  onClick={() => removeFromWishlist(product.id)}
                >
                  <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 fill-current" />
                </Button>
              </div>
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-bold text-black mb-2 line-clamp-1 text-sm sm:text-base lg:text-lg">{product.name}</h3>
                <p className="text-yellow-600 font-black text-lg sm:text-xl mb-2 sm:mb-3">
                  KSh {product.price.toLocaleString()}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 leading-relaxed mb-3 sm:mb-4">
                  {product.description}
                </p>
                
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
                    onClick={async (e) => {
                      // Stop all event propagation
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.nativeEvent) {
                        e.nativeEvent.stopImmediatePropagation();
                      }
                      
                      // Call the handler
                      await handleBuyClick(e, product);
                    }}
                    disabled={isProcessingPurchase}
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
            </Card>
          );
        })}
      </div>

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="sm:max-w-4xl mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-sm sm:text-base">
              <span className="truncate pr-2">{selectedProduct?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImageDialogOpen(false)}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={selectedProduct?.image_url || '/placeholder-image.jpg'}
              alt={selectedProduct?.name}
              className="max-w-full max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
