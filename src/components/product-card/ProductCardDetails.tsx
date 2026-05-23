import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Product, Seller } from '@/types';
import { cn, formatCurrency, isSellerShopless } from '@/lib/utils';
import type { ProductCardThemeClasses, Theme } from './productCardUtils';
import { Calendar, ExternalLink, FileText, Loader2, MapPin, ShoppingCart, Store } from 'lucide-react';

interface ProductCardDetailsProps {
  product: Product;
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
  const serviceOptions = product.service_options || (product as any).serviceOptions;
  void theme;
  void forceWhiteText;

  return (
    <CardContent className="flex min-h-0 flex-1 flex-col p-2 sm:p-3 md:p-4">
      <h3 className="mb-1 line-clamp-1 min-h-6 text-base font-semibold text-slate-950 antialiased sm:mb-1.5">
        {product.name}
      </h3>

      <p className={cn("mb-1 flex min-h-6 items-center gap-1.5 text-base font-semibold sm:mb-1.5 sm:gap-2", themeClasses.price)}>
        {isDigital ? (
          <span className="text-yellow-700">
            {formatCurrency(product.price)}
          </span>
        ) : (
          formatCurrency(product.price)
        )}
        {isService && serviceOptions?.price_type === 'hourly' && (
          <span className="ml-1 text-sm font-medium text-slate-500">/hr</span>
        )}
      </p>

      <div className="relative group/desc mb-1.5 h-9 overflow-y-auto overscroll-contain no-scrollbar sm:mb-2">
        {product.description ? (
          <p className="mobile-text min-h-full text-[11px] leading-tight text-slate-500 sm:text-xs">
            {product.description}
          </p>
        ) : null}
      </div>

      <div className="mb-2 flex min-h-10 items-start gap-1.5 text-xs text-slate-500">
        {isService ? (
          <>
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="line-clamp-2 text-sm">
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

      <div className="mt-auto flex min-h-9 items-center gap-1 border-t border-slate-100 pt-1.5 sm:gap-1.5 sm:pt-2">
        <Store className={cn("h-3.5 w-3.5 sm:h-3.5 sm:w-3.5", themeClasses.icon)} />
        <span
          className="mobile-text flex-1 cursor-pointer truncate text-sm font-semibold tracking-tight text-slate-700 opacity-90 hover:underline sm:text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onOpenShop();
          }}
        >
          {displaySellerName}
        </span>
        <div className="shrink-0 flex items-center">
          {isSellerShopless(displaySeller) ? (
            <Badge variant="outline" className="h-4 px-1 text-[8px]">
              Online
            </Badge>
          ) : (
            <Badge variant="outline" className="h-4 border-yellow-200 bg-yellow-50 px-1 text-[8px] text-slate-600">
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
                    "bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/20 hover:bg-[var(--theme-accent)]/20 shadow-sm"
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
          'button-mobile mt-3 h-11 w-full font-semibold transition-colors sm:mt-2.5 sm:h-10',
          'focus-visible:ring-2 focus-visible:ring-offset-2',
          'flex items-center justify-center gap-2 sm:gap-2 text-base sm:text-sm',
          'disabled:opacity-50 disabled:pointer-events-none',
          isSold ? 'bg-slate-200 text-slate-500 hover:bg-slate-200' : themeClasses.button
        )}
        onClick={onBuyClick}
        disabled={isSold || isLocked}
        aria-busy={isLocked}
      >
        {isLocked ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            {isService ? (
              <Calendar className="h-4 w-4" />
            ) : isDigital ? (
              <FileText className="h-4 w-4" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            <span>{isSold ? 'Sold out' : isService ? 'Book securely' : isDigital ? 'Download securely' : 'Buy safely'}</span>
          </>
        )}
      </Button>
    </CardContent>
  );
}
