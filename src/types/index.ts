
export type { ApiSeller } from './api/seller';
export type { ApiSellerProduct } from './api/product';

import type { ProductType } from './primitives';
export type { ProductType, Theme } from './primitives';

export type Aesthetic =
  | 'all'
  | 'clothes-style'
  | 'sneakers-shoes'
  | 'beauty-fragrance'
  | 'art-decor-crafts'
  | 'electronics-accessories'
  | 'home-living'
  | 'health-wellness';

export interface Seller {
  bannerUrl: string;
  shopName: string;
  id: string;
  fullName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  createdAt: string;
  updatedAt?: string;
  bio?: string;
  avatarUrl?: string;
  theme?: string;
  location?: string;
  city?: string;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  hasPhysicalShop?: boolean;
  website?: string;
  socialMedia?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  };
  instagramLink?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  sellerId: string;
  seller?: Seller;
  isSold: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  createdAt: string;
  updatedAt: string;
  aesthetic: Aesthetic;
  category?: string;
  condition?: 'new' | 'used' | 'refurbished';
  stock?: number;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  images?: string[];
  specifications?: Record<string, string>;
  shippingInfo?: {
    weight?: number;
    dimensions?: string;
    freeShipping?: boolean;
    processingTime?: string;
  };
  is_digital?: boolean;
  digital_file_path?: string;
  digital_file_name?: string;
  digital_file_size?: number;
  product_type?: ProductType;
  productType?: ProductType;
  is_custom_product?: boolean;
  isCustomProduct?: boolean;
  production_days?: number | null;
  productionDays?: number | null;
  customization_prompt?: string | null;
  customizationPrompt?: string | null;
  is_imported_product?: boolean;
  isImportedProduct?: boolean;
  import_days?: number | null;
  importDays?: number | null;
  import_note?: string | null;
  importNote?: string | null;
  service_locations?: string;
  service_options?: {
    availability_days?: string[];
    location_type?: 'buyer_visits_seller' | 'seller_visits_buyer' | 'hybrid';
    price_type?: 'hourly' | 'fixed';
    start_time?: string;
    end_time?: string;
  };
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl: string;
  sellerId: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'collection_pending' | 'completed';
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  notes?: string;
}

export interface CartItem extends Omit<OrderItem, 'id'> {
  id?: string;
  inStock: boolean;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  discount?: {
    code: string;
    amount: number;
    type: 'percentage' | 'fixed';
  };
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  mobilePayment?: string;
  whatsappNumber?: string;
  role: 'customer' | 'seller' | 'admin';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    currency?: string;
    notifications?: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };
  addresses?: Address[];
  paymentMethods?: PaymentMethod[];
}

export interface Address {
  id: string;
  type: 'shipping' | 'billing';
  isDefault: boolean;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export type PaymentProvider = 'paystack' | 'mpesa';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'mobile_money' | 'bank_transfer';
  isDefault: boolean;
  card?: {
    last4: string;
    brand: string;
    expMonth: number;
    expYear: number;
  };
  paypalEmail?: string;
  mobileNumber?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  likes: number;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'order' | 'product' | 'promotion' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  status?: string;
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

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

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed' | 'completed' | 'paid' | 'cancelled' | 'manual_review';

// ProductType and Theme now live in ./primitives (re-exported at the top of this file).



