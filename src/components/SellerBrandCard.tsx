import { memo, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, MousePointerClick, Store, UserMinus, Users, Wifi } from 'lucide-react';
import { cn, getImageUrl } from '@/lib/utils';
import { publicApiService, Seller } from '@/api/publicApi';

interface SellerBrandCardProps {
    seller: Seller;
    className?: string;
    isBuyer?: boolean;
    showUnfollow?: boolean;
    isUnfollowing?: boolean;
    onUnfollow?: (seller: Seller) => void;
    onClickCountChange?: (seller: Seller, clickCount: number) => void;
}

const getNumber = (...values: unknown[]) => {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const hasValidCoordinate = (latitude?: number, longitude?: number) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
};

const getThemePalette = (theme?: string) => {
    const palettes: Record<string, { accent: string; accentSoft: string; border: string; buttonText: string; avatarGradient: string }> = {
        default: {
            accent: '#F8FAFC',
            accentSoft: 'rgba(248,250,252,0.1)',
            border: 'rgba(248,250,252,0.22)',
            buttonText: '#111111',
            avatarGradient: 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 100%)'
        },
        black: {
            accent: '#FFFFFF',
            accentSoft: 'rgba(255,255,255,0.08)',
            border: 'rgba(255,255,255,0.18)',
            buttonText: '#111111',
            avatarGradient: 'linear-gradient(135deg, #3F3F46 0%, #050505 100%)'
        },
        pink: {
            accent: '#F472B6',
            accentSoft: 'rgba(244,114,182,0.12)',
            border: 'rgba(244,114,182,0.35)',
            buttonText: '#190712',
            avatarGradient: 'linear-gradient(135deg, #F9A8D4 0%, #DB2777 100%)'
        },
        orange: {
            accent: '#FB923C',
            accentSoft: 'rgba(251,146,60,0.12)',
            border: 'rgba(251,146,60,0.35)',
            buttonText: '#1E0B00',
            avatarGradient: 'linear-gradient(135deg, #FDBA74 0%, #EA580C 100%)'
        },
        green: {
            accent: '#34D399',
            accentSoft: 'rgba(52,211,153,0.12)',
            border: 'rgba(52,211,153,0.35)',
            buttonText: '#04140E',
            avatarGradient: 'linear-gradient(135deg, #86EFAC 0%, #059669 100%)'
        },
        red: {
            accent: '#F87171',
            accentSoft: 'rgba(248,113,113,0.12)',
            border: 'rgba(248,113,113,0.35)',
            buttonText: '#1F0505',
            avatarGradient: 'linear-gradient(135deg, #FCA5A5 0%, #DC2626 100%)'
        },
        yellow: {
            accent: '#FACC15',
            accentSoft: 'rgba(250,204,21,0.14)',
            border: 'rgba(250,204,21,0.38)',
            buttonText: '#161000',
            avatarGradient: 'linear-gradient(135deg, #FDE68A 0%, #EAB308 100%)'
        },
        brown: {
            accent: '#B45309',
            accentSoft: 'rgba(180,83,9,0.14)',
            border: 'rgba(180,83,9,0.38)',
            buttonText: '#FFF7ED',
            avatarGradient: 'linear-gradient(135deg, #D97706 0%, #78350F 100%)'
        }
    };

    return palettes[theme || 'default'] || palettes.default;
};

