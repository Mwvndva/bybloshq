
export type Aesthetic = 
  | 'all'
  | 'nairobi noir'
  | 'earth girl/boy'
  | 'brands'
  | 'corporate'
  | 'street wear'
  | 'baddie'
  | 'island boy/girl'
  | 'old money'
  | 'gothic';

export interface Seller {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  };
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
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
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
  success: boolean;
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
