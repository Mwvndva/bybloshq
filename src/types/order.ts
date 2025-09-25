import { OrderStatus, PaymentStatus, Order as BaseOrder, OrderItem, Payment } from '@/api/orderApi';

export interface Order extends BaseOrder {}

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
