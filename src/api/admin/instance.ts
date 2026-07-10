import axios from 'axios';
import { getFreshCsrfToken } from '@/lib/apiClient';
import { buildApiBaseUrl } from '@/lib/apiBaseUrl';

// Type for axios instance
type AxiosInstance = import('axios').AxiosInstance;

// Type definitions for error handling
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

const API_BASE_URL = buildApiBaseUrl();

// Create axios instance with default config
export const adminApiInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// CSRF Token Cache for admin instance
export let csrfTokenCache: string | null = null;

export function setCsrfTokenCache(val: string | null) {
  csrfTokenCache = val;
}

// Request Interceptor for CSRF
api.interceptors.request.use(
  async (config: import('axios').InternalAxiosRequestConfig) => {
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      if (!csrfTokenCache) {
        csrfTokenCache = await getFreshCsrfToken();
      }
      if (csrfTokenCache) {
        config.headers['X-CSRF-Token'] = csrfTokenCache;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('admin_authenticated');
      console.log('Admin 401 - global interceptor will handle redirect');
    }
    return Promise.reject(error);
  }
);


