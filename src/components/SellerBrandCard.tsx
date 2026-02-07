
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
    const themeColor = seller.theme || 'black';

    // Theme color definition matching ThemeSelector
    const getThemeColors = (theme: string) => {
        const colors: Record<string, { bg: string, text: string, button: string, badge: string, icon: string }> = {
            'default': { // White theme
                bg: 'bg-white',
                text: 'text-gray-900',
                button: 'bg-black text-white border-black/10 hover:bg-gray-800',
                badge: 'bg-gray-100/90 text-gray-900',
                icon: 'text-gray-900'
            },
            'black': {
                bg: 'bg-gray-900',
                text: 'text-white',
                button: 'bg-white/10 text-white border-white/20 hover:bg-white/20',
                badge: 'bg-white/90 text-black',
                icon: 'text-black'
            },
            'pink': {
                bg: 'bg-pink-500',
                text: 'text-pink-50',
                button: 'bg-white/20 text-white border-white/30 hover:bg-white/30',
                badge: 'bg-white/90 text-pink-600',
                icon: 'text-pink-600'
            },
            'brown': {
                bg: 'bg-amber-800',
                text: 'text-amber-50',
                button: 'bg-white/20 text-white border-white/30 hover:bg-white/30',
                badge: 'bg-white/90 text-amber-800',
                icon: 'text-amber-800'
            },
            'orange': {
                bg: 'bg-orange-500',
                text: 'text-orange-50',
                button: 'bg-white/20 text-white border-white/30 hover:bg-white/30',
                badge: 'bg-white/90 text-orange-600',
                icon: 'text-orange-600'
            },
            'green': {
                bg: 'bg-green-500',
                text: 'text-green-50',
                button: 'bg-white/20 text-white border-white/30 hover:bg-white/30',
                badge: 'bg-white/90 text-green-700',
                icon: 'text-green-700'
            },
            'red': {
                bg: 'bg-red-500',
                text: 'text-red-50',
                button: 'bg-white/20 text-white border-white/30 hover:bg-white/30',
                badge: 'bg-white/90 text-red-600',
                icon: 'text-red-600'
            },
            'yellow': {
                bg: 'bg-yellow-400',
                text: 'text-yellow-900',
                button: 'bg-black/10 text-yellow-900 border-black/10 hover:bg-black/20',
                badge: 'bg-white/90 text-yellow-700',
                icon: 'text-yellow-700'
            }
        };

        return colors[theme] || colors['black'];
    };

    const styles = getThemeColors(themeColor);

    // Helper to get gradient bundle based on theme
    const getGradient = (theme: string) => {
        const gradients: Record<string, string> = {
            'default': 'from-gray-100 to-gray-300',
            'black': 'from-gray-800 to-black',
            'pink': 'from-pink-400 to-pink-500',
            'brown': 'from-amber-700 to-amber-900',
            'orange': 'from-orange-400 to-orange-600',
            'green': 'from-green-400 to-green-600',
            'red': 'from-red-400 to-red-600',
            'yellow': 'from-yellow-300 to-yellow-500'
        };
        return gradients[theme] || gradients['black'];
    };

    const gradientClass = getGradient(themeColor);

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
                <div className={`h-full w-full bg-gradient-to-br ${gradientClass}`} />
            )}

            {/* Client Count Indicator - Top Left */}
            <div className="absolute top-3 left-3 z-10">
                <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 shadow-sm backdrop-blur-sm", styles.badge)}>
                    <Users className={cn("h-3 w-3", styles.icon)} />
                    <span className={cn("text-[10px] font-bold", styles.icon)}>
                        {seller.clientCount || 0}
                    </span>
                </div>
            </div>

            {/* Wishlist Indicator - Top Right */}
            <div className="absolute top-3 right-3 z-10">
                <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 shadow-sm backdrop-blur-sm", styles.badge)}>
                    <Heart className={cn("h-3 w-3 fill-current", styles.icon)} />
                    <span className={cn("text-[10px] font-bold", styles.icon)}>
                        {seller.totalWishlistCount || 0}
                    </span>
                </div>
            </div>

            {/* Content Overlay - Bottom */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10">
                <div className="flex flex-col items-center text-center">

                    {/* Shop Name */}
                    <h3 className={cn("mb-3 text-lg font-black tracking-tight drop-shadow-lg", styles.text)}>
                        {seller.shopName || seller.shop_name}
                    </h3>

                    {/* Open Shop Button */}
                    <Link
                        to={shopLink} // Using shop name as slug/link
                        className={cn(
                            "rounded-full border px-6 py-2 text-xs font-bold backdrop-blur-md transition-all hover:scale-105 active:scale-95",
                            styles.button
                        )}
                    >
                        Open Shop
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SellerBrandCard;
