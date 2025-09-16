import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Image as ImageIcon, Mail, X, MapPin, Globe, Heart, Loader2 } from 'lucide-react';
import { Product, Seller } from '@/types';
import { useWishlist } from '@/contexts/WishlistContext';
import { cn, formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
}

export function ProductCard({ product, seller, hideWishlist = false }: ProductCardProps) {
  const { toast } = useToast();
  const { addToWishlist, removeFromWishlist, isInWishlist, isLoading: isWishlistLoading } = useWishlist();
  const [isSellerDialogOpen, setIsSellerDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);
  
  // Use seller from product if not provided as prop
  const displaySeller = seller || product.seller;
  const displaySellerName = displaySeller?.fullName || 'Unknown Seller';
  const hasContactInfo = Boolean(displaySeller?.phone || displaySeller?.email);
  const sellerLocation = displaySeller?.location;
  const isSold = product.status === 'sold' || product.isSold;

  // Check if product is in wishlist
  const isWishlisted = isInWishlist(product.id);
  
  // Debug logging
  useEffect(() => {
    console.log(`ProductCard ${product.id}: isWishlisted = ${isWishlisted}, isLoading = ${isWishlistLoading}`);
  }, [product.id, isWishlisted, isWishlistLoading]);

  // Toggle wishlist status
  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isWishlistLoading || wishlistActionLoading) return;
    
    setWishlistActionLoading(true);
    
    try {
      await addToWishlist(product);
      toast({
        title: 'Added to Wishlist',
        description: `${product.name} has been added to your wishlist.`,
        duration: 2000
      });
    } catch (error) {
      console.error('Wishlist error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Product already in wishlist') {
          toast({
            title: 'Already in Wishlist',
            description: `${product.name} has already been added to your wishlist.`,
            duration: 3000
          });
        } else {
          toast({
            title: 'Error',
            description: `Failed to add item to wishlist. Please try again.`,
            variant: 'destructive',
            duration: 2000
          });
        }
      }
    } finally {
      setWishlistActionLoading(false);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQiIDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNkMGQwZDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1pbWFnZSI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSIvPjxwb2x5bGluZSBwb2ludHM9IjIxIDE1IDE2IDEwIDUgMjEiLz48L3N2Zz4=';
    setIsImageLoading(false);
  };
  
  const handleImageLoad = () => {
    setIsImageLoading(false);
  };

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-500 hover:shadow-2xl",
        isSold ? 'opacity-60' : 'hover:shadow-2xl',
        "bg-white/80 backdrop-blur-sm border-0 shadow-lg transform hover:-translate-y-2"
      )}
      aria-label={`Product: ${product.name}`}
    >
      {/* Wishlist Button - Conditionally Rendered */}
      {!hideWishlist && (
        <button
          onClick={toggleWishlist}
          className={cn(
            "absolute top-4 right-4 z-10 p-3 rounded-2xl transition-all duration-300",
            'bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm',
            wishlistActionLoading || isWishlistLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'
          )}
          aria-label="Add to wishlist"
          disabled={isSold || wishlistActionLoading || isWishlistLoading}
          aria-busy={wishlistActionLoading}
        >
          {wishlistActionLoading || isWishlistLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
          ) : (
            <Heart 
              className="h-5 w-5 text-gray-600 hover:text-red-500 transition-colors"
            />
          )}
        </button>
      )}

      {/* SOLD Badge */}
      {isSold && (
        <div className="absolute top-4 left-4 z-10">
          <Badge className="bg-gradient-to-r from-gray-600 to-gray-700 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg">
            SOLD
          </Badge>
          </div>
      )}

      
      {/* Product Image */}
      <div className="relative overflow-hidden rounded-t-2xl">
        {isImageLoading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}
        
        <img
          src={product.image_url || '/placeholder-image.jpg'}
          alt={product.name}
          className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
        
        {/* Image overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Image dialog trigger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsImageDialogOpen(true);
          }}
          className="absolute inset-0 w-full h-full bg-transparent"
          aria-label="View full size image"
        />
      </div>

      {/* Product Content */}
      <CardContent className="p-6 space-y-4">
        {/* Product Name and Price */}
        <div className="space-y-2">
          <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-gray-700 transition-colors">
              {product.name}
            </h3>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-yellow-600">
              {formatCurrency(product.price)}
            </span>
            {product.aesthetic && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                {product.aesthetic}
              </Badge>
            )}
          </div>
        </div>

        {/* Product Description */}
        {product.description && (
          <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Seller Info */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 font-medium">
              {displaySellerName}
            </span>
          </div>
          
          {hasContactInfo && (
          <Dialog open={isSellerDialogOpen} onOpenChange={setIsSellerDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                  className="text-xs bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300 transition-all duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  Contact
              </Button>
            </DialogTrigger>
              <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Contact {displaySellerName}</span>
                  </DialogTitle>
              </DialogHeader>
                <div className="space-y-4">
                {displaySeller?.phone && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <a 
                          href={`tel:${displaySeller.phone}`}
                          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {displaySeller.phone}
                        </a>
                      </div>
                  </div>
                )}
                  
                {displaySeller?.email && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <a 
                          href={`mailto:${displaySeller.email}`}
                          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {displaySeller.email}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {sellerLocation && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <MapPin className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Location</p>
                        <p className="text-sm text-gray-700">{sellerLocation}</p>
                      </div>
                  </div>
                )}
                  
                {displaySeller?.website && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Globe className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Website</p>
                        <a 
                          href={displaySeller.website}
                        target="_blank"
                        rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {displaySeller.website}
                        </a>
                      </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </CardContent>

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{product.name}</span>
              <Button
                variant="ghost"
                size="sm"
              onClick={() => setIsImageDialogOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={product.image_url || '/placeholder-image.jpg'}
                alt={product.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={handleImageError}
              />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}