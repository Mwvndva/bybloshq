import { useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Info, Package, X } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import type { Product } from '@/shared/types';
import { cn, formatCurrency, getImageUrl } from '@/shared/utils/formatting';
import { getProductCardThemeVars, getProductFlags, type ProductWithApiFields, type Theme } from '@/features/shop/utils/productCardUtils';
import { useWishlist } from '@/features/buyer/hooks/useWishlist';
import { useIsProductWishlisted } from '@/features/buyer/stores/wishlistStore';

interface ShopProductCardProps {
  product: Product;
  /** Tap the card body — add to bag (shop) or go to the shop with it pre-added (wishlist). */
  onTap: () => void;
  /** Shop context: the product is already in the bag → show the remove (x) control. */
  inBag?: boolean;
  onRemoveFromBag?: () => void;
  /** Wishlist context: a filled heart that removes the item from the wishlist. */
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}

/**
 * Minimal product card (spec §17): image, product name, price, description, and images button.
 * The card adopts the seller's shop theme — surface follows the shop's dark/light theme (--theme-*),
 * and the name/price/description/images carry the seller's accent colour (--product-card-accent).
 */
export function ShopProductCard({
  product,
  onTap,
  inBag = false,
  onRemoveFromBag,
  isWishlisted,
  onToggleWishlist,
}: ShopProductCardProps) {
  const [showDescription, setShowDescription] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const { addToWishlist, removeFromWishlist } = useWishlist();
  const isAutoWishlisted = useIsProductWishlisted(product.id);
  const wishlisted = isWishlisted !== undefined ? isWishlisted : isAutoWishlisted;

  const handleToggleWishlistClick = (e: MouseEvent) => {
    stop(e);
    if (onToggleWishlist) {
      onToggleWishlist();
    } else if (wishlisted) {
      removeFromWishlist(String(product.id));
    } else {
      addToWishlist(product);
    }
  };

  const { isSold } = getProductFlags(product as unknown as ProductWithApiFields);
  const image = product.image_url ? getImageUrl(product.image_url) : null;
  const theme = (product.seller?.theme as Theme) || 'default';
  const themeVars = getProductCardThemeVars(theme);

  // Extract all images array
  const productImages: string[] = [];
  if (product.image_url) {
    productImages.push(getImageUrl(product.image_url));
  }
  if (Array.isArray(product.images)) {
    product.images.forEach((img) => {
      if (typeof img === 'string' && img.trim()) {
        const fullUrl = getImageUrl(img);
        if (!productImages.includes(fullUrl)) productImages.push(fullUrl);
      }
    });
  } else if (typeof product.images === 'string' && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) {
        parsed.forEach((img) => {
          if (typeof img === 'string' && img.trim()) {
            const fullUrl = getImageUrl(img);
            if (!productImages.includes(fullUrl)) productImages.push(fullUrl);
          }
        });
      }
    } catch {
      // ignore
    }
  }

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <>
      <Card
        role="button"
        tabIndex={isSold ? -1 : 0}
        aria-label={isSold ? `${product.name} — sold` : `Add ${product.name} to bag`}
        aria-disabled={isSold}
        onClick={isSold ? undefined : onTap}
        onKeyDown={(e) => {
          if (isSold) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
        }}
        style={{
          ...themeVars,
          backgroundColor: 'var(--product-card-bg, var(--byblos-surface, #ffffff))',
          color: 'var(--product-card-text, var(--byblos-text, #0f0f0e))',
          borderColor: 'var(--product-card-border, var(--byblos-border, rgba(0, 0, 0, 0.1)))',
        }}
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-xl border transition-all duration-300 sm:rounded-2xl',
          isSold ? 'cursor-not-allowed opacity-70' : 'cursor-pointer sm:hover:-translate-y-1',
          inBag && 'ring-2 ring-[var(--product-card-accent,#f5c518)]',
        )}
      >
        {/* Image — full width, flush to the top. */}
        <div className="relative aspect-square w-full overflow-hidden bg-black/10 select-none">
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover pointer-events-none" loading="lazy" onContextMenu={(e) => e.preventDefault()} />
          ) : (
            <div className="flex h-full w-full items-center justify-center opacity-40"><Package className="h-8 w-8" /></div>
          )}

          {/* Sleek horizontal watermark banner running across the center */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center py-1 bg-black/35 backdrop-blur-[1px]">
            <p className="w-full text-center text-[10px] sm:text-xs font-normal uppercase tracking-widest text-white/80 drop-shadow-md truncate px-2 select-none">
              @{product.seller?.shopName || product.seller?.fullName || 'Shop'} • Byblos
            </p>
          </div>

          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-900">Sold</span>
            </div>
          )}

          {/* Heart button — top right on all products */}
          <button
            type="button"
            onClick={handleToggleWishlistClick}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={cn(
              'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-95',
              wishlisted
                ? 'bg-white/95 text-red-500 shadow-md dark:bg-zinc-900/90'
                : 'bg-white/90 text-slate-400 hover:text-slate-600 dark:bg-black/60 dark:text-zinc-400 dark:hover:text-zinc-200 border border-black/5 dark:border-white/10'
            )}
          >
            <Heart
              className={cn(
                'h-4 w-4 transition-colors duration-200',
                wishlisted
                  ? 'fill-red-500 text-red-500'
                  : 'fill-slate-400/20 text-slate-400 dark:text-zinc-400'
              )}
            />
          </button>

          {inBag && onRemoveFromBag && (
            <button
              type="button"
              onClick={(e) => { stop(e); onRemoveFromBag(); }}
              aria-label={`Remove ${product.name} from bag`}
              className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm backdrop-blur-sm transition hover:scale-110"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Name, price, description & images buttons — themed with the seller's accent. */}
        <div className="flex flex-1 flex-col justify-between gap-1 p-2 sm:p-2.5">
          {/* Product name on left, image icon to the right */}
          <div className="flex items-center justify-between gap-1.5">
            <h3
              className="min-w-0 flex-1 truncate text-xs font-normal tracking-tight sm:text-sm"
              style={{ color: 'var(--product-card-accent)' }}
              title={product.name}
            >
              {product.name}
            </h3>

            <button
              type="button"
              onClick={(e) => { stop(e); setActiveImageIndex(0); setShowImages(true); }}
              aria-label={`View ${product.name} images`}
              className="inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--product-card-accent)' }}
            >
              <ImageIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0" />
            </button>
          </div>

          {/* Price on left, description icon on right */}
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <p className="text-sm font-normal tabular-nums sm:text-base" style={{ color: 'var(--product-card-accent)' }}>
              {formatCurrency(product.price)}
            </p>

            <button
              type="button"
              onClick={(e) => { stop(e); setShowDescription(true); }}
              aria-label={`View ${product.name} description`}
              className="inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer hover:opacity-75 transition-opacity shrink-0"
              style={{ color: 'var(--product-card-accent)' }}
            >
              <Info className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0" />
            </button>
          </div>
        </div>
      </Card>

      {/* Description popup (§18) */}
      {showDescription && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${product.name} description`}>
          <button type="button" aria-label="Close description" onClick={() => setShowDescription(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
            style={{
              ...themeVars,
              backgroundColor: 'var(--product-card-bg, var(--byblos-surface, #ffffff))',
              color: 'var(--product-card-text, var(--byblos-text, #0f0f0e))',
              borderColor: 'var(--product-card-border, var(--byblos-border, rgba(0, 0, 0, 0.12)))',
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-normal" style={{ color: 'var(--product-card-accent)' }}>{product.name}</h3>
              <button type="button" onClick={() => setShowDescription(false)} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-1.5 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed opacity-80">
              {product.description?.trim() || 'No description provided for this product.'}
            </p>
          </div>
        </div>
      )}

      {/* Images popup — translucent, blurred backdrop; navigation buttons front and back; closes on outside tap or close button */}
      {showImages && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} images`}
        >
          <button
            type="button"
            aria-label="Close images"
            onClick={() => setShowImages(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border p-4 sm:p-5 shadow-2xl overflow-hidden"
            style={{
              ...themeVars,
              backgroundColor: 'var(--product-card-bg, var(--byblos-surface, #ffffff))',
              color: 'var(--product-card-text, var(--byblos-text, #0f0f0e))',
              borderColor: 'var(--product-card-border, var(--byblos-border, rgba(0, 0, 0, 0.12)))',
            }}
          >
            {/* Modal Header */}
            <div className="mb-3 flex items-center justify-between gap-2 border-b pb-2.5 border-[var(--byblos-border,rgba(0,0,0,0.1))]">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-normal truncate" style={{ color: 'var(--product-card-accent)' }}>
                  {product.name}
                </h3>
                <p className="text-[11px] font-semibold opacity-70">
                  Image {productImages.length > 0 ? activeImageIndex + 1 : 0} of {productImages.length || 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImages(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-full p-1.5 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main Image View with Front/Back Navigation Buttons */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/10 flex items-center justify-center group/img select-none">
              {productImages.length > 0 ? (
                <img
                  src={productImages[activeImageIndex]}
                  alt={`${product.name} - image ${activeImageIndex + 1}`}
                  className="h-full w-full object-cover transition-all duration-300 pointer-events-none"
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center opacity-40">
                  <Package className="h-12 w-12" />
                </div>
              )}

              {/* Sleek horizontal watermark banner running across the center */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center py-1.5 bg-black/40 backdrop-blur-[1px]">
                <p className="w-full text-center text-xs sm:text-sm font-normal uppercase tracking-widest text-white/85 drop-shadow-md truncate px-3 select-none">
                  @{product.seller?.shopName || product.seller?.fullName || 'Shop'} • Byblos
                </p>
              </div>

              {/* Navigation Buttons: Front (Next) and Back (Previous) */}
              {productImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      setActiveImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
                    }}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition hover:scale-110 hover:bg-black/80 active:scale-95"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      setActiveImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
                    }}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition hover:scale-110 hover:bg-black/80 active:scale-95"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail dots / strip */}
            {productImages.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5 overflow-x-auto py-1">
                {productImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      setActiveImageIndex(idx);
                    }}
                    className={cn(
                      "relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                      activeImageIndex === idx
                        ? "border-[var(--product-card-accent,#f5c518)] scale-105"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ShopProductCard;
