import { Card } from '@/components/ui/card';
import { Loader2, Heart } from 'lucide-react';
import { Product, Seller } from '@/types';
import { cn } from '@/lib/utils';
import { ProductCardDetails } from '@/components/product-card/ProductCardDetails';
import { ProductCardMedia } from '@/components/product-card/ProductCardMedia';
import { ProductImageViewer } from '@/components/product-card/ProductImageViewer';
import { ProductCardModals } from '@/components/product-card/ProductCardModals';
import { type Theme } from '@/components/product-card/productCardUtils';
import { useProductCheckout } from '@/components/product-card/useProductCheckout';


interface ProductCardProps {
  product: Product;
  seller?: Seller;
  hideWishlist?: boolean;
  theme?: Theme;
  forceWhiteText?: boolean;
}


export function ProductCard({ product, seller, hideWishlist = false, theme, forceWhiteText = false }: ProductCardProps) {
  const {
    isSold,
    themeClasses,
    themedCardStyle,
    toggleWishlist,
    wishlistActionLoading,
    isWishlistLoading,
    isWishlisted,
    isDigital,
    isService,
    isHybrid,
    isOutOfStock,
    isPhysical,
    effectiveIsImportedProduct,
    effectiveImportDays,
    effectiveIsCustomProduct,
    effectiveProductionDays,
    effectiveCustomizationPrompt,
    importNote,
    productImages,
    galleryIndex,
    setGalleryIndex,
    displaySeller,
    displaySellerName,
    cardTheme,
    isLocked,
    handleBuyButtonClick,
    openShop,
    isPhoneCheckModalOpen,
    isBuyerModalOpen,
    isBookingModalOpen,
    isCheckingPhone,
    isProcessingPurchase,
    currentPhone,
    initialBuyerData,
    initialBuyerLocation,
    shouldSkipSave,
    paymentModalData,
    setIsPhoneCheckModalOpen,
    setIsBuyerModalOpen,
    setIsBookingModalOpen,
    setPaymentModalData,
    handlePhoneSubmit,
    handleBuyerInfoSubmit,
    handleBookingConfirm,
  } = useProductCheckout(product, seller, theme);

  return (
    <Card
      className={cn(
        'product-card-item group relative flex h-full min-h-[224px] flex-col overflow-hidden transition-all duration-300 rounded-xl sm:rounded-2xl sm:min-h-[294px]',
        isSold ? 'opacity-60' : 'sm:hover:-translate-y-1',
        'cursor-pointer',
        themeClasses.card
      )}
      style={themedCardStyle}
      aria-label={`Product: ${product.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      {!hideWishlist && (
        <button
          onClick={toggleWishlist}
          className={cn(
            'absolute top-2 right-2 z-10 p-1.5 sm:p-2 rounded-full bg-white/95 hover:bg-white border border-slate-200 shadow-sm backdrop-blur-sm transition-all duration-300',
            'h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 flex items-center justify-center',
            wishlistActionLoading || isWishlistLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110',
            isWishlisted ? 'text-red-500' : 'text-slate-500'
          )}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          disabled={isSold || wishlistActionLoading || isWishlistLoading}
          aria-busy={wishlistActionLoading}
        >
          {wishlistActionLoading || isWishlistLoading ? (
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-spin" />
          ) : (
            <Heart className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5', isWishlisted ? 'fill-current' : '')} />
          )}
        </button>
      )}

      <ProductCardMedia
        product={product}
        isDigital={isDigital}
        isService={isService}
        isHybrid={isHybrid}
        isImportedProduct={effectiveIsImportedProduct}
        importDays={effectiveImportDays}
        isOutOfStock={isOutOfStock}
        canOpenGallery={productImages.length > 0}
        imageCount={productImages.length}
        images={productImages}
        onOpenGallery={() => setGalleryIndex(0)}
      />

      <ProductCardDetails
        product={product}
        displaySeller={displaySeller}
        displaySellerName={displaySellerName}
        theme={cardTheme}
        forceWhiteText={forceWhiteText}
        themeClasses={themeClasses}
        isDigital={isDigital}
        isService={isService}
        isSold={isSold}
        isLocked={isLocked}
        onBuyClick={handleBuyButtonClick}
        onOpenShop={openShop}
      />

      <ProductCardModals
        product={product}
        theme={cardTheme}
        displaySellerName={displaySellerName}
        isPhoneCheckModalOpen={isPhoneCheckModalOpen}
        isBuyerModalOpen={isBuyerModalOpen}
        isBookingModalOpen={isBookingModalOpen}
        isCheckingPhone={isCheckingPhone}
        isProcessingPurchase={isProcessingPurchase}
        currentPhone={currentPhone}
        initialBuyerData={initialBuyerData}
        initialBuyerLocation={initialBuyerLocation}
        shouldSkipSave={shouldSkipSave}
        paymentModalData={paymentModalData}
        isPhysicalProduct={isPhysical}
        isCustomProduct={effectiveIsCustomProduct}
        productionDays={effectiveProductionDays}
        customizationPrompt={effectiveCustomizationPrompt}
        isImportedProduct={effectiveIsImportedProduct}
        importDays={effectiveImportDays}
        importNote={importNote}
        onPhoneCheckClose={() => setIsPhoneCheckModalOpen(false)}
        onBuyerModalClose={() => setIsBuyerModalOpen(false)}
        onBookingModalClose={() => setIsBookingModalOpen(false)}
        onPaymentModalClose={() => setPaymentModalData(prev => ({ ...prev, isOpen: false }))}
        onPhoneSubmit={handlePhoneSubmit}
        onBuyerInfoSubmit={async (buyerInfo, skipSave) => {
          await handleBuyerInfoSubmit(buyerInfo as unknown as Record<string, unknown>, null, skipSave);
        }}
        onBookingConfirm={handleBookingConfirm}
      />

      {galleryIndex !== null && (
        <ProductImageViewer
          images={productImages}
          productName={product.name}
          activeIndex={galleryIndex}
          onActiveIndexChange={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </Card>
  );
}


