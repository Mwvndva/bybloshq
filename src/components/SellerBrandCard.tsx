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
    const palette = useMemo(() => getThemePalette(seller.theme), [seller.theme]);

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
                        <span className="text-[9px] font-semibold uppercase tracking-wide">Knocks</span>
                    </div>
                    <p className="text-sm font-black tabular-nums" style={{ color: palette.accent }}>{knockCount}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={handleKnock}
                className="mt-3 h-9 w-full rounded-xl border text-xs font-black transition duration-200 hover:brightness-110 active:brightness-95"
                style={{
                    backgroundColor: palette.accent,
                    borderColor: palette.border,
                    color: palette.buttonText
                }}
                aria-label={`Knock on ${shopName}`}
            >
                Knock
            </button>
        </article>
    );
};

export default memo(SellerBrandCard);
