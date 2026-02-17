import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Search } from 'lucide-react';
import { useWishlist } from '@/contexts/WishlistContext';
import { ProductCard } from '@/components/ProductCard';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function WishlistSection() {
  const { wishlist } = useWishlist();
  const [searchQuery, setSearchQuery] = useState('');

  const glassStyle: React.CSSProperties = {
    background: 'rgba(17, 17, 17, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
  };

  const filteredWishlist = wishlist.filter(product => {
    const query = searchQuery.toLowerCase();
    const productName = product.name.toLowerCase();
    const shopName = (product.seller?.shopName || '').toLowerCase();
    return productName.includes(query) || shopName.includes(query);
  });

  if (wishlist.length === 0) {
    return (
      <div className="text-center py-16 sm:py-20 lg:py-24">
        <div className="max-w-2xl mx-auto rounded-3xl p-10 sm:p-12" style={glassStyle}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 mx-auto mb-6 sm:mb-8 bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 border border-yellow-500/20 rounded-3xl flex items-center justify-center shadow-lg">
            <Heart className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 text-yellow-400 fill-current" />
          </div>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mb-3 sm:mb-4">
            Your wishlist is empty
          </h3>
          <p className="text-gray-300 text-sm sm:text-base lg:text-lg font-normal max-w-md mx-auto px-4">
            Start adding items you love to your wishlist and they'll appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-sm ml-auto mb-6">
        <Input
          type="text"
          placeholder="Search wishlist..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl pl-14 h-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
      </div>

      {filteredWishlist.length === 0 && searchQuery ? (
        <div className="text-center py-12 px-4 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-gray-400">No items found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredWishlist.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              forceWhiteText={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
