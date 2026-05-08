import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MousePointerClick, Users } from 'lucide-react';
import { cn, getImageUrl } from '@/lib/utils';
import { publicApiService, Seller } from '@/api/publicApi';

interface SellerBrandCardProps {
    seller: Seller;
    className?: string;
    isBuyer?: boolean;
}

const getInitials = (shopName?: string, fullName?: string) => {
    const source = (shopName || fullName || 'Shop').trim();
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return 'S';
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

const getNumber = (...values: unknown[]) => {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const SellerBrandCard = ({ seller, className, isBuyer }: SellerBrandCardProps) => {
    const navigate = useNavigate();
    const shopName = seller.shopName || seller.shop_name || 'Shop';
    const shopLink = isBuyer
        ? `/buyer/shop/${encodeURIComponent(shopName)}`
        : `/shop/${encodeURIComponent(shopName)}`;
    const avatarUrl = seller.avatarUrl || (seller as any).avatar_url;
    const initials = useMemo(() => getInitials(shopName, seller.fullName), [shopName, seller.fullName]);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [knockCount, setKnockCount] = useState(getNumber(seller.knockCount, seller.knock_count));

    const clientCount = getNumber(seller.clientCount, seller.client_count);
    const wishlistCount = getNumber(seller.wishlistCount, seller.totalWishlistCount, (seller as any).wishlist_count, (seller as any).total_wishlist_count);
    const hasAvatar = Boolean(avatarUrl && !avatarFailed);

    useEffect(() => {
        setKnockCount(getNumber(seller.knockCount, seller.knock_count));
    }, [seller.knockCount, seller.knock_count]);

    const handleKnock = useCallback(() => {
        const optimisticCount = knockCount + 1;
        setKnockCount(optimisticCount);

        void publicApiService.knockSeller(seller.id).catch((error) => {
            console.error('Failed to record seller knock:', error);
        });

        navigate(shopLink);
    }, [knockCount, navigate, seller.id, shopLink]);

    return (
        <article className={cn(
            "group relative overflow-hidden rounded-2xl border border-white/10 bg-[#111111] p-3 shadow-sm transition-colors duration-200 hover:border-white/20 hover:bg-[#151515]",
            className
        )}>
            <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-yellow-300 to-yellow-500 text-black shadow-inner">
                    {hasAvatar ? (
                        <img
                            src={getImageUrl(avatarUrl)}
                            alt={`${shopName} business photo`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() => setAvatarFailed(true)}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-base font-black">
                            {initials}
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-black tracking-tight text-white" title={shopName}>
                        {shopName}
                    </h3>
                    {seller.bio ? (
                        <p className="mt-1 max-h-10 overflow-hidden text-[11px] leading-5 text-white/55">
                            {seller.bio}
                        </p>
                    ) : (
                        <p className="mt-1 text-[11px] leading-5 text-white/35">Business profile</p>
                    )}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
                <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/45">
                        <Users className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide">Clients</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white">{clientCount}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/45">
                        <Heart className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide">Saved</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white">{wishlistCount}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/45">
                        <MousePointerClick className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide">Knocks</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white">{knockCount}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={handleKnock}
                className="mt-3 h-9 w-full rounded-xl border border-yellow-300/20 bg-yellow-300 text-xs font-black text-black transition-colors hover:bg-yellow-200 active:bg-yellow-400"
                aria-label={`Knock on ${shopName}`}
            >
                Knock
            </button>
        </article>
    );
};

export default memo(SellerBrandCard);
