import { memo, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Store, UserMinus } from 'lucide-react';
import { cn, getImageUrl } from '@/shared/utils/formatting';
import { useKnockSellerMutation } from '@/features/shop/hooks/useShopQueries';
import type { ApiPublicSeller } from '@/shared/types/api/seller';
import { socialUrl, coordsMapUrl } from '../utils/socialLinks';
import { SocialButtons } from './SocialButtons';

interface SellerBrandCardProps {
    seller: ApiPublicSeller;
    className?: string;
    isBuyer?: boolean;
    showUnfollow?: boolean;
    isUnfollowing?: boolean;
    onUnfollow?: (seller: ApiPublicSeller) => void;
    onClickCountChange?: (seller: ApiPublicSeller, clickCount: number) => void;
}

const getNumber = (...values: unknown[]) => {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const getThemePalette = (theme?: string) => {
    const palettes: Record<string, { border: string; accentSoft: string; avatarGradient: string }> = {
        default: { border: 'rgba(248,250,252,0.22)', accentSoft: 'rgba(248,250,252,0.1)', avatarGradient: 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 100%)' },
        black: { border: 'rgba(255,255,255,0.18)', accentSoft: 'rgba(255,255,255,0.08)', avatarGradient: 'linear-gradient(135deg, #3F3F46 0%, #050505 100%)' },
        pink: { border: 'rgba(244,114,182,0.35)', accentSoft: 'rgba(244,114,182,0.12)', avatarGradient: 'linear-gradient(135deg, #F9A8D4 0%, #DB2777 100%)' },
        orange: { border: 'rgba(251,146,60,0.35)', accentSoft: 'rgba(251,146,60,0.12)', avatarGradient: 'linear-gradient(135deg, #FDBA74 0%, #EA580C 100%)' },
        green: { border: 'rgba(52,211,153,0.35)', accentSoft: 'rgba(52,211,153,0.12)', avatarGradient: 'linear-gradient(135deg, #86EFAC 0%, #059669 100%)' },
        red: { border: 'rgba(248,113,113,0.35)', accentSoft: 'rgba(248,113,113,0.12)', avatarGradient: 'linear-gradient(135deg, #FCA5A5 0%, #DC2626 100%)' },
        yellow: { border: 'rgba(250,204,21,0.38)', accentSoft: 'rgba(250,204,21,0.14)', avatarGradient: 'linear-gradient(135deg, #FDE68A 0%, #EAB308 100%)' },
        brown: { border: 'rgba(180,83,9,0.38)', accentSoft: 'rgba(180,83,9,0.14)', avatarGradient: 'linear-gradient(135deg, #D97706 0%, #78350F 100%)' },
    };
    return palettes[theme || 'default'] || palettes.default;
};

const SellerBrandCard = ({ seller, className, isBuyer, showUnfollow = false, isUnfollowing = false, onUnfollow, onClickCountChange }: SellerBrandCardProps) => {
    const navigate = useNavigate();
    const knockSellerMutation = useKnockSellerMutation();
    const shopName = seller.shopName || seller.shop_name || 'Shop';
    const canonicalSlug = (seller.slug || seller.shopName || seller.shop_name || '') as string;
    const shopLink = isBuyer
        ? `/buyer/shop/${encodeURIComponent(canonicalSlug)}`
        : `/${encodeURIComponent(canonicalSlug)}`;
    const avatarUrl = String(seller.avatarUrl || (seller as unknown as Record<string, unknown>).avatar_url || '');
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [knockCount, setKnockCount] = useState(getNumber(seller.knockCount, seller.knock_count));
    const palette = useMemo(() => getThemePalette(seller.theme), [seller.theme]);
    const hasAvatar = Boolean(avatarUrl && !avatarFailed);

    const instagramHref = socialUrl('instagram', seller.instagramLink);
    const tiktokHref = socialUrl('tiktok', seller.tiktokLink);
    const mapHref = coordsMapUrl(seller.latitude, seller.longitude);

    useEffect(() => {
        setKnockCount(getNumber(seller.knockCount, seller.knock_count));
    }, [seller.knockCount, seller.knock_count]);

    const handleKnock = useCallback(() => {
        const optimisticCount = knockCount + 1;
        setKnockCount(optimisticCount);
        onClickCountChange?.(seller, optimisticCount);

        knockSellerMutation.mutate(seller.id, {
            onSuccess: (result) => {
                if (typeof result.knockCount !== 'number') return;
                setKnockCount(result.knockCount);
                onClickCountChange?.(seller, result.knockCount);
            },
            onError: (error) => {
                console.error('Failed to record seller knock:', error);
            },
        });

        navigate(shopLink);
    }, [knockCount, navigate, onClickCountChange, seller, shopLink, knockSellerMutation]);

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

    // Inner links must not trigger the card's navigation.
    const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

    return (
        <article
            className={cn(
                'group relative flex aspect-[4/5] cursor-pointer flex-col overflow-hidden rounded-2xl border bg-black shadow-sm transition-colors duration-200 hover:bg-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
                className,
            )}
            role="link"
            tabIndex={0}
            onClick={handleKnock}
            onKeyDown={handleCardKeyDown}
            aria-label={`Open ${shopName}`}
            style={{
                borderColor: palette.border,
                boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 24px ${palette.accentSoft}`,
            }}
        >
            {/* Top ~80%: business photo. */}
            <div className="h-[80%] w-full overflow-hidden" style={{ background: palette.avatarGradient }}>
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
                        <Store className="h-10 w-10 text-white/90" strokeWidth={1.6} />
                    </div>
                )}
            </div>

            {/* Bottom ~20%: shop name, then Instagram + TikTok + Location on one row,
                left-aligned. Location is disabled when the seller has no coordinates. */}
            <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-1 px-2 py-1.5">
                <h3 className="w-full truncate text-[11px] font-black tracking-tight text-white sm:text-xs" title={shopName}>
                    {shopName}
                </h3>

                <div className="flex items-center gap-1.5">
                    <SocialButtons instagramHref={instagramHref} tiktokHref={tiktokHref} shopName={shopName} size="sm" />
                    {mapHref ? (
                        <a
                            href={mapHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={stop}
                            aria-label={`${shopName} location on the map`}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--byblos-border,rgba(255,255,255,0.14))] bg-[var(--byblos-surface-soft,rgba(255,255,255,0.06))] p-1.5 shadow-sm transition-all hover:opacity-80"
                        >
                            <MapPin className="h-4 w-4 text-yellow-400" />
                        </a>
                    ) : (
                        <span
                            aria-label="Location not available"
                            aria-disabled="true"
                            className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/10 bg-white/[0.03] p-1.5 opacity-35"
                        >
                            <MapPin className="h-4 w-4 text-white/60" />
                        </span>
                    )}
                </div>

                {showUnfollow && onUnfollow && (
                    <button
                        type="button"
                        disabled={isUnfollowing}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleUnfollow();
                        }}
                        className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-3 text-[11px] font-black text-white transition duration-200 hover:bg-red-500/25 active:bg-red-500/30 disabled:cursor-wait disabled:opacity-60"
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
