import { BuyerInfoModal, type BuyerInfo } from '@/components/BuyerInfoModal';
import PhoneCheckModal, { type DoorDeliverySelection } from '@/components/PhoneCheckModal';
import { PaymentStatusModal } from '@/components/PaymentStatusModal';
import { ServiceBookingModal } from '@/components/ServiceBookingModal';
import type { Product } from '@/types';
import type { Theme } from './productCardUtils';

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
  initialBuyerLocation: { lat: number; lng: number; address: string } | null;
  shouldSkipSave: boolean;
  paymentModalData: {
    isOpen: boolean;
    orderNumber: string | null;
    invoiceId: string | null;
    isGuest: boolean;
    email?: string;
  };
  onPhoneCheckClose: () => void;
  onBuyerModalClose: () => void;
  onBookingModalClose: () => void;
  onPaymentModalClose: () => void;
  onPhoneSubmit: (phone: string, delivery?: DoorDeliverySelection) => Promise<void>;
  onBuyerInfoSubmit: (buyerInfo: BuyerInfo, shouldSkipSave: boolean) => Promise<void>;
  onBookingConfirm: (data: {
    date: Date;
    time: string;
    location: string;
    locationType?: string;
    buyerLocation?: { lat: number; lng: number; address: string } | null;
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
        isPhysicalProduct={product.product_type === 'physical' || product.productType === 'physical' || (!product.is_digital && product.product_type !== 'service' && product.productType !== 'service')}
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
