
import { Heart } from 'lucide-react';
import { useWishlist } from '@/contexts/WishlistContext';
import { ProductCard } from '@/components/ProductCard';

interface WishlistSectionProps {
  searchQuery?: string;
}

export default function WishlistSection({ searchQuery = '' }: WishlistSectionProps) {
  const { wishlist } = useWishlist();

  const filteredWishlist = wishlist.filter(product => {
    const query = searchQuery.toLowerCase();
    const productName = product.name.toLowerCase();
    const shopName = (product.seller?.shopName || '').toLowerCase();
    return productName.includes(query) || shopName.includes(query);
  });

  if (wishlist.length === 0) {
    return (
      <div className="text-center py-20 bg-[#141414] rounded-2xl border border-white/5 shadow-xl animate-in fade-in zoom-in-95 duration-500 mt-4">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/10 rounded-2xl flex items-center justify-center">
          <Heart className="h-10 w-10 text-yellow-500/40 fill-current" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Your wishlist is empty</h3>
        <p className="text-white/30 text-xs font-medium max-w-[240px] mx-auto">
          Start adding items you love to your wishlist and they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filteredWishlist.length === 0 && searchQuery ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5">
          <p className="text-sm text-white/30">No items found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredWishlist.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              forceWhiteText={true}
              className="border border-white/5"
            />
          ))}
        </div>
      )}
    </div>
  );
}
