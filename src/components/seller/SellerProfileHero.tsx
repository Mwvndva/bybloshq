import { TrendingUp, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { SellerProfile } from '@/features/auth/types/authTypes';

interface SellerProfileHeroProps {
  sellerProfile: SellerProfile;
  followers: number;
  sales: number;
}

/**
 * Shop identity hero for the seller dashboard: the seller's banner with the
 * business profile photo centered in a circular frame, the shop name below it,
 * and follower / sales stats. Replaces the old 6-metric analytics strip.
 */
export function SellerProfileHero({ sellerProfile, followers, sales }: SellerProfileHeroProps) {
  const shopName = sellerProfile?.shopName?.trim() || 'Your shop';
  const banner = sellerProfile?.bannerImage;
  const avatar = sellerProfile?.avatarUrl;
  const initial = shopName.charAt(0).toUpperCase();

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_18px_50px_rgba(17,17,17,0.08)]">
      {/* Banner */}
      <div className="relative h-32 w-full sm:h-40 lg:h-48">
        {banner ? (
          <img src={banner} alt={`${shopName} banner`} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: 'linear-gradient(135deg, rgba(var(--theme-accent-rgb, 245, 158, 11), 0.28), rgba(var(--theme-accent-rgb, 245, 158, 11), 0.04))' }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      </div>

      {/* Business profile photo — circular frame, centered, overlapping the banner.
          relative+z-10 keeps it above the positioned banner so its top half stays visible. */}
      <div className="flex flex-col items-center px-4 pb-5 sm:pb-6">
        <div className="relative z-10 -mt-12 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-stone-100 shadow-lg ring-1 ring-stone-200 sm:-mt-14 sm:h-28 sm:w-28">
          {avatar ? (
            <img src={avatar} alt={shopName} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl font-black"
              style={{ backgroundColor: 'var(--theme-button-bg, #facc15)', color: 'var(--theme-button-text, #000000)' }}
            >
              {initial}
            </div>
          )}
        </div>

        {/* Shop name */}
        <h2 className="mt-3 text-center text-xl font-black tracking-tight text-stone-950 sm:text-2xl [overflow-wrap:anywhere]">
          {shopName}
        </h2>

        {/* Followers (left) + Sales (right) */}
        <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-3">
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <Users className="h-4 w-4 shrink-0 text-stone-500" />
            <div className="text-center">
              <p className="text-lg font-black leading-none text-stone-950">{Number(followers || 0).toLocaleString()}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Followers</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="text-center">
              <p className="text-lg font-black leading-none text-stone-950">{formatCurrency(sales || 0)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Sales</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