const SellerBrandCard = ({ seller, className, isBuyer, showUnfollow = false, isUnfollowing = false, onUnfollow, onClickCountChange }: SellerBrandCardProps) => {
    const navigate = useNavigate();
    const shopName = seller.shopName || seller.shop_name || 'Shop';
    const shopLink = isBuyer
        ? `/buyer/shop/${encodeURIComponent(shopName)}`
        : `/${encodeURIComponent(shopName)}`;
    const avatarUrl = seller.avatarUrl || (seller as any).avatar_url;
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [knockCount, setKnockCount] = useState(getNumber(seller.knockCount, seller.knock_count));
    const palette = useMemo(() => getThemePalette(seller.theme), [seller.theme]);
    const isPhysicalShop = Boolean(
        seller.hasPhysicalShop ||
        seller.physicalAddress ||
        (seller as any).physical_address ||
        hasValidCoordinate(seller.latitude, seller.longitude)
    );
    const shopModeStyle = isPhysicalShop
        ? {
            label: 'Physical',
            border: 'rgba(248,113,113,0.44)',
            background: 'rgba(248,113,113,0.14)',
            color: '#B91C1C',
            shadow: 'rgba(248,113,113,0.18)'
        }
        : {
            label: 'Online',
            border: 'rgba(52,211,153,0.44)',
            background: 'rgba(52,211,153,0.14)',
            color: '#047857',
            shadow: 'rgba(52,211,153,0.18)'
        };

    const clientCount = getNumber(seller.clientCount, seller.client_count);
    const wishlistCount = getNumber(seller.wishlistCount, seller.totalWishlistCount, (seller as any).wishlist_count, (seller as any).total_wishlist_count);
    const hasAvatar = Boolean(avatarUrl && !avatarFailed);

    useEffect(() => {
        setKnockCount(getNumber(seller.knockCount, seller.knock_count));
    }, [seller.knockCount, seller.knock_count]);

    const handleKnock = useCallback(() => {
        const optimisticCount = knockCount + 1;
        setKnockCount(optimisticCount);
        onClickCountChange?.(seller, optimisticCount);

        void publicApiService.knockSeller(seller.id).then((result) => {
            if (typeof result.knockCount !== 'number') return;
            setKnockCount(result.knockCount);
            onClickCountChange?.(seller, result.knockCount);
        }).catch((error) => {
            console.error('Failed to record seller knock:', error);
        });

        navigate(shopLink);
    }, [knockCount, navigate, onClickCountChange, seller, shopLink]);

    const handleUnfollow = useCallback(() => {
        if (!onUnfollow || isUnfollowing) return;
        onUnfollow(seller);
    }, [isUnfollowing, onUnfollow, seller]);

    const handleCardKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleKnock();
    }, [handleKnock]);

    return (
        <article className={cn(
            "group relative cursor-pointer overflow-hidden rounded-2xl border bg-black p-3 shadow-sm transition-colors duration-200 hover:bg-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
            className
        )}
            role="link"
            tabIndex={0}
            onClick={handleKnock}
            onKeyDown={handleCardKeyDown}
            aria-label={`Open ${shopName}`}
            style={{
                borderColor: palette.border,
                boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 24px ${palette.accentSoft}`
            }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border text-black shadow-inner"
                    style={{
                        background: palette.avatarGradient,
                        borderColor: palette.border
                    }}
                >
                    {hasAvatar ? (
                        <img
                            src={getImageUrl(avatarUrl)}
                            alt={`${shopName} business photo`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() => setAvatarFailed(true)}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Store className="h-6 w-6 text-white" strokeWidth={1.8} />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-sm font-black tracking-tight text-white" title={shopName}>
                            {shopName}
                        </h3>
                        <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                            style={{
                                borderColor: shopModeStyle.border,
                                backgroundColor: shopModeStyle.background,
                                boxShadow: `0 0 16px ${shopModeStyle.shadow}`,
                                color: shopModeStyle.color
                            }}
                            title={isPhysicalShop ? 'Physical shop' : 'Online shop'}
                        >
                            {isPhysicalShop ? <MapPin className="h-2.5 w-2.5" /> : <Wifi className="h-2.5 w-2.5" />}
                            {shopModeStyle.label}
                        </span>
                    </div>
                    {seller.bio ? (
                        <p className="mt-1 max-h-10 overflow-hidden text-[11px] leading-5 text-white/80">
                            {seller.bio}
                        </p>
                    ) : (
                        <p className="mt-1 text-[11px] leading-5 text-white/70">Business profile</p>
                    )}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
                <div className="px-2 py-1.5 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/70">
                        <Users className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-white">Followers</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white">{clientCount}</p>
                </div>
                <div className="px-2 py-1.5 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/70">
                        <Heart className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-white">Saved</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white">{wishlistCount}</p>
                </div>
                <div className="px-2 py-1.5 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/70">
                        <MousePointerClick className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-white">Clicks</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white">{knockCount}</p>
                </div>
            </div>

            {showUnfollow && onUnfollow && (
                <div className="mt-3 flex justify-end">
                    <button
                        type="button"
                        disabled={isUnfollowing}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleUnfollow();
                        }}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-3 text-[11px] font-black text-white transition duration-200 hover:bg-red-500/25 active:bg-red-500/30 disabled:cursor-wait disabled:opacity-60"
                        aria-label={`Unfollow ${shopName}`}
                    >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span>{isUnfollowing ? '...' : 'Unfollow'}</span>
                    </button>
                </div>
            )}
        </article>
    );
};

export default memo(SellerBrandCard);
