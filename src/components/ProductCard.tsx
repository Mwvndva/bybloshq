import React, { useMemo, useCallback, memo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Calendar,
  Zap,
  Clock
} from "lucide-react";
import { Product, Seller, Theme } from '@/types';
import PhoneCheckModal from './PhoneCheckModal';
import { BuyerInfoModal } from './BuyerInfoModal';
import { ServiceBookingModal } from './ServiceBookingModal';
import { isServiceProduct, isDigitalProduct, getProductImages } from '@/utils/productUtils';
import { useProductActions } from '@/hooks/useProductActions';

interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
  onWishlistUpdate?: () => void;
  theme?: Theme;
}

const ProductCard = memo(({
  product,
  seller,
  hideWishlist = false,
  theme = 'black'
}: ProductCardProps) => {
  const {
    currentImageIndex,
    isProcessing,
    showPhoneCheck,
    showBuyerInfo,
    showServiceBooking,
    existingBuyer,
    setShowPhoneCheck,
    setShowBuyerInfo,
    setShowServiceBooking,
    toggleWishlist,
    handleCardClick,
    scrollToImage,
    handleAction,
    handlePhoneSubmit,
    handleBuyerInfoSubmit,
    handleBookingConfirm,
    isInWishlist
  } = useProductActions({ product, seller, hideWishlist });

  const isSold = useMemo(() => product.isSold || product.status === 'sold', [product.isSold, product.status]);
  const isService = useMemo(() => isServiceProduct(product), [product]);

  // Dynamic Styles
  const glassCardStyle: React.CSSProperties = useMemo(() => {
    if (theme === 'black' || theme === 'default') {
      return {
        background: 'rgba(10, 10, 10, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)'
      };
    }
    return {};
  }, [theme]);

  const allImages = useMemo(() => getProductImages(product), [product]);

  const themeClasses = useMemo(() => {
    switch (theme) {
      case 'black':
        return {
          cardBg: 'bg-[#0a0a0a]/80 border-white/10',
          textColor: 'text-white',
          mutedText: 'text-gray-400',
          accentColor: 'text-yellow-400',
          badgeBg: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
          buttonPrimary: 'bg-yellow-400 text-black hover:bg-yellow-500',
          priceColor: 'text-yellow-400'
        };
      case 'pink':
        return {
          cardBg: 'bg-white border-pink-100 shadow-sm',
          textColor: 'text-pink-900',
          mutedText: 'text-pink-600/60',
          accentColor: 'text-pink-500',
          badgeBg: 'bg-pink-50 text-pink-600 border-pink-100',
          buttonPrimary: 'bg-pink-500 text-white hover:bg-pink-600',
          priceColor: 'text-pink-600'
        };
      case 'orange':
        return {
          cardBg: 'bg-white border-orange-100 shadow-sm',
          textColor: 'text-orange-900',
          mutedText: 'text-orange-600/60',
          accentColor: 'text-orange-500',
          badgeBg: 'bg-orange-50 text-orange-600 border-orange-100',
          buttonPrimary: 'bg-orange-500 text-white hover:bg-orange-600',
          priceColor: 'text-orange-600'
        };
      case 'green':
        return {
          cardBg: 'bg-white border-green-100 shadow-sm',
          textColor: 'text-green-900',
          mutedText: 'text-green-600/60',
          accentColor: 'text-green-500',
          badgeBg: 'bg-green-50 text-green-600 border-green-100',
          buttonPrimary: 'bg-green-500 text-white hover:bg-green-600',
          priceColor: 'text-green-600'
        };
      case 'red':
        return {
          cardBg: 'bg-white border-red-100 shadow-sm',
          textColor: 'text-red-900',
          mutedText: 'text-red-600/60',
          accentColor: 'text-red-500',
          badgeBg: 'bg-red-50 text-red-600 border-red-100',
          buttonPrimary: 'bg-red-500 text-white hover:bg-red-600',
          priceColor: 'text-red-600'
        };
      case 'yellow':
        return {
          cardBg: 'bg-white border-yellow-100 shadow-sm',
          textColor: 'text-yellow-900',
          mutedText: 'text-yellow-700/60',
          accentColor: 'text-yellow-600',
          badgeBg: 'bg-yellow-50 text-yellow-700 border-yellow-100',
          buttonPrimary: 'bg-yellow-400 text-black hover:bg-yellow-500',
          priceColor: 'text-yellow-700'
        };
      case 'brown':
        return {
          cardBg: 'bg-white border-[#f3e3d3] shadow-sm',
          textColor: 'text-[#451a03]',
          mutedText: 'text-[#92400e]/60',
          accentColor: 'text-[#92400e]',
          badgeBg: 'bg-[#fdf8f6] text-[#92400e] border-[#f3e3d3]',
          buttonPrimary: 'bg-[#78350f] text-white hover:bg-[#92400e]',
          priceColor: 'text-[#92400e]'
        };
      default:
        return {
          cardBg: 'bg-white border-gray-100 shadow-sm',
          textColor: 'text-gray-900',
          mutedText: 'text-gray-500',
          accentColor: 'text-yellow-600',
          badgeBg: 'bg-gray-50 text-gray-700 border-gray-100',
          buttonPrimary: 'bg-yellow-400 text-black hover:bg-yellow-500',
          priceColor: 'text-yellow-600'
        };
    }
  }, [theme]);

  const handlePrevImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    scrollToImage(currentImageIndex === 0 ? allImages.length - 1 : currentImageIndex - 1);
  }, [currentImageIndex, allImages.length, scrollToImage]);

  const handleNextImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    scrollToImage(currentImageIndex === allImages.length - 1 ? 0 : currentImageIndex + 1);
  }, [currentImageIndex, allImages.length, scrollToImage]);

  return (
    <Card
      onClick={handleCardClick}
      className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-pointer rounded-2xl sm:rounded-3xl border-none ${themeClasses.cardBg}`}
      style={glassCardStyle}
    >
      {/* Visual Image Section */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[#111]">
        <img
          src={allImages[currentImageIndex]}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 ${isSold ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}
          loading="lazy"
        />

        {/* Sold Overlay */}
        {isSold && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <Badge className="bg-white/90 text-black border-none px-6 py-2 text-sm font-bold tracking-widest uppercase rounded-full shadow-lg">
              Sold Out
            </Badge>
          </div>
        )}

        {/* Digital Product Badge */}
        {isDigitalProduct(product) && !isSold && (
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-blue-500/90 text-white border-none px-3 py-1 text-[10px] font-bold uppercase rounded-full shadow-lg flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Instant Access
            </Badge>
          </div>
        )}

        {/* Wishlist Button */}
        {!hideWishlist && (
          <button
            onClick={toggleWishlist}
            className={`absolute top-4 right-4 z-20 p-2.5 rounded-full backdrop-blur-md transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg ${isInWishlist
              ? 'bg-red-500 text-white'
              : 'bg-black/20 text-white hover:bg-white hover:text-red-500 border border-white/20'
              }`}
          >
            <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${isInWishlist ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Image Navigation Arrows */}
        {allImages.length > 1 && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
            <button
              onClick={handlePrevImage}
              className="p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-all pointer-events-auto"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextImage}
              className="p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-all pointer-events-auto"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Image Indicators */}
        {allImages.length > 1 && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5 z-20">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => scrollToImage(idx, e)}
                className={`h-1 rounded-full transition-all duration-300 ${idx === currentImageIndex
                  ? 'w-6 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                  : 'w-1.5 bg-white/40 hover:bg-white/60'
                  }`}
              />
            ))}
          </div>
        )}
      </div>

      <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Category & Shop Badge Line */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <Badge
            variant="outline"
            className={`text-[9px] sm:text-[10px] uppercase tracking-widest border-none px-2 py-0.5 rounded-md font-bold ${themeClasses.badgeBg} truncate`}
          >
            {isService ? 'Service' : product.category || 'Physical Item'}
          </Badge>

          {seller?.shopName && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-gray-500 truncate">
              <span className="w-1 h-1 rounded-full bg-gray-500"></span>
              <span className="truncate">{seller.shopName}</span>
            </div>
          )}
        </div>

        {/* Product Name */}
        <h3 className={`font-semibold text-sm sm:text-base lg:text-lg line-clamp-1 group-hover:${themeClasses.accentColor} transition-colors duration-300 ${themeClasses.textColor}`}>
          {product.name}
        </h3>

        {/* Features/Details Grid */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          {isService ? (
            <>
              <div className={`flex items-center gap-1.5 ${themeClasses.mutedText}`}>
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs truncate">Book Now</span>
              </div>
              <div className={`flex items-center gap-1.5 ${themeClasses.mutedText}`}>
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs truncate">Flexible</span>
              </div>
            </>
          ) : (
            <>
              <div className={`flex items-center gap-1.5 ${themeClasses.mutedText}`}>
                <Badge variant="outline" className={`h-1.5 w-1.5 p-0 rounded-full bg-green-500 border-none`}></Badge>
                <span className="text-[10px] sm:text-xs truncate">In Stock</span>
              </div>
              <div className={`flex items-center gap-1.5 ${themeClasses.mutedText}`}>
                <Smartphone className="h-3 w-3 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs truncate">Escrow Safe</span>
              </div>
            </>
          )}
        </div>

        {/* Price & Primary Action */}
        <div className="flex items-center justify-between gap-3 mt-1.5 pt-3 border-t border-white/5">
          <div className="flex flex-col">
            <span className={`text-base sm:text-lg lg:text-xl font-black ${themeClasses.priceColor}`}>
              KSh {product.price.toLocaleString()}
            </span>
            <span className="text-[9px] uppercase tracking-tighter text-gray-500">Secure Payment</span>
          </div>

          <Button
            size="sm"
            disabled={isSold || isProcessing}
            onClick={handleAction}
            className={`h-9 px-4 sm:px-6 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all duration-300 transform active:scale-95 ${themeClasses.buttonPrimary} border-none group/btn`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 border-2 border-current border-t-transparent animate-spin rounded-full"></div>
                <span>Securing...</span>
              </div>
            ) : isSold ? (
              "Sold"
            ) : isService ? (
              <span className="flex items-center gap-2">
                Book <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Buy <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </CardContent>

      {/* Modals */}
      <PhoneCheckModal
        isOpen={showPhoneCheck}
        onClose={() => setShowPhoneCheck(false)}
        onPhoneSubmit={handlePhoneSubmit}
        isLoading={isProcessing}
      />

      <BuyerInfoModal
        isOpen={showBuyerInfo}
        onClose={() => setShowBuyerInfo(false)}
        onSubmit={handleBuyerInfoSubmit}
        isLoading={isProcessing}
        phoneNumber={existingBuyer?.phone || ''}
        initialData={existingBuyer}
      />

      <ServiceBookingModal
        isOpen={showServiceBooking}
        onClose={() => setShowServiceBooking(false)}
        product={product}
        onConfirm={handleBookingConfirm}
      />
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
