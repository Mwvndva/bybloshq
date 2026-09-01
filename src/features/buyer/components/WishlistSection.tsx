import { Heart, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWishlist } from '@/features/buyer/hooks/useWishlist';
import { ShopProductCard } from '@/features/shop/components/ShopProductCard';
import { Input } from '@/shared/ui/input';
import { useState } from 'react';

export default function WishlistSection() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none z-10" />
        <Input
          type="text"
          aria-label="Search wishlist"
          placeholder="Search wishlist..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder-gray-500 rounded-xl pl-10 h-10 shadow-sm transition-colors"
        />
      </div>

      {filteredWishlist.length === 0 && searchQuery ? (
        <div className="text-center py-12 px-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
          <p className="text-slate-500 dark:text-slate-400">No items found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
          {filteredWishlist.map((product) => {
            const shopSlug = product.seller?.shopName || '';
            const handleTap = () => {
              if (!shopSlug) {
                toast.error('This shop is unavailable right now.');
                return;
              }
              // Open the seller shop with this product already in the bag.
              navigate(`/buyer/shop/${encodeURIComponent(shopSlug)}`, { state: { bagAdd: product } });
            };
            return (
              <div key={product.id} className="max-w-[260px] w-full mx-auto sm:mx-0">
                <ShopProductCard
                  product={product}
                  onTap={handleTap}
                  isWishlisted
                  onToggleWishlist={() => removeFromWishlist(String(product.id))}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


