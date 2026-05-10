import { publicApi } from './publicApi';

export interface PublicTrackingLeg {
  type: 'pickup' | 'delivery';
  status?: string | null;
  eta?: string | null;
  origin?: {
    label?: string | null;
    address?: string | null;
  };
  destination?: {
    label?: string | null;
    address?: string | null;
  };
  safeNote?: string | null;
}

export interface PublicTrackingEvent {
  type?: string | null;
  status?: string | null;
  message?: string | null;
  source?: string | null;
  createdAt?: string | null;
}

export interface PublicTrackingData {
  audience: 'buyer' | 'seller';
  orderNumber: string;
  shopName: string;
  status: string;
  eta?: string | null;
  estimate: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  delivery?: PublicTrackingLeg | null;
  pickup?: PublicTrackingLeg | null;
  timeline: PublicTrackingEvent[];
}

export async function fetchPublicTracking(token: string) {
  const response = await publicApi.get(`/tracking/${encodeURIComponent(token)}`);
  return response.data?.data as PublicTrackingData;
}
