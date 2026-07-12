import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Store, Users } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';
import { SHOP_DEFAULT_BANNER_STYLE, type ShopSeller } from './shopPage.shared';

interface ShopHeroProps {
  sellerInfo: ShopSeller | null;
  bannerLoadFailed: boolean;
  setBannerLoadFailed: (v: boolean) => void;
  showSellerAvatar: boolean;
  setAvatarLoadFailed: (v: boolean) => void;
  sellerInitials: string;
}

export function ShopHero({ sellerInfo, bannerLoadFailed, setBannerLoadFailed, showSellerAvatar, setAvatarLoadFailed, sellerInitials }: ShopHeroProps) {
  const location = useLocation();
  return (
    <>
      {/* Modern Hero Section */}
      <div className="relative h-[22dvh] min-h-[180px] sm:h-[44dvh] sm:min-h-[340px] lg:h-[50dvh] w-full overflow-hidden">
        {sellerInfo?.bannerImage && !bannerLoadFailed ? (
          <img
            src={getImageUrl(sellerInfo.bannerImage)}
            alt={`${sellerInfo.shopName || 'Shop'} Banner`}
            className="h-full w-full object-cover object-center sm:animate-slow-zoom"
            onError={(e) => {
              console.error('Error loading banner image:', e);
              setBannerLoadFailed(true);
            }}
          />
        ) : (
          <div className="absolute inset-0" style={SHOP_DEFAULT_BANNER_STYLE} aria-hidden="true">
            <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.82)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.82)_1px,transparent_1px)] [background-size:44px_44px]" />
            <div className="absolute right-[-4rem] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full border bg-white/[0.06] sm:h-96 sm:w-96" style={{ borderColor: 'rgba(var(--theme-accent-rgb), 0.24)' }} />
            <div
              className="absolute left-6 top-14 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white shadow-sm backdrop-blur-sm sm:left-10 sm:top-20 sm:px-4 sm:py-1.5 sm:text-xs"
              style={{
                backgroundColor: 'rgba(var(--theme-accent-rgb), 0.22)',
                borderColor: 'rgba(var(--theme-accent-rgb), 0.34)'
              }}
            >
              Byblos Shop
            </div>
          </div>
        )}

        {/* Sleek Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10 transition-opacity duration-300" />

        {/* Back to Home/Dashboard Button - Top Left */}
        <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20">
          <Button
            asChild
            className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 shadow-lg px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-medium transition-all duration-300 flex items-center group"
          >
            <Link to={location.pathname.startsWith('/buyer') ? "/buyer/dashboard" : "/"} className="flex items-center gap-1 sm:gap-2">
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">
                {location.pathname.startsWith('/buyer') ? "Back to Dashboard" : "Back to Home"}
              </span>
              <span className="sm:hidden">
                {location.pathname.startsWith('/buyer') ? "Dashboard" : "Home"}
              </span>
            </Link>
          </Button>
        </div>

        {/* Hero Content - Centered */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-4 pt-10 sm:pt-14">
          {/* Shop Name at the top */}
          <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-none drop-shadow-2xl break-words max-w-2xl px-4">
            {sellerInfo?.shopName || 'Shop'}
          </h1>

          {/* Bio at the middle if available */}
          {sellerInfo?.bio && (
            <p className="mt-2 max-w-xl text-[10px] sm:text-sm md:text-base text-white/90 leading-relaxed break-words max-h-[3rem] sm:max-h-none overflow-hidden drop-shadow px-4">
              {sellerInfo.bio}
            </p>
          )}

          {/* Followers, Shop Type, and Social Links at the bottom */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-white font-medium text-[9px] sm:text-xs">
            {/* Followers (Icon and count only) */}
            <span className="flex items-center gap-1 backdrop-blur-sm bg-black/35 px-2.5 py-1 rounded-full border border-white/10 shadow-lg" title="Followers">
              <Users className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              <span className="font-bold">{sellerInfo?.clientCount || 0}</span>
            </span>

            {/* Shop type (online or physical) */}
            <span className="flex items-center gap-1 backdrop-blur-sm bg-black/35 px-2.5 py-1 rounded-full border border-white/10 shadow-lg" title="Shop Type">
              <Store className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              <span className="font-bold">
                {(sellerInfo && (sellerInfo.physicalAddress || (sellerInfo.latitude && sellerInfo.longitude && sellerInfo.latitude !== 0))) ? 'Physical' : 'Online'}
              </span>
            </span>

            {/* Instagram / TikTok / Facebook Redirect Buttons (Icons only) */}
            {sellerInfo?.instagramLink && (
              <a
                href={sellerInfo.instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                className="flex items-center justify-center p-1.5 rounded-full bg-black/35 border border-white/10 text-white/85 hover:text-white hover:bg-white/15 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
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
                className="flex items-center justify-center p-1.5 rounded-full bg-black/35 border border-white/10 text-white/85 hover:text-white hover:bg-white/15 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
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
                className="flex items-center justify-center p-1.5 rounded-full bg-black/35 border border-white/10 text-white/85 hover:text-white hover:bg-white/15 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            )}
          </div>
        </div>

      </div>

      {/* Business Profile Photo - Bottom and Center of the Banner, outside the overflow-hidden parent to prevent clipping */}
      <div className="relative z-30 flex justify-center -mt-10 sm:-mt-16 pointer-events-none">
        <div className="h-20 w-20 sm:h-32 sm:w-32 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-yellow-300 to-yellow-500 border-4 border-[var(--theme-bg-color)] shadow-2xl overflow-hidden flex items-center justify-center text-2xl sm:text-4xl font-black text-black pointer-events-auto">
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

    </>
  );
}
