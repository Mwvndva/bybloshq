import apiClient from '@/lib/apiClient';
import { logisticsHeaders } from './auth';

export type LogisticsSort = 'priority' | 'deadline' | 'oldest_paid' | 'newest_paid';
export type LogisticsLegType = 'pickup' | 'delivery';
export type LogisticsStatusUpdate =
  | 'pickup_pending'
  | 'pickup_assigned'
  | 'pickup_started'
  | 'picked_up_from_seller'
  | 'dropped_at_hub'
  | 'pickup_failed'
  | 'delivery_pending'
  | 'courier_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'delivery_delayed';

export interface LogisticsLocation {
  label?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mapLink?: string | null;
}

export interface LogisticsLeg {
  id: number;
  status: string;
  feeAmount: number;
  feeCurrency: string;
  feeStatus: string;
  distanceKm?: number | null;
  origin: LogisticsLocation;
  destination: LogisticsLocation;
  deadlineAt?: string | null;
  completedAt?: string | null;
}

export interface LogisticsRequestCard {
  id: number;
  packageCode?: string;
  group: 'pickup_delivery' | 'delivery_only' | 'pickup_only' | 'hub_dropoff' | 'completed';
  status: string;
  deadlineAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isCompleted?: boolean;
  isOverdue: boolean;
  order: {
    id: number;
    orderNumber: string;
    totalAmount: number;
    paymentStatus: string;
    status?: string | null;
    paidAt?: string | null;
    completedAt?: string | null;
    createdAt?: string;
  };
  partner?: {
    id?: number | null;
    name?: string | null;
    phone?: string | null;
    whatsappNumber?: string | null;
  } | null;
  product: {
    items: Array<{
      id: number;
      productId?: number | null;
      name: string;
      price: number | string;
      quantity: number;
      subtotal: number | string;
      imageUrl?: string | null;
      productType?: string | null;
    }>;
    summary: string;
  };
  seller: {
    id?: number | null;
    name?: string | null;
    shopName?: string | null;
    phone?: string | null;
    physicalAddress?: string | null;
    location?: string | null;
    mapLink?: string | null;
  };
  buyer: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  pickupLeg?: LogisticsLeg | null;
  deliveryLeg?: LogisticsLeg | null;
  pickupFeeStatus: string;
  deliveryFeeStatus: string;
  sellerDropoff: LogisticsLocation;
  events: Array<{
    id: number;
    type: string;
    status: string;
    message?: string | null;
    source?: string | null;
    actorLabel?: string | null;
    createdAt?: string | null;
  }>;
  dispute?: {
    resolution?: string;
    note?: string | null;
    admin_id?: number | null;
    updated_at?: string;
  } | null;
}

export interface LogisticsDashboardResponse {
  sort: LogisticsSort;
  count: number;
  requests: LogisticsRequestCard[];
  groups: {
    pickupDelivery: LogisticsRequestCard[];
    deliveryOnly: LogisticsRequestCard[];
    pickupOnly: LogisticsRequestCard[];
    hubDropoff: LogisticsRequestCard[];
    completed: LogisticsRequestCard[];
  };
}

export async function fetchLogisticsRequests(sort: LogisticsSort = 'priority') {
  const response = await apiClient.get('/logistics/requests', {
    params: { sort },
    headers: logisticsHeaders(),
  });
  return response.data?.data as LogisticsDashboardResponse;
}

export async function updateLogisticsLegStatus({
  requestId,
  legType,
  status,
}: {
  requestId: number;
  legType: LogisticsLegType;
  status: LogisticsStatusUpdate;
}) {
  const response = await apiClient.patch(
    `/logistics/requests/${requestId}/legs/${legType}/status`,
    { status },
    { headers: logisticsHeaders() }
  );
  return response.data?.data as {
    updated: boolean;
    requestId: number;
    legId: number;
    legType: LogisticsLegType;
    previousStatus: string;
    status: string;
    externalStatus: LogisticsStatusUpdate;
    logisticsStatus: string;
    updatedAt?: string;
  };
}


