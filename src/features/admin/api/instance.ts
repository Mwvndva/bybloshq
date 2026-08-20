import { defaultUniversalClient } from '@/infrastructure/http/UniversalHttpClient';
import { getFreshCsrfToken, getCachedCsrfToken, setCachedCsrfToken } from '@/infrastructure/auth/WebAuthStrategy';

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
  sort: import('@/features/logistics/api').LogisticsSort;
  count: number;
  requests: import('@/features/logistics/api').LogisticsRequestCard[];
  groups: {
    pickupDelivery: import('@/features/logistics/api').LogisticsRequestCard[];
    deliveryOnly: import('@/features/logistics/api').LogisticsRequestCard[];
    pickupOnly: import('@/features/logistics/api').LogisticsRequestCard[];
    hubDropoff: import('@/features/logistics/api').LogisticsRequestCard[];
    completed: import('@/features/logistics/api').LogisticsRequestCard[];
  };
  status: AdminLogisticsStatusFilter;
  summary: {
    failed: number;
    delayed: number;
    manualReview: number;
  };
}

export { getCachedCsrfToken as csrfTokenCache, setCachedCsrfToken as setCsrfTokenCache, setCachedCsrfToken };
