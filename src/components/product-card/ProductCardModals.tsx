import { BuyerInfoModal, type BuyerInfo } from '@/shared/components/BuyerInfoModal';
import PhoneCheckModal, { type DoorDeliverySelection } from '@/shared/components/PhoneCheckModal';
import { PaymentStatusModal } from '@/features/payments/components/PaymentStatusModal';
import { ServiceBookingModal } from '@/shared/components/ServiceBookingModal';
import type { Product } from '@/shared/types';
import type { Theme } from '@/features/shop/utils/productCardUtils';
import type { BuyerLocationPayload } from '@/infrastructure/location/location';

interface ProductCardModalsProps {
  product: Product;
  theme: Theme;
  displaySellerName: string;
  isPhoneCheckModalOpen: boolean;
  isBuyerModalOpen: boolean;
  isBookingModalOpen: boolean;
  isCheckingPhone: boolean;
  isProcessingPurchase: boolean;
  currentPhone: string;
  initialBuyerData?: { fullName?: string; email?: string; city?: string; location?: string };
  initialBuyerLocation: BuyerLocationPayload | null;
  shouldSkipSave: boolean;
  isPhysicalProduct: boolean;
  isCustomProduct: boolean;
  productionDays?: number | null;
  customizationPrompt?: string | null;
  isImportedProduct?: boolean;
  importDays?: number | null;
  importNote?: string | null;
  paymentModalData: {
    isOpen: boolean;
    orderNumber: string | null;
    invoiceId: string | null;
    isGuest: boolean;
    email?: string;
    checkoutToken?: string | null;
    paymentSummary?: {
      productAmount?: number;
      deliveryFee?: number;
      serviceCharge?: number;
      totalAmount?: number;
    };
  };
  onPhoneCheckClose: () => void;
  onBuyerModalClose: () => void;
  onBookingModalClose: () => void;
  onPaymentModalClose: () => void;
  onPhoneSubmit: (phone: string, delivery?: DoorDeliverySelection & { customInstructions?: string }) => Promise<void>;
  onBuyerInfoSubmit: (buyerInfo: BuyerInfo, shouldSkipSave: boolean) => Promise<void>;
  onBookingConfirm: (data: {
    date: Date;
    time: string;
    location: string;
    locationType?: string;
    buyerLocation?: BuyerLocationPayload | null;
  }) => Promise<void>;
}

export function ProductCardModals({
  product,
  theme,
  displaySellerName,
  isPhoneCheckModalOpen,
  isBuyerModalOpen,
  isBookingModalOpen,
  isCheckingPhone,
  isProcessingPurchase,
  currentPhone,
  initialBuyerData,
  initialBuyerLocation,
  shouldSkipSave,
  isPhysicalProduct,
  isCustomProduct,
  productionDays = null,
  customizationPrompt = null,
  isImportedProduct = false,
  importDays = null,
  importNote = null,
  paymentModalData,
  onPhoneCheckClose,
  onBuyerModalClose,
  onBookingModalClose,
  onPaymentModalClose,
  onPhoneSubmit,
  onBuyerInfoSubmit,
  onBookingConfirm
}: ProductCardModalsProps) {
  return (
    <>
      <PhoneCheckModal
        isOpen={isPhoneCheckModalOpen}
        onClose={onPhoneCheckClose}
        onPhoneSubmit={onPhoneSubmit}
        isLoading={isCheckingPhone}
        isPhysicalProduct={isPhysicalProduct}
        isCustomProduct={isCustomProduct}
        productionDays={productionDays}
        customizationPrompt={customizationPrompt}
        isImportedProduct={isImportedProduct}
        importDays={importDays}
        importNote={importNote}
        purchaseDetails={{
          shopName: displaySellerName,
          productName: product.name,
          productPrice: Number(product.price || 0),
        }}
      />

      <BuyerInfoModal
        isOpen={isBuyerModalOpen}
        onClose={onBuyerModalClose}
        onSubmit={async (buyerInfo) => {
          await onBuyerInfoSubmit({
            ...buyerInfo,
            fullName: buyerInfo.fullName || `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim(),
          }, shouldSkipSave);
        }}
        isLoading={isProcessingPurchase}
        theme={theme}
        phoneNumber={currentPhone}
        initialData={initialBuyerData}
      />

      <ServiceBookingModal
        product={product}
        isOpen={isBookingModalOpen}
        onClose={onBookingModalClose}
        onConfirm={onBookingConfirm}
        initialBuyerLocation={initialBuyerLocation}
      />

      <PaymentStatusModal
        {...paymentModalData}
        onClose={onPaymentModalClose}
      />
    </>
  );
}


