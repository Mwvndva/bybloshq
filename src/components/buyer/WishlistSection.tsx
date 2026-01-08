import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, X, Loader2, ShoppingCart, Store, Eye, Trash2 } from 'lucide-react';
import { useWishlist } from '@/contexts/WishlistContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';

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

      // Safely convert price to number and string
      const numericPrice = typeof product.price === 'number' ? product.price :
        (typeof product.price === 'string' ? parseFloat(product.price) : 0);

      const payload = {
        amount: numericPrice.toString(),
        description: `Purchase of ${product.name}`,
        sellerId: parseInt(product.sellerId || product.seller_id || '0'),
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
            price: numericPrice,
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/intasend/checkout`, {
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
      <div className="text-center py-16 sm:py-20 lg:py-24">
        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 mx-auto mb-6 sm:mb-8 bg-gradient-to-br from-pink-100 via-purple-100 to-yellow-100 rounded-3xl flex items-center justify-center shadow-lg">
          <Heart className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 text-pink-500 fill-current animate-pulse" />
        </div>
        <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-black mb-3 sm:mb-4">
          Your wishlist is empty
        </h3>
        <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium max-w-md mx-auto px-4">
          Start adding items you love to your wishlist and they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {wishlist.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      </div>

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="sm:max-w-4xl mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-sm sm:text-base">
              <span className="truncate pr-2">{selectedProduct?.name}</span>
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
