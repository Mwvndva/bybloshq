import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { buildApiBaseUrl } from './apiBaseUrl';
import { isNativeApp } from '../navigation/mobileApp';
import { AuthStrategy, AppRole, StorageAdapter } from '../auth/types';
import { WebAuthStrategy, getFreshCsrfToken } from '../auth/WebAuthStrategy';
import { AndroidAuthStrategy } from '../auth/AndroidAuthStrategy';
import { createDefaultStorageAdapter } from '../auth/adapters';
import { emitSessionExpired } from '../navigation/navigationService';

export interface UniversalHttpClientOptions {
  storageAdapter?: StorageAdapter;
  authStrategy?: AuthStrategy;
  defaultRole?: AppRole;
}

export class UniversalHttpClient {
  private instance: AxiosInstance;
  private authStrategy: AuthStrategy;
  private defaultRole?: AppRole;
  private refreshPromise: Promise<boolean> | null = null;

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
    const cleanUrl = url.split('?')[0];
    if (/(^\/|^\/api\/)seller(\/|$)/.test(cleanUrl)) return 'seller';
    if (/(^\/|^\/api\/)creator(\/|$)/.test(cleanUrl)) return 'creator';
    if (/(^\/|^\/api\/)admin(\/|$)/.test(cleanUrl)) return 'admin';
    if (/(^\/|^\/api\/)logistics(\/|$)/.test(cleanUrl) || /(^\/|^\/api\/)mzigo(\/|$)/.test(cleanUrl)) return 'logistics';
    if (/(^\/|^\/api\/)marketing(\/|$)/.test(cleanUrl)) return 'marketing';
    if (/(^\/|^\/api\/)buyer(\/|$)/.test(cleanUrl) || /(^\/|^\/api\/)orders(\/|$)/.test(cleanUrl)) return 'buyer';
    return this.defaultRole;
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        const role = this.resolveRole(url);

        const isUnauthenticatedRoute = url.includes('/login') || url.includes('/register') || url.includes('/csrf-token') || url.includes('/forgot-password') || url.includes('/reset-password');

        // 1. Attach Auth Headers if strategy provides them (unless it's an unauthenticated login/register route)
        if (!isUnauthenticatedRoute) {
          const authHeaders = await this.authStrategy.getAuthHeaders(role);
          Object.assign(config.headers, authHeaders);
        }

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

        // 2. Handle 401 Unauthorized - Single-Flight Silent Token Refresh (Retry 1x)
        if (status === 401 && !config._refreshRetried) {
          const url = config.url || '';
          if (!url.includes('/auth/refresh-token') && !url.includes('/login') && !url.includes('/logout')) {
            config._refreshRetried = true;
            const role = this.resolveRole(url);

            if (role === 'marketing') {
              await this.authStrategy.clearSession('marketing');
              emitSessionExpired('/admin/marketing/login');
              throw error;
            }

            if (!this.refreshPromise) {
              this.refreshPromise = this.authStrategy.handleUnauthorized(role).finally(() => {
                this.refreshPromise = null;
              });
            }

            const refreshed = await this.refreshPromise;
            if (refreshed) {
              const updatedAuthHeaders = await this.authStrategy.getAuthHeaders(role);
              Object.assign(config.headers, updatedAuthHeaders);
              return this.instance(config);
            } else if (role) {
              const ROLE_LOGIN_ROUTES: Record<AppRole, string> = {
                admin: '/admin/login',
                marketing: '/admin/marketing/login',
                seller: '/seller/login',
                creator: '/creator/login',
                logistics: '/logistics/login',
                buyer: '/buyer/login',
              };
              emitSessionExpired(ROLE_LOGIN_ROUTES[role]);
            }
          }
        }

        // 3. UI Toast Alerts for non-retryable errors
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          toast.error('Connection Timeout', {
            description: 'The server took too long to respond. Please check your connection and try again.',
            duration: 5000,
          });
        } else if (status && status >= 500) {
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

  public get<T = unknown>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config);
  }

  public post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config);
  }

  public put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config);
  }

  public patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.patch<T>(url, data, config);
  }

  public delete<T = unknown>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config);
  }
}

export const defaultUniversalClient = new UniversalHttpClient();
