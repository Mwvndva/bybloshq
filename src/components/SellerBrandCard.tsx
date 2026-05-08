import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Heart, MapPin, MousePointerClick, UserMinus, Users, Wifi } from 'lucide-react';
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

    return palettes[theme || 'black'] || palettes.black;
};

const SellerBrandCard = ({ seller, className, isBuyer, showUnfollow = false, isUnfollowing = false, onUnfollow, onClickCountChange }: SellerBrandCardProps) => {
    const navigate = useNavigate();
    const shopName = seller.shopName || seller.shop_name || 'Shop';
    const shopLink = isBuyer
        ? `/buyer/shop/${encodeURIComponent(shopName)}`
        : `/shop/${encodeURIComponent(shopName)}`;
    const avatarUrl = seller.avatarUrl || (seller as any).avatar_url;
    const initials = useMemo(() => getInitials(shopName, seller.fullName), [shopName, seller.fullName]);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [knockCount, setKnockCount] = useState(getNumber(seller.knockCount, seller.knock_count));
    const palette = useMemo(() => getThemePalette(seller.theme), [seller.theme]);
    const isPhysicalShop = Boolean(
        seller.hasPhysicalShop ||
        seller.physicalAddress ||
        (seller as any).physical_address ||
        hasValidCoordinate(seller.latitude, seller.longitude)
    );

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

    return (
        <article className={cn(
            "group relative overflow-hidden rounded-2xl border bg-[#111111] p-3 shadow-sm transition-colors duration-200 hover:bg-[#151515]",
            className
        )}
            style={{
                borderColor: palette.border,
                boxShadow: `0 16px 40px ${palette.accentSoft}`
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
                        <div className="flex h-full w-full items-center justify-center text-base font-black">
                            {initials}
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-sm font-black tracking-tight text-white" title={shopName}>
                            {shopName}
                        </h3>
                        <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/85"
                            style={{
                                borderColor: palette.border,
                                backgroundColor: palette.accentSoft,
                                boxShadow: `0 0 16px ${palette.accentSoft}`
                            }}
                            title={isPhysicalShop ? 'Physical shop' : 'Online shop'}
                        >
                            {isPhysicalShop ? <MapPin className="h-2.5 w-2.5" /> : <Wifi className="h-2.5 w-2.5" />}
                            {isPhysicalShop ? 'Physical' : 'Online'}
                        </span>
                    </div>
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
                    <p className="text-sm font-black tabular-nums" style={{ color: palette.accent }}>{clientCount}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/45">
                        <Heart className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide">Saved</span>
                    </div>
                    <p className="text-sm font-black tabular-nums" style={{ color: palette.accent }}>{wishlistCount}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
                    <div className="mx-auto mb-0.5 flex items-center justify-center gap-1 text-white/45">
                        <MousePointerClick className="h-3 w-3" />
                        <span className="text-[9px] font-semibold uppercase tracking-wide">Clicks</span>
                    </div>
                    <p className="text-sm font-black tabular-nums" style={{ color: palette.accent }}>{knockCount}</p>
                </div>
            </div>

            <div className={cn("mt-3 grid gap-2", showUnfollow ? "grid-cols-[1fr_auto]" : "grid-cols-1")}>
                <button
                    type="button"
                    onClick={handleKnock}
                    className="group/open relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border text-xs font-black text-white shadow-sm backdrop-blur transition duration-200 hover:brightness-110 active:brightness-95"
                    style={{
                        background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, ${palette.accentSoft} 46%, rgba(255,255,255,0.06) 100%)`,
                        borderColor: palette.border,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 30px ${palette.accentSoft}, 0 0 0 1px ${palette.border}`,
                        color: '#FFFFFF'
                    }}
                    aria-label={`Open ${shopName}`}
                >
                    <span
                        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/20 opacity-0 blur-sm transition duration-500 group-hover/open:left-full group-hover/open:opacity-100"
                    />
                    <span
                        className="pointer-events-none absolute inset-x-3 top-0 h-px"
                        style={{ background: `linear-gradient(90deg, transparent, ${palette.accent}, transparent)` }}
                    />
                    <span
                        className="flex h-5 w-5 items-center justify-center rounded-full"
                        style={{
                            backgroundColor: palette.accent,
                            color: palette.buttonText,
                            boxShadow: `0 0 18px ${palette.accentSoft}`
                        }}
                    >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="relative">Open</span>
                </button>

                {showUnfollow && onUnfollow && (
                    <button
                        type="button"
                        disabled={isUnfollowing}
                        onClick={handleUnfollow}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-red-300/25 bg-red-400/10 px-3 text-[11px] font-black text-red-200 transition duration-200 hover:bg-red-400/16 active:bg-red-400/20 disabled:cursor-wait disabled:opacity-60"
                        aria-label={`Unfollow ${shopName}`}
                    >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span>{isUnfollowing ? '...' : 'Unfollow'}</span>
                    </button>
                )}
            </div>
        </article>
    );
};

export default memo(SellerBrandCard);
