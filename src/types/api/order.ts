import type { OrderStatus, PaymentStatus } from '../index';

export interface ApiOrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  productType?: 'physical' | 'digital' | 'service';
  product_type?: 'physical' | 'digital' | 'service';
  subtotal: number;
  isDigital?: boolean;
  is_digital?: boolean;
}

export interface ApiOrderCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobilePayment?: string;
  whatsappNumber?: string;
}

export interface ApiOrderSeller {
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

export interface ApiOrderLogisticsEvent {
  id: string | number;
  type: string | null;
  status: string | null;
  message: string | null;
  source: string | null;
  createdAt: string | null;
}

export interface ApiOrderLogisticsDeliveryLeg {
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

export interface OrderLiveLocationPoint {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updatedAt: string;
}

export interface OrderLiveLocation {
  available: boolean;
  phase: 'delivery' | 'pickup' | null;
  location: OrderLiveLocationPoint | null;
}

export interface ApiOrderLogisticsTracking {
  requestId: string | number | null;
  packageCode: string | null;
  status: string | null;
  serviceLevel?: string | null;
  deadlineAt?: string | null;
  completedAt?: string | null;
  deliveryLeg?: ApiOrderLogisticsDeliveryLeg | null;
  pickupLeg?: ApiOrderLogisticsDeliveryLeg | null;
  events: ApiOrderLogisticsEvent[];
}

export interface ApiShippingAddress {
  address: string;
  city: string;
  country: string;
  postalCode: string;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  paymentStatus: PaymentStatus;
  items: ApiOrderItem[];
  customer: ApiOrderCustomer;
  seller: ApiOrderSeller;
  shippingAddress: ApiShippingAddress;
  metadata?: Record<string, unknown>;
  isDigital?: boolean;
  buyerServiceChargeAmount?: number;
  buyerServiceChargeRate?: number;
  // Flat fields returned by backend
  buyerName?: string;
  buyerEmail?: string;
  buyerMobilePayment?: string;
  buyerWhatsappNumber?: string;
  fulfillment_type?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  logistics?: ApiOrderLogisticsTracking | null;
}


