import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Product, Seller } from '@/types';
import type { ApiSellerProduct, ApiProduct } from '@/types/api/product';
import { cn, formatCurrency, isSellerShopless } from '@/lib/utils';
import type { ProductCardThemeClasses, Theme } from './productCardUtils';
import { Calendar, ChevronDown, ExternalLink, FileText, Loader2, MapPin, ShoppingCart, Store } from 'lucide-react';

type ProductWithApiFields = Product & Partial<ApiSellerProduct> & Partial<ApiProduct>;

interface ProductCardDetailsProps {
  product: ProductWithApiFields;
  displaySeller?: Seller;
  displaySellerName: string;
  theme: Theme;
  forceWhiteText: boolean;
  themeClasses: ProductCardThemeClasses;
  isDigital: boolean;
  isService: boolean;
  isSold: boolean;
  isLocked: boolean;
  onBuyClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenShop: () => void;
}

export function ProductCardDetails({
  product,
  displaySeller,
  displaySellerName,
  theme,
  forceWhiteText,
  themeClasses,
  isDigital,
  isService,
  isSold,
  isLocked,
  onBuyClick,
  onOpenShop
}: ProductCardDetailsProps) {
  const serviceOptions = product.service_options || product.serviceOptions;
  const isCustomProduct = Boolean(product.is_custom_product || product.isCustomProduct);
  const productionDays = Number(product.production_days || product.productionDays || 0);
  const isImportedProduct = Boolean(product.is_imported_product || product.isImportedProduct);
  const importDays = Number(product.import_days || product.importDays || 0);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [hasMoreDescription, setHasMoreDescription] = useState(false);

  const updateDescriptionOverflow = useCallback(() => {
    const node = descriptionRef.current;
    if (!node) return;

    const remainingScroll = node.scrollHeight - node.scrollTop - node.clientHeight;
    setHasMoreDescription(remainingScroll > 2);
  }, []);

  useEffect(() => {
    updateDescriptionOverflow();

    const node = descriptionRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateDescriptionOverflow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [product.description, updateDescriptionOverflow]);

  return (
    <CardContent className="flex min-h-0 flex-1 flex-col p-2 sm:p-3.5 md:p-4">
      <h3 className={cn(
        "mb-0.5 line-clamp-2 min-h-[2rem] text-[13px] font-semibold leading-tight antialiased sm:mb-1 sm:min-h-[2.55rem] sm:text-base",
        forceWhiteText ? "text-white" : "text-[var(--product-card-text)]"
      )}>
        {product.name}
      </h3>

      <p className={cn("mb-0.5 flex min-h-5 items-center gap-1.5 text-xs font-bold sm:mb-1.5 sm:gap-2 sm:text-base", themeClasses.price)}>
        {isDigital ? (
          <span className={themeClasses.price}>
            {formatCurrency(product.price)}
          </span>
        ) : (
          formatCurrency(product.price)
        )}
        {isService && serviceOptions?.price_type === 'hourly' && (
          <span className={cn("ml-1 text-[10px] font-medium sm:text-sm", themeClasses.description)}>/hr</span>
        )}
      </p>

      <div
        ref={descriptionRef}
        className="no-scrollbar relative mb-1.5 h-[3.4rem] overflow-y-auto overscroll-contain pr-1 sm:mb-2 sm:h-[5.25rem]"
        onScroll={updateDescriptionOverflow}
      >
        {product.description ? (
          <p className={cn("mobile-text text-[10px] leading-snug sm:text-xs", themeClasses.description)}>
            {product.description}
          </p>
        ) : (
          <p className={cn("text-[10px] leading-snug opacity-70 sm:text-xs", themeClasses.description)}>
            Product details available at checkout.
          </p>
        )}
        {hasMoreDescription && (
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 -mx-1 mt-[-1.25rem] flex h-4 items-end justify-center bg-gradient-to-t from-[var(--product-card-bg)] via-[var(--product-card-bg)]/90 to-transparent pb-0.5"
          >
            <ChevronDown className="h-3 w-3 animate-bounce text-[var(--product-card-accent)] opacity-80" />
          </div>
        )}
      </div>

      {isCustomProduct && productionDays > 0 && (
        <div className="mb-1.5 rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] font-semibold leading-tight text-amber-900 sm:mb-2 sm:px-2 sm:py-1.5 sm:text-[11px]">
          Custom product: made in up to {productionDays} {productionDays === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
        </div>
      )}

      {isImportedProduct && !isCustomProduct && importDays > 0 && (
        <div className="mb-1.5 rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] font-semibold leading-tight text-amber-900 sm:mb-2 sm:px-2 sm:py-1.5 sm:text-[11px]">
          Imported / pre-order item: ready in up to {importDays} days. Delivery starts after seller handoff.
        </div>
      )}

      <div className={cn("mb-1 flex min-h-0 items-start gap-1 text-[10px] sm:mb-2 sm:min-h-8 sm:gap-1.5 sm:text-xs", themeClasses.description)}>
        {isService ? (
          <>
          <MapPin className="h-3 w-3 mt-0.5 shrink-0 sm:h-4 sm:w-4" />
          <span className="line-clamp-2 text-[10px] sm:text-sm">
            {serviceOptions?.location_type === 'seller_visits_buyer' ? (
              "Mobile Service"
            ) : serviceOptions?.location_type === 'hybrid' ? (
              "In-store & Mobile"
            ) : (
              (isSellerShopless(displaySeller) ? "Mobile Service" : "In-store")
            )}
          </span>
          </>
        ) : null}
      </div>

      <div className="mt-auto flex min-h-0 items-center gap-1 border-t border-[var(--product-card-border)] pt-1 sm:gap-1.5 sm:pt-2">
        <Store className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", themeClasses.icon)} />
        <span
          className={cn("mobile-text flex-1 cursor-pointer truncate text-[11px] font-semibold tracking-tight opacity-90 hover:underline sm:text-xs", themeClasses.seller)}
          onClick={(e) => {
            e.stopPropagation();
            onOpenShop();
          }}
        >
          {displaySellerName}
        </span>
        <div className="shrink-0 flex items-center">
          {isSellerShopless(displaySeller) ? (
            <Badge variant="outline" className="h-3.5 border-[var(--product-card-border)] bg-[var(--product-card-soft)] px-1 text-[7px] text-[var(--product-card-text)] sm:h-4 sm:text-[8px]">
              Online
            </Badge>
          ) : (
            <Badge variant="outline" className="h-3.5 border-[var(--product-card-border)] bg-[var(--product-card-soft)] px-1 text-[7px] text-[var(--product-card-text)] sm:h-4 sm:text-[8px]">
              Shop
            </Badge>
          )}
        </div>

        {displaySeller && !isSellerShopless(displaySeller) && !isDigital && (
          <div onClick={(e) => e.stopPropagation()}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-[10px] font-bold gap-1 transition-all duration-300",
                    "bg-[var(--product-card-soft)] text-[var(--product-card-accent)] border border-[var(--product-card-border)] hover:opacity-90 shadow-sm"
                  )}
                >
                  <Store className="w-3 h-3" />
                  Visit Shop
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 shadow-xl border-green-100 overflow-hidden z-50">
                <div className="bg-green-50/50 p-3 border-b border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-green-100 p-1.5 rounded-full">
                      <MapPin className="w-4 h-4 text-green-700" />
                    </div>
                    <span className="font-semibold text-green-900 text-sm">Physical Store</span>
                  </div>
                </div>
                <div className="p-3 bg-white space-y-3">
                  <div className="text-sm text-gray-600 leading-relaxed">
                    {displaySeller.physicalAddress}
                  </div>

                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 text-xs h-8"
                    onClick={() => {
                      const query = encodeURIComponent(displaySeller.physicalAddress || '');
                      if (displaySeller.latitude && displaySeller.longitude) {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${displaySeller.latitude},${displaySeller.longitude}`, '_blank');
                      } else {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                      }
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Get Directions
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <Button
        variant="default"
        size="default"
        className={cn(
          'button-mobile mt-2 h-9 w-full font-semibold transition-colors sm:mt-2.5 sm:h-10',
          'focus-visible:ring-2 focus-visible:ring-offset-2',
          'flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-sm',
          'disabled:opacity-50 disabled:pointer-events-none',
          isSold ? 'bg-slate-200 text-slate-500 hover:bg-slate-200' : themeClasses.button
        )}
        onClick={onBuyClick}
        disabled={isSold || isLocked}
        aria-busy={isLocked}
      >
        {isLocked ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            {isService ? (
              <Calendar className="h-3.5 w-3.5" />
            ) : isDigital ? (
              <FileText className="h-3.5 w-3.5" />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" />
            )}
            <span>{isSold ? 'Sold out' : isService ? 'Book securely' : isDigital ? 'Download securely' : 'Buy safely'}</span>
          </>
        )}
      </Button>
    </CardContent>
  );
}


