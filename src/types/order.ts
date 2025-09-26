// Order status types
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled' | 'awaiting_payment';

export interface OrderItem {
  id: number;
  product_id: number | string;
  product_name: string;
  product_description?: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string;
  transaction_id: string;
  status: PaymentStatus;
  captured: boolean;
  refunded_amount: number;
  failure_code?: string;
  failure_message?: string;
  card_last4?: string;
  card_brand?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface OrderAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

export interface Order {
  id: number;
  buyer_id: number;
  order_number: string;
  total_amount: number;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  status_updated_at?: string;
  status_updated_by?: string;
  shipping_address: OrderAddress;
  billing_address: OrderAddress;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payments: Payment[];
  status_history?: Array<{
    status: OrderStatus;
    created_at: string;
    changed_by?: string;
    notes?: string;
  }>;
  metadata?: Record<string, any>;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery_date?: string;
}

export interface OrderFilters {
  status?: OrderStatus | 'all';
  paymentStatus?: PaymentStatus | 'all';
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'total_amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  totalAmount: number;
}

export interface OrderTimelineEvent {
  id: number;
  status: string;
  timestamp: string;
  changedBy?: string;
  notes?: string;
  amount?: number;
  paymentMethod?: string;
}

export interface OrderWithTimeline extends Order {
  timeline: OrderTimelineEvent[];
  statusHistory: Array<{
    status: OrderStatus;
    created_at: string;
    changed_by?: string;
    notes?: string;
  }>;
  payments: Payment[];
  items: OrderItem[];
}
