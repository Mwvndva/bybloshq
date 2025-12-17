// These types should match the database enum values
export type OrderStatus = 'PENDING' | 'DELIVERY_PENDING' | 'DELIVERY_COMPLETE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed'; // Payment status is lowercase in DB

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface OrderSeller {
  id: string;
  name: string;
  shopName?: string;
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
}
