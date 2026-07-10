import axios from 'axios';
import { getFreshCsrfToken, getCachedCsrfToken } from '@/lib/apiClient';
import { buildApiBaseUrl } from '@/lib/apiBaseUrl';
import { transformProduct, type ApiProduct } from './productTransforms';
import { transformSeller, type ApiPublicSeller } from './sellerTransforms';

type AxiosInstance = import('axios').AxiosInstance;

export interface CustomAxiosRequestConfig extends Record<string, unknown> {
  skipAuth?: boolean;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

class CustomAxios {
  private instance: AxiosInstance;

  constructor() {
    const baseURL = buildApiBaseUrl();

    this.instance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.instance.interceptors.request.use(
      async (config: import('axios').InternalAxiosRequestConfig) => {
        if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
          let token = getCachedCsrfToken();
          if (!token) {
            token = await getFreshCsrfToken();
          }
          if (token) {
            config.headers['X-CSRF-Token'] = token;
          }
        }
        if (config.headers) {
          delete config.headers.Authorization;
          delete config.headers.authorization;
        }
        return config;
      },
      (error: import('axios').AxiosError) => {
        throw error;
      }
    );

    this.instance.interceptors.response.use(
      (response: import('axios').AxiosResponse) => response,
      async (error: import('axios').AxiosError) => {
        const status = error.response?.status;
        const message = error.response?.data ? (error.response.data as Record<string, unknown>).message || '' : '';
        const config = error.config;

        if (status === 403 && typeof message === 'string' && message.includes('CSRF mismatch') && config && !(config as { _retry?: boolean })._retry) {
          (config as import('axios').InternalAxiosRequestConfig & { _retry?: boolean })._retry = true;
          console.warn('[CSRF-Public] Mismatch detected. Refreshing token and retrying...');

          const newToken = await getFreshCsrfToken();
          if (newToken) {
            config.headers['X-CSRF-Token'] = newToken;
            return this.instance(config);
          }
        }
        throw error;
      }
    );
  }

  public getInstance() {
    return this.instance;
  }

  public get(url: string, config?: CustomAxiosRequestConfig) {
    return this.instance.get(url, config);
  }

  public post(url: string, data?: unknown, config?: CustomAxiosRequestConfig) {
    return this.instance.post(url, data, config);
  }

  public put(url: string, data?: unknown, config?: CustomAxiosRequestConfig) {
    return this.instance.put(url, data, config);
  }

  public delete(url: string, config?: CustomAxiosRequestConfig) {
    return this.instance.delete(url, config);
  }
}

export const publicApi = new CustomAxios();

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProductListResponse {
  products: ApiProduct[];
  pagination: PaginationMeta;
}

export interface SellerListResponse {
  sellers: ApiPublicSeller[];
  pagination: PaginationMeta;
}


