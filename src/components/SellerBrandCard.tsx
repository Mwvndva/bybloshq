
import { Link } from 'react-router-dom';
import { Heart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Seller } from '@/api/publicApi';

interface SellerBrandCardProps {
    seller: Seller;
    className?: string;
    isBuyer?: boolean;
}

const SellerBrandCard = ({ seller, className, isBuyer }: SellerBrandCardProps) => {
    // Use a transparent placeholder if banner is missing to maintain layout
    const bannerUrl = seller.bannerUrl || seller.banner_url;

    // Theme color fallback
    const themeColor = (seller as any).themeColor || 'black';

    const shopLink = isBuyer
        ? `/buyer/shop/${seller.shopName || seller.shop_name}`
        : `/shop/${seller.shopName || seller.shop_name}`;

    return (
        <div className={cn("group relative aspect-square overflow-hidden rounded-2xl bg-gray-900", className)}>
            {/* Background/Banner Image */}
            {bannerUrl ? (
                <img
                    src={bannerUrl}
                    alt={`${seller.shopName || seller.shop_name} banner`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
            ) : (
                // Fallback gradient if no banner
                <div className={`h-full w-full bg-gradient-to-br from-${themeColor === 'white' ? 'gray-200' : 'gray-800'} to-${themeColor === 'white' ? 'gray-400' : 'black'}`} />
            )}

            {/* Client Count Indicator - Top Left */}
            <div className="absolute top-3 left-3 z-10">
                <div className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
                    <Users className="h-3 w-3 text-black fill-black/20" />
                    <span className="text-[10px] font-bold text-black">
                        {seller.clientCount || 0}
                    </span>
                </div>
            </div>

            {/* Wishlist Indicator - Top Right */}
            <div className="absolute top-3 right-3 z-10">
                <div className="flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-1 shadow-sm">
                    <Heart className="h-3 w-3 text-black fill-black" />
                    <span className="text-[10px] font-bold text-black">
                        {seller.totalWishlistCount || 0}
                    </span>
                </div>
            </div>

            {/* Content Overlay - Bottom */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10">
                <div className="flex flex-col items-center text-center">

                    {/* Shop Name */}
                    <h3 className="mb-3 text-lg font-black tracking-tight text-white drop-shadow-lg">
                        {seller.shopName || seller.shop_name}
                    </h3>

                    {/* Open Shop Button */}
                    <Link
                        to={shopLink} // Using shop name as slug/link
                        className="rounded-full border border-white/20 bg-white/10 px-6 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
                    >
                        Open Shop
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SellerBrandCard;
