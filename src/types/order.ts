// These types should match the database enum values
export type OrderStatus =
  | 'PENDING'
  | 'CREATED'
  | 'RESERVED'
  | 'HELD'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'AWAITING_SELLER_ACTION'
  | 'FULFILLING'
  | 'READY_FOR_BUYER'
  | 'PROCESSING'
  | 'DELIVERY_PENDING'
  | 'CONFIRMED'
  | 'SERVICE_PENDING'
  | 'COLLECTION_PENDING'
  | 'DELIVERY_COMPLETE'
  | 'FULFILLMENT_PENDING'
  | 'FULFILLED'
  | 'DELIVERED'
  | 'BOOKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'MANUAL_REVIEW'
  | 'COMPENSATION_REQUIRED';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed' | 'completed' | 'paid' | 'cancelled' | 'manual_review'; // Payment status is lowercase in DB

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  productType?: 'physical' | 'digital' | 'service';
  subtotal: number;
  isDigital?: boolean;
}

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobilePayment?: string;
  whatsappNumber?: string;
}

export interface OrderSeller {
  id: string;
  name: string;
  shopName?: string;
  location?: string;
  city?: string;
  physicalAddress?: string;
  latitude?: number | string;
  longitude?: number | string;
  isClient?: boolean;
}

export interface OrderLogisticsEvent {
  id: string | number;
  type: string | null;
  status: string | null;
  message: string | null;
  source: string | null;
  createdAt: string | null;
}

export interface OrderLogisticsDeliveryLeg {
  id: string | number;
  status: string | null;
  feeAmount: number;
  feeCurrency: string;
  distanceKm: number | null;
  originLabel?: string | null;
  originAddress?: string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  destinationLabel?: string | null;
  destinationAddress?: string | null;
  destinationLat?: number | string | null;
  destinationLng?: number | string | null;
  deadlineAt?: string | null;
  completedAt?: string | null;
}

export interface OrderLogisticsTracking {
  requestId: string | number | null;
  packageCode: string | null;
  status: string | null;
  serviceLevel?: string | null;
  deadlineAt?: string | null;
  completedAt?: string | null;
  deliveryLeg?: OrderLogisticsDeliveryLeg | null;
  pickupLeg?: OrderLogisticsDeliveryLeg | null;
  events: OrderLogisticsEvent[];
}

export interface ShippingAddress {
  address: string;
  city: string;
  country: string;
  postalCode: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  customer: OrderCustomer;
  seller: OrderSeller;
  shippingAddress: ShippingAddress;
  metadata?: any;
  isDigital?: boolean;
  // Flat fields returned by backend
  buyerName?: string;
  buyerEmail?: string;
  buyerMobilePayment?: string;
  buyerWhatsappNumber?: string;
  fulfillment_type?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  logistics?: OrderLogisticsTracking | null;
}
