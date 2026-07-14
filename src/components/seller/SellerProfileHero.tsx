import { useState } from 'react';
import { ImagePlus, Link2, TrendingUp, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { SellerMediaEditDialog } from './SellerMediaEditDialog';

interface SellerProfileHeroProps {
  sellerProfile: SellerProfile;
  followers: number;
  sales: number;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  canEdit?: boolean;
}

/**
 * Shop identity hero for the seller dashboard: banner, the business profile
 * photo centered in a circular frame themed to the shop's colour, a "Shop link"
 * action, the shop name, bio, and follower / sales stats. When editable, an
 * Edit button opens a compact modal for updating the photo and banner (kept off
 * the card so the hero never grows).
 */
export function SellerProfileHero({ sellerProfile, followers, sales, shopUsername, onCopyShopLink, canEdit }: SellerProfileHeroProps) {
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const shopName = sellerProfile?.shopName?.trim() || 'Your shop';
  const banner = sellerProfile?.bannerImage;
  const avatar = sellerProfile?.avatarUrl;
  const bio = sellerProfile?.bio?.trim();
  const initial = shopName.charAt(0).toUpperCase();

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
      {/* Banner */}
      <div className="relative h-32 w-full sm:h-40 lg:h-48">
        {banner ? (
          <img src={banner} alt={`${shopName} banner`} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: 'linear-gradient(135deg, rgba(var(--theme-accent-rgb, 245, 158, 11), 0.38), rgba(var(--theme-accent-rgb, 245, 158, 11), 0.06))' }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {canEdit && (
          <button
            type="button"
            onClick={() => setIsEditingMedia(true)}
            aria-label="Edit business photo & banner"
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black shadow-[0_8px_22px_rgba(0,0,0,0.5)] transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className="flex flex-col items-center px-4 pb-5 sm:pb-6">
        {/* Business profile photo — circular frame themed to the shop colour. */}
        <div
          className="relative z-10 -mt-12 h-24 w-24 overflow-hidden rounded-full bg-[#141414] shadow-lg sm:-mt-14 sm:h-28 sm:w-28"
          style={{
            border: '4px solid var(--theme-accent, #f5c518)',
            boxShadow: '0 0 0 5px rgba(var(--theme-accent-rgb, 245, 158, 11), 0.18), 0 12px 30px rgba(0,0,0,0.55)'
          }}
        >
          {avatar ? (
            <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl font-black"
              style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
            >
              {initial}
            </div>
          )}
        </div>

        {/* Shop link — centered between the photo and the shop name. */}
        {shopUsername && onCopyShopLink && (
          <button
            type="button"
            onClick={() => onCopyShopLink()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Shop link
          </button>
        )}

        {/* Shop name */}
        <h2 className="mt-3 text-center text-xl font-black tracking-tight text-white sm:text-2xl [overflow-wrap:anywhere]">
          {shopName}
        </h2>

        {/* Shop bio — sits directly below the shop name. */}
        {bio && (
          <p className="mt-1.5 max-w-md text-center text-xs font-medium leading-5 text-white/60 sm:text-sm [overflow-wrap:anywhere]">
            {bio}
          </p>
        )}

        {/* Followers (left) + Sales (right) */}
        <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-3">
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <Users className="h-4 w-4 shrink-0" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            <div className="text-center">
              <p className="text-lg font-black leading-none text-white">{Number(followers || 0).toLocaleString()}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Followers</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <TrendingUp className="h-4 w-4 shrink-0" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            <div className="text-center">
              <p className="text-lg font-black leading-none text-white">{formatCurrency(sales || 0)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Sales</p>
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <SellerMediaEditDialog
          open={isEditingMedia}
          onOpenChange={setIsEditingMedia}
          avatarUrl={avatar}
          bannerUrl={banner}
          fallbackInitial={initial}
        />
      )}
    </div>
  );
}
