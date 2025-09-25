import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, X, Phone, Mail, User } from 'lucide-react';
import { useWishlist } from '@/contexts/WishlistContext';

export default function WishlistSection() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const handleImageClick = (product: any) => {
    setSelectedProduct(product);
    setIsImageDialogOpen(true);
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
                
                {hasContactInfo && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 text-blue-700 hover:text-blue-800 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 text-xs sm:text-sm py-2"
                      >
                        <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Contact Seller
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md mx-4">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2 text-sm sm:text-base">
                          <User className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="truncate">Contact {displaySellerName}</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 sm:space-y-4">
                        {displaySeller?.phone && (
                          <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <Phone className="h-4 w-4 text-gray-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-900">Phone</p>
                              <a 
                                href={`tel:${displaySeller.phone}`}
                                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors break-all"
                              >
                                {displaySeller.phone}
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {displaySeller?.email && (
                          <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <Mail className="h-4 w-4 text-gray-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-900">Email</p>
                              <a 
                                href={`mailto:${displaySeller.email}`}
                                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors break-all"
                              >
                                {displaySeller.email}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
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
