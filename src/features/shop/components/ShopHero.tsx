import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getImageUrl } from '@/shared/utils/formatting';
import { socialUrl, coordsMapUrl } from '../utils/socialLinks';
import instagramLogo from '@/assets/social/instagram.png';
import tiktokLogo from '@/assets/social/tiktok.png';
import type { ShopSeller } from '../utils/shopPage.shared';

interface ShopHeroProps {
  sellerInfo: ShopSeller | null;
  showSellerAvatar: boolean;
  setAvatarLoadFailed: (v: boolean) => void;
  sellerInitials: string;
}

export function ShopHero({ sellerInfo, showSellerAvatar, setAvatarLoadFailed, sellerInitials }: ShopHeroProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isBuyer = location.pathname.startsWith('/buyer');

  // A buyer opens a shop from the Shops tab (/buyer/dashboard), non-buyers go home.
  const handleBack = () => {
    navigate(isBuyer ? '/buyer/dashboard' : '/');
  };

  const instagramHref = socialUrl('instagram', sellerInfo?.instagramLink);
  const tiktokHref = socialUrl('tiktok', sellerInfo?.tiktokLink);
  const mapHref = coordsMapUrl(sellerInfo?.latitude, sellerInfo?.longitude);

  return (
    <header className="relative w-full max-w-4xl mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:pt-6 sm:pb-4">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <Button
          type="button"
          onClick={handleBack}
          variant="ghost"
          size="sm"
          className="rounded-full px-3 py-1.5 text-xs font-bold text-[var(--byblos-text)]/80 hover:text-[var(--byblos-text)] hover:bg-[var(--byblos-surface-soft)] transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isBuyer ? 'Shops' : 'Back'}</span>
        </Button>
      </div>

      {/* Business Profile Identity */}
      <div className="flex flex-col items-center text-center">
        {/* Business Profile Photo Avatar */}
        <div className="relative mb-3">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-4 border-yellow-400 bg-[var(--byblos-surface-soft)] shadow-xl flex items-center justify-center text-2xl sm:text-3xl font-black text-[var(--byblos-text)]">
            {showSellerAvatar ? (
              <img
                src={getImageUrl(sellerInfo?.avatarUrl || '')}
                alt={`${sellerInfo?.shopName || 'Shop'} avatar`}
                className="h-full w-full object-cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <span>{sellerInitials}</span>
            )}
          </div>
        </div>

        {/* Shop Name */}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-[var(--byblos-text)] max-w-xl px-2">
          {sellerInfo?.shopName || 'Shop'}
        </h1>

        {/* Shop Bio */}
        {sellerInfo?.bio && (
          <p className="mt-1 max-w-lg text-xs sm:text-sm font-medium text-[var(--byblos-muted)] leading-relaxed px-4">
            {sellerInfo.bio}
          </p>
        )}

        {/* Action row: Location, Instagram, TikTok — each shown only when available. */}
        {(mapHref || instagramHref || tiktokHref) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Location"
                aria-label="Open shop location on the map"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--byblos-surface-soft)] text-[var(--byblos-text)] border border-[var(--byblos-border)] shadow-sm transition-all hover:opacity-80"
              >
                <MapPin className="h-4 w-4 text-yellow-500" />
                <span>Location</span>
              </a>
            )}
            {instagramHref && (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                aria-label="Instagram"
                className="inline-flex items-center justify-center p-1.5 rounded-full bg-[var(--byblos-surface-soft)] hover:opacity-80 border border-[var(--byblos-border)] transition-all shadow-sm"
              >
                <img src={instagramLogo} alt="" className="h-5 w-5 object-contain" />
              </a>
            )}
            {tiktokHref && (
              <a
                href={tiktokHref}
                target="_blank"
                rel="noopener noreferrer"
                title="TikTok"
                aria-label="TikTok"
                className="inline-flex items-center justify-center p-1.5 rounded-full bg-[var(--byblos-surface-soft)] hover:opacity-80 border border-[var(--byblos-border)] transition-all shadow-sm"
              >
                <img src={tiktokLogo} alt="" className="h-5 w-5 object-contain" />
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
