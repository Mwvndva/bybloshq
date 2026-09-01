import { useState, type MouseEvent } from 'react';
import { Heart, Info, Package, X } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import type { Product } from '@/shared/types';
import { cn, formatCurrency, getImageUrl } from '@/shared/utils/formatting';
import { getProductFlags, type ProductWithApiFields } from '@/features/shop/utils/productCardUtils';

interface ShopProductCardProps {
  product: Product;
  /** Tap the card body — add to bag (shop) or go to the shop with it pre-added (wishlist). */
  onTap: () => void;
  /** Shop context: the product is already in the bag → show the remove (x) control. */
  inBag?: boolean;
  onRemoveFromBag?: () => void;
  forceWhiteText?: boolean;
  /** Wishlist context: a filled heart that removes the item from the wishlist. */
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}

/**
 * Minimal product card (spec §17): product image, price, and a description
 * button — nothing else. Tapping the card adds the product to the seller-shop
 * bag; a sold / out-of-stock product is shown disabled with a "Sold" overlay.
 */
export function ShopProductCard({
  product,
  onTap,
  inBag = false,
  onRemoveFromBag,
  forceWhiteText = false,
  isWishlisted,
  onToggleWishlist,
}: ShopProductCardProps) {
  const [showDescription, setShowDescription] = useState(false);
  const { isSold } = getProductFlags(product as unknown as ProductWithApiFields);
  const image = product.image_url ? getImageUrl(product.image_url) : null;

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
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-xl border transition-all duration-300 sm:rounded-2xl',
          isSold ? 'cursor-not-allowed opacity-70' : 'cursor-pointer sm:hover:-translate-y-1',
          inBag && 'ring-2 ring-[var(--theme-accent,#f5c518)]',
        )}
      >
        {/* Image — full width, flush to the top. */}
        <div className="relative aspect-square w-full overflow-hidden bg-black/10">
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/40"><Package className="h-8 w-8" /></div>
          )}

          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-900">Sold</span>
            </div>
          )}

          {onToggleWishlist && (
            <button
              type="button"
              onClick={(e) => { stop(e); onToggleWishlist(); }}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm backdrop-blur-sm transition hover:scale-110"
            >
              <Heart className={cn('h-4 w-4', isWishlisted && 'fill-red-500 text-red-500')} />
            </button>
          )}

          {inBag && onRemoveFromBag && (
            <button
              type="button"
              onClick={(e) => { stop(e); onRemoveFromBag(); }}
              aria-label={`Remove ${product.name} from bag`}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm backdrop-blur-sm transition hover:scale-110"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Price + description button — the only content (§17). */}
        <div className="flex flex-1 flex-col gap-1.5 p-2 sm:p-2.5">
          <p className={cn('text-sm font-black tabular-nums sm:text-base', forceWhiteText ? 'text-white' : 'text-[var(--product-card-accent,var(--byblos-text))]')}>
            {formatCurrency(product.price)}
          </p>
          <button
            type="button"
            onClick={(e) => { stop(e); setShowDescription(true); }}
            className={cn('inline-flex w-fit items-center gap-1 text-[11px] font-bold underline-offset-2 hover:underline sm:text-xs', forceWhiteText ? 'text-white/80' : 'text-[var(--product-card-muted,var(--byblos-muted))]')}
          >
            <Info className="h-3 w-3" />
            Description
          </button>
        </div>
      </Card>

      {/* Description popup (§18) — closes on the close button or an outside tap; never navigates. */}
      {showDescription && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${product.name} description`}>
          <button type="button" aria-label="Close description" onClick={() => setShowDescription(false)} className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#0a0a0a] dark:text-white">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-black">{product.name}</h3>
              <button type="button" onClick={() => setShowDescription(false)} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-1.5 text-slate-500 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-white/70">
              {product.description?.trim() || 'No description provided for this product.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default ShopProductCard;
