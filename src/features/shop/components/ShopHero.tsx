import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { ArrowLeft, Store, Users } from 'lucide-react';
import { getImageUrl } from '@/shared/utils/formatting';
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

  const isPhysical = Boolean(
    sellerInfo &&
      (sellerInfo.physicalAddress || (sellerInfo.latitude && sellerInfo.longitude && sellerInfo.latitude !== 0))
  );

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

        {/* Metadata Pill Row (Followers, Shop Type, Social Links) */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          {/* Followers */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--byblos-surface-soft)] text-[var(--byblos-text)] border border-[var(--byblos-border)] shadow-sm" title="Followers">
            <Users className="h-3.5 w-3.5 text-yellow-500" />
            <span>{sellerInfo?.clientCount || 0} followers</span>
          </span>

          {/* Shop Type */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--byblos-surface-soft)] text-[var(--byblos-text)] border border-[var(--byblos-border)] shadow-sm" title="Shop Type">
            <Store className="h-3.5 w-3.5 text-yellow-500" />
            <span>{isPhysical ? 'Physical Shop' : 'Online Shop'}</span>
          </span>

          {/* Social Links */}
          {sellerInfo?.instagramLink && (
            <a
              href={sellerInfo.instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Instagram"
              className="p-1.5 rounded-full bg-[var(--byblos-surface-soft)] hover:opacity-80 border border-[var(--byblos-border)] text-[var(--byblos-text)] transition-all shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          )}
          {sellerInfo?.tiktokLink && (
            <a
              href={sellerInfo.tiktokLink}
              target="_blank"
              rel="noopener noreferrer"
              title="TikTok"
              className="p-1.5 rounded-full bg-[var(--byblos-surface-soft)] hover:opacity-80 border border-[var(--byblos-border)] text-[var(--byblos-text)] transition-all shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </svg>
            </a>
          )}
          {sellerInfo?.facebookLink && (
            <a
              href={sellerInfo.facebookLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Facebook"
              className="p-1.5 rounded-full bg-[var(--byblos-surface-soft)] hover:opacity-80 border border-[var(--byblos-border)] text-[var(--byblos-text)] transition-all shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
