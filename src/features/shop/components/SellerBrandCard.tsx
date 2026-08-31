import { memo, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Store, UserMinus } from 'lucide-react';
import { cn, getImageUrl } from '@/shared/utils/formatting';
import { useKnockSellerMutation } from '@/features/shop/hooks/useShopQueries';
import type { ApiPublicSeller } from '@/shared/types/api/seller';
import instagramLogo from '@/assets/social/instagram.png';
import tiktokLogo from '@/assets/social/tiktok.png';

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

const hasValidCoordinate = (latitude?: number, longitude?: number) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
};

/** Normalise a stored handle/URL into an openable social link. */
const socialUrl = (kind: 'instagram' | 'tiktok', value?: string | null) => {
    const raw = (value || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const handle = raw.replace(/^@/, '');
    return kind === 'instagram'
        ? `https://instagram.com/${handle}`
        : `https://www.tiktok.com/@${handle}`;
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
    const hasCoords = hasValidCoordinate(seller.latitude, seller.longitude);
    const mapHref = hasCoords ? `https://www.google.com/maps?q=${seller.latitude},${seller.longitude}` : null;

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
                'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-black shadow-sm transition-colors duration-200 hover:bg-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
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
            {/* Top: business photo — full width, flush to the top edge, fixed aspect to avoid layout shift. */}
            <div className="aspect-square w-full overflow-hidden" style={{ background: palette.avatarGradient }}>
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

            {/* Bottom: name, social buttons (vertical, left), then a location button pinned to the bottom. */}
            <div className="flex flex-1 flex-col p-3">
                <h3 className="truncate text-sm font-black tracking-tight text-white" title={shopName}>
                    {shopName}
                </h3>

                {(instagramHref || tiktokHref) && (
                    <div className="mt-2 flex flex-col items-start gap-1.5">
                        {instagramHref && (
                            <a
                                href={instagramHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={stop}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/12"
                                aria-label={`${shopName} on Instagram`}
                            >
                                <img src={instagramLogo} alt="" className="h-4 w-4 object-contain" />
                                Instagram
                            </a>
                        )}
                        {tiktokHref && (
                            <a
                                href={tiktokHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={stop}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/12"
                                aria-label={`${shopName} on TikTok`}
                            >
                                <img src={tiktokLogo} alt="" className="h-4 w-4 object-contain" />
                                TikTok
                            </a>
                        )}
                    </div>
                )}

                {mapHref && (
                    <a
                        href={mapHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={stop}
                        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/12"
                        aria-label={`${shopName} location on the map`}
                    >
                        <MapPin className="h-3.5 w-3.5" />
                        Location
                    </a>
                )}

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
