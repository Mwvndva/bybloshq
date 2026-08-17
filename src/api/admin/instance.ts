import { defaultUniversalClient } from '@/lib/http/UniversalHttpClient';
import { getFreshCsrfToken, getCachedCsrfToken, setCachedCsrfToken } from '@/lib/auth/WebAuthStrategy';

type AxiosInstance = import('axios').AxiosInstance;

export interface ApiError {
  message: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
    status?: number;
  };
  config?: import('axios').AxiosRequestConfig;
  code?: string;
  request?: unknown;
}

export const adminApiInstance: AxiosInstance = defaultUniversalClient.getAxiosInstance();
export const api = adminApiInstance;

export type AdminLogisticsStatusFilter =
  | 'all'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'manual_review'
  | 'overdue';

export interface AdminLogisticsResponse {
  sort: import('@/api/logistics').LogisticsSort;
  count: number;
  requests: import('@/api/logistics').LogisticsRequestCard[];
  groups: {
    pickupDelivery: import('@/api/logistics').LogisticsRequestCard[];
    deliveryOnly: import('@/api/logistics').LogisticsRequestCard[];
    pickupOnly: import('@/api/logistics').LogisticsRequestCard[];
    hubDropoff: import('@/api/logistics').LogisticsRequestCard[];
    completed: import('@/api/logistics').LogisticsRequestCard[];
  };
  status: AdminLogisticsStatusFilter;
  summary: {
    failed: number;
    delayed: number;
    manualReview: number;
  };
}

export { getCachedCsrfToken as csrfTokenCache, setCachedCsrfToken as setCsrfTokenCache, setCachedCsrfToken };
