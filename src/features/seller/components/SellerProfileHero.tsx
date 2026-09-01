import { useState } from 'react';
import { Link2, Pencil } from 'lucide-react';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import { SellerMediaEditDialog } from './SellerMediaEditDialog';

interface SellerProfileHeroProps {
  sellerProfile: SellerProfile;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  canEdit?: boolean;
}

/**
 * Shop identity hero for the seller dashboard: compact accent header,
 * the business profile photo centered in a circular frame with a pencil
 * edit overlay, a "Shop link" action, the shop name, and bio.
 */
export function SellerProfileHero({ sellerProfile, shopUsername, onCopyShopLink, canEdit }: SellerProfileHeroProps) {
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const shopName = sellerProfile?.shopName?.trim() || 'Your shop';
  const avatar = sellerProfile?.avatarUrl;
  const bio = sellerProfile?.bio?.trim();
  const initial = shopName.charAt(0).toUpperCase();

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
      {/* Shop Accent Header */}
      <div className="relative h-20 w-full sm:h-28 lg:h-32">
        <div
          className="h-full w-full"
          style={{ background: 'linear-gradient(135deg, rgba(var(--theme-accent-rgb, 245, 158, 11), 0.38), rgba(var(--theme-accent-rgb, 245, 158, 11), 0.06))' }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="flex flex-col items-center px-4 pb-5 sm:pb-6">
        {/* Business profile photo container with lower-right pencil overlay */}
        <div className="relative z-10 -mt-10 sm:-mt-14">
          <div
            className="h-20 w-20 overflow-hidden rounded-full bg-[#141414] shadow-lg sm:h-24 sm:w-24"
            style={{
              border: '4px solid var(--theme-accent, #f5c518)',
              boxShadow: '0 0 0 4px rgba(var(--theme-accent-rgb, 245, 158, 11), 0.18), 0 10px 25px rgba(0,0,0,0.55)'
            }}
          >
            {avatar ? (
              <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-2xl sm:text-3xl font-black"
                style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
              >
                {initial}
              </div>
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditingMedia(true)}
              aria-label="Edit profile photo"
              title="Edit profile photo"
              className="absolute bottom-0 right-0 z-20 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-yellow-400 text-black shadow-lg hover:bg-yellow-300 active:scale-95 transition-transform border-2 border-[#0a0a0a]"
            >
              <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current" />
            </button>
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
      </div>

      {canEdit && (
        <SellerMediaEditDialog
          open={isEditingMedia}
          onOpenChange={setIsEditingMedia}
          avatarUrl={avatar}
          fallbackInitial={initial}
        />
      )}
    </div>
  );
}
