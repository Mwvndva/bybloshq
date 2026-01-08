import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/contexts/WishlistContext';
import { ProductCard } from '@/components/ProductCard';

export default function WishlistSection() {
  const { wishlist } = useWishlist();

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
    </div>
  );
}
