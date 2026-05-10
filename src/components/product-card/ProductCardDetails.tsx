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

  return (
    <CardContent className="p-2 sm:p-3 md:p-4 lg:p-5">
      <h3 className={cn("font-bold mb-1 sm:mb-1.5 line-clamp-1 h-6 sm:h-6 text-base sm:text-base antialiased",
        (theme === 'black' || forceWhiteText) ? 'text-white' : 'text-black'
      )}>
        {product.name}
      </h3>

      <p className={cn("font-black text-base sm:text-base mb-1 sm:mb-1.5 flex items-center gap-1.5 sm:gap-2",
        isService
          ? 'text-purple-600'
          : (forceWhiteText && theme === 'default') ? 'text-yellow-400' : themeClasses.price
      )}>
        {isDigital ? (
          <span className="text-red-600">
            {formatCurrency(product.price)}
          </span>
        ) : (
          formatCurrency(product.price)
        )}
        {isService && serviceOptions?.price_type === 'hourly' && (
          <span className="text-sm font-medium text-gray-300 ml-1">/hr</span>
        )}
      </p>

      {product.description && (
        <div className="relative group/desc h-10 overflow-y-auto no-scrollbar mb-1.5 sm:mb-2 overscroll-contain">
          <p className={cn("mobile-text leading-tight text-[11px] sm:text-xs min-h-full",
            (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-700'
          )}>
            {product.description}
          </p>
        </div>
      )}

      {isService && (
        <div className={cn("flex items-start gap-1.5 mb-2 text-xs",
          (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-700'
        )}>
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
        </div>
      )}

      <div className={cn("flex items-center gap-1 sm:gap-1.5 pt-1.5 sm:pt-2 border-t mt-1.5 sm:mt-2",
        (theme === 'black' || forceWhiteText) ? 'border-gray-800' : 'border-gray-100'
      )}>
        <Store className={cn("h-3.5 w-3.5 sm:h-3.5 sm:w-3.5", themeClasses.icon)} />
        <span
          className={cn("mobile-text font-bold tracking-tight truncate flex-1 opacity-90 cursor-pointer hover:underline text-sm sm:text-xs",
            (theme === 'black' || forceWhiteText) ? 'text-gray-300' : 'text-gray-800'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onOpenShop();
          }}
        >
          {displaySellerName}
        </span>
        <div className="shrink-0 flex items-center">
          {isSellerShopless(displaySeller) ? (
            <Badge variant="outline" className="h-4 px-1 text-[8px] border-zinc-500/30 text-zinc-400 bg-zinc-500/10 font-bold uppercase tracking-wider">
              Online Only
            </Badge>
          ) : (
            <Badge variant="outline" className="h-4 px-1 text-[8px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold uppercase tracking-wider">
              Physical Shop
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
          'button-mobile w-full h-12 sm:h-10 font-bold transition-colors mt-3 sm:mt-2.5',
          'focus-visible:ring-2 focus-visible:ring-offset-2',
          'flex items-center justify-center gap-2 sm:gap-2 text-base sm:text-sm',
          'disabled:opacity-50 disabled:pointer-events-none',
          isSold
            ? 'bg-gray-400 hover:bg-gray-400'
            : isService
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : isDigital
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : themeClasses.button,
          (!isService && !isDigital) && themeClasses.button
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
            <span>{isSold ? 'Sold Out' : isService ? 'Book Now' : isDigital ? 'Download Now' : 'Buy Now'}</span>
          </>
        )}
      </Button>
    </CardContent>
  );
}
