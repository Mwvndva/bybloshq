import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { buildApiBaseUrl } from '../apiBaseUrl';
import { isNativeApp } from '../mobileApp';
import { AuthStrategy, AppRole, StorageAdapter } from '../auth/types';
import { WebAuthStrategy, getFreshCsrfToken } from '../auth/WebAuthStrategy';
import { AndroidAuthStrategy } from '../auth/AndroidAuthStrategy';
import { createDefaultStorageAdapter } from '../auth/adapters';

export interface UniversalHttpClientOptions {
  storageAdapter?: StorageAdapter;
  authStrategy?: AuthStrategy;
  defaultRole?: AppRole;
}

export class UniversalHttpClient {
  private instance: AxiosInstance;
  private authStrategy: AuthStrategy;
  private defaultRole?: AppRole;

  constructor(options: UniversalHttpClientOptions = {}) {
    const baseURL = buildApiBaseUrl();
    const storage = options.storageAdapter || createDefaultStorageAdapter();

    this.authStrategy = options.authStrategy || (
      isNativeApp() ? new AndroidAuthStrategy(storage) : new WebAuthStrategy(storage)
    );
    this.defaultRole = options.defaultRole;

    this.instance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true,
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private resolveRole(url: string): AppRole | undefined {
    if (url.includes('/sellers')) return 'seller';
    if (url.includes('/creators')) return 'creator';
    if (url.includes('/admin')) return 'admin';
    if (url.includes('/buyers')) return 'buyer';
    if (url.includes('/logistics') || url.includes('/mzigo')) return 'logistics';
    return this.defaultRole;
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        const role = this.resolveRole(url);

        // 1. Attach Auth Headers if strategy provides them (e.g. Android Bearer header)
        const authHeaders = await this.authStrategy.getAuthHeaders(role);
        Object.assign(config.headers, authHeaders);

        // 2. Attach CSRF header on state-changing requests if strategy provides one (Web mode)
        const method = config.method ? config.method.toLowerCase() : 'get';
        if (!['get', 'head', 'options'].includes(method)) {
          const csrfHeaders = await this.authStrategy.getCsrfHeader();
          Object.assign(config.headers, csrfHeaders);
        }

        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const message = (error.response?.data as { message?: string })?.message || error.message || 'An error occurred';
        const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; _refreshRetried?: boolean }) | undefined;

        if (!config) throw error;

        // 1. Handle 403 Forbidden - Potential CSRF Mismatch (Retry 1x)
        if (status === 403 && typeof message === 'string' && message.includes('CSRF mismatch') && !config._retry) {
          config._retry = true;
          console.warn('[UniversalHttpClient] CSRF mismatch detected. Refreshing token and retrying...');
          const newToken = await getFreshCsrfToken();
          if (newToken) {
            config.headers['X-CSRF-Token'] = newToken;
            return this.instance(config);
          }
        }

        // 2. Handle 401 Unauthorized - Silent Token Refresh (Retry 1x)
        if (status === 401 && !config._refreshRetried) {
          const url = config.url || '';
          if (!url.includes('/auth/refresh-token') && !url.includes('/login') && !url.includes('/logout')) {
            config._refreshRetried = true;
            const role = this.resolveRole(url);
            const refreshed = await this.authStrategy.handleUnauthorized(role);
            if (refreshed) {
              const updatedAuthHeaders = await this.authStrategy.getAuthHeaders(role);
              Object.assign(config.headers, updatedAuthHeaders);
              return this.instance(config);
            }
          }
        }

        // 3. UI Toast Alerts for non-retryable errors
        if (status && status >= 500) {
          toast.error('Server Error', {
            description: 'Something went wrong on our end. Please try again later.',
            duration: 5000,
          });
        } else if (status === 429) {
          toast.error('Too Many Requests', {
            description: 'Please slow down and try again in a moment.',
            duration: 4000,
          });
        }

        throw error;
      }
    );
  }

  public getAxiosInstance(): AxiosInstance {
    return this.instance;
  }

  public get<T = unknown>(url: string, config?: InternalAxiosRequestConfig) {
    return this.instance.get<T>(url, config);
  }

  public post<T = unknown>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) {
    return this.instance.post<T>(url, data, config);
  }

  public put<T = unknown>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) {
    return this.instance.put<T>(url, data, config);
  }

  public patch<T = unknown>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) {
    return this.instance.patch<T>(url, data, config);
  }

  public delete<T = unknown>(url: string, config?: InternalAxiosRequestConfig) {
    return this.instance.delete<T>(url, config);
  }
}

export const defaultUniversalClient = new UniversalHttpClient();
