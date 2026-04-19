
import { Link } from 'react-router-dom';
import { Heart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Seller } from '@/api/publicApi';

interface SellerBrandCardProps {
    seller: Seller;
    className?: string;
    isBuyer?: boolean;
    variant?: 'grid' | 'slim' | 'horizontal';
}

const prettifyName = (name: string) => {
    if (!name) return '';
    return name
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
};

const SellerBrandCard = ({ seller, className, isBuyer, variant = 'grid' }: SellerBrandCardProps) => {
    const bannerUrl = seller.bannerUrl || seller.banner_url;
    const themeColor = seller.theme || 'black';

    const getThemeColors = (theme: string) => {
        const colors: Record<string, { bg: string, text: string, button: string, badge: string, icon: string }> = {
            'default': { bg: 'bg-white', text: 'text-gray-900', button: 'bg-black text-white border-black/10 hover:bg-gray-800', badge: 'bg-gray-100/90 text-gray-900', icon: 'text-gray-900' },
            'black': { bg: 'bg-gray-900', text: 'text-white', button: 'bg-white/10 text-white border-white/20 hover:bg-white/20', badge: 'bg-white/90 text-black', icon: 'text-black' },
            'pink': { bg: 'bg-pink-500', text: 'text-pink-50', button: 'bg-white/20 text-white border-white/30 hover:bg-white/30', badge: 'bg-white/90 text-pink-600', icon: 'text-pink-600' },
            'brown': { bg: 'bg-amber-800', text: 'text-amber-50', button: 'bg-white/20 text-white border-white/30 hover:bg-white/30', badge: 'bg-white/90 text-amber-800', icon: 'text-amber-800' },
            'orange': { bg: 'bg-orange-500', text: 'text-orange-50', button: 'bg-white/20 text-white border-white/30 hover:bg-white/30', badge: 'bg-white/90 text-orange-600', icon: 'text-orange-600' },
            'green': { bg: 'bg-green-500', text: 'text-green-50', button: 'bg-white/20 text-white border-white/30 hover:bg-white/30', badge: 'bg-white/90 text-green-700', icon: 'text-green-700' },
            'red': { bg: 'bg-red-500', text: 'text-red-50', button: 'bg-white/20 text-white border-white/30 hover:bg-white/30', badge: 'bg-white/90 text-red-600', icon: 'text-red-600' },
            'yellow': { bg: 'bg-yellow-400', text: 'text-yellow-900', button: 'bg-black/10 text-yellow-900 border-black/10 hover:bg-black/20', badge: 'bg-white/90 text-yellow-700', icon: 'text-yellow-700' }
        };
        return colors[theme] || colors['black'];
    };

    const styles = getThemeColors(themeColor);

    const getGradient = (theme: string) => {
        const gradients: Record<string, string> = {
            'default': 'from-gray-100 to-gray-300',
            'black': 'from-gray-800 to-black',
            'pink': 'from-pink-400 to-pink-600',
            'brown': 'from-amber-700 to-amber-900',
            'orange': 'from-orange-400 to-orange-600',
            'green': 'from-green-400 to-green-600',
            'red': 'from-red-400 to-red-600',
            'yellow': 'from-yellow-300 to-yellow-500'
        };
        return gradients[theme] || gradients['black'];
    };

    const gradientClass = getGradient(themeColor);
    const rawShopName = seller.shopName || seller.shop_name;
    const displayName = prettifyName(rawShopName);
    const shopLink = isBuyer ? `/buyer/shop/${encodeURIComponent(rawShopName)}` : `/shop/${encodeURIComponent(rawShopName)}`;

    if (variant === 'horizontal') {
        const initial = (displayName || '?')[0].toUpperCase();
        return (
            <Link
                to={shopLink}
                className={cn(
                    "flex items-stretch bg-gray-900 rounded-xl h-16 overflow-hidden transition-transform active:scale-[0.98]",
                    className
                )}
            >
                <div className={cn("w-16 flex-shrink-0 flex items-center justify-center bg-gradient-to-br", gradientClass)}>
                    <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold text-white shadow-sm backdrop-blur-sm">
                        {initial}
                    </div>
                </div>
                <div className="flex-1 px-4 flex flex-col justify-center">
                    <h4 className="text-sm font-bold text-white truncate">{displayName}</h4>
                    <div className="flex items-center gap-3 text-[10px] text-white/40 font-medium">
                        <span className="flex items-center gap-1"><Users size={10} /> {seller.clientCount || 0}</span>
                        <span className="flex items-center gap-1"><Heart size={10} /> {seller.totalWishlistCount || 0}</span>
                    </div>
                </div>
                <div className="px-4 flex items-center">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                        <Users size={12} className="text-white/20" />
                    </div>
                </div>
            </Link>
        );
    }

    if (variant === 'slim') {
        const initial = (displayName || '?')[0].toUpperCase();
        return (
            <div className={cn("bg-gray-900 rounded-xl overflow-hidden cursor-pointer group transition-all active:scale-[0.97]", className)}>
                <div className={cn("h-16 flex items-center justify-center bg-gradient-to-br opacity-80 group-hover:opacity-100 transition-opacity", gradientClass)}>
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white backdrop-blur-sm">
                        {initial}
                    </div>
                </div>
                <div className="p-3">
                    <h4 className="text-xs font-bold text-white mb-2 truncate">{displayName}</h4>
                    <div className="flex items-center justify-between gap-1 mb-3">
                        <span className="flex items-center gap-1 text-[9px] text-white/40"><Users size={9} /> {seller.clientCount || 0}</span>
                        <span className="flex items-center gap-1 text-[9px] text-white/40"><Heart size={9} /> {seller.totalWishlistCount || 0}</span>
                    </div>
                    <Link
                        to={shopLink}
                        className="block w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white text-center transition-colors"
                    >
                        View Shop
                    </Link>
                </div>
            </div>
        );
    }

    // Default Grid Variant
    return (
        <div className={cn("group relative aspect-square overflow-hidden rounded-2xl bg-gray-900", className)}>
            {bannerUrl ? (
                <img
                    src={bannerUrl}
                    alt={`${displayName} banner`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
            ) : (
                <div className={cn("h-full w-full bg-gradient-to-br", gradientClass, "flex items-center justify-center")}>
                    <span className="text-4xl font-black text-white/20 select-none">{(displayName || '?')[0].toUpperCase()}</span>
                </div>
            )}

            <div className="absolute top-3 left-3 z-10">
                <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 shadow-sm backdrop-blur-md", styles.badge)}>
                    <Users className={cn("h-3 w-3", styles.icon)} />
                    <span className={cn("text-[10px] font-bold", styles.icon)}>{seller.clientCount || 0}</span>
                </div>
            </div>

            <div className="absolute top-3 right-3 z-10">
                <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 shadow-sm backdrop-blur-md", styles.badge)}>
                    <Heart className={cn("h-3 w-3 fill-current", styles.icon)} />
                    <span className={cn("text-[10px] font-bold", styles.icon)}>{seller.totalWishlistCount || 0}</span>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12">
                <div className="flex flex-col items-center text-center">
                    <h3 className={cn("mb-3 text-base font-black tracking-tight drop-shadow-xl line-clamp-1", styles.text)}>
                        {displayName}
                    </h3>
                    <Link
                        to={shopLink}
                        className={cn(
                            "rounded-full border px-6 py-2.5 text-xs font-bold backdrop-blur-md transition-all hover:scale-105 active:scale-95",
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
