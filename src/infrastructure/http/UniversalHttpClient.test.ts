import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { UniversalHttpClient } from './UniversalHttpClient';
import { AuthStrategy } from '../auth/types';
import {
  registerAppNavigator,
  clearAppNavigator,
  SESSION_EXPIRED_EVENT,
} from '../navigation/navigationService';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  const createMockAxios = () => {
    const inst = vi.fn() as any;
    inst.interceptors = {
      request: {
        use: vi.fn((fn) => {
          inst._requestInterceptor = fn;
        }),
      },
      response: {
        use: vi.fn((_s, fn) => {
          inst._responseErrorInterceptor = fn;
        }),
      },
    };
    inst.get = vi.fn().mockImplementation(async (url: string, config?: any) => {
      const fullConfig = { url, method: 'get', headers: {}, ...config };
      const intercepted = inst._requestInterceptor ? await inst._requestInterceptor(fullConfig) : fullConfig;
      return inst(intercepted);
    });
    inst.post = vi.fn().mockImplementation(async (url: string, data?: any, config?: any) => {
      const fullConfig = { url, method: 'post', data, headers: {}, ...config };
      const intercepted = inst._requestInterceptor ? await inst._requestInterceptor(fullConfig) : fullConfig;
      return inst(intercepted);
    });
    return inst;
  };
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn().mockImplementation(createMockAxios),
    },
  };
});

describe('UniversalHttpClient single-flight & 401 refresh hardening', () => {
  let mockAuthStrategy: AuthStrategy;
  let client: UniversalHttpClient;
  let innerAxios: any;
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNavigate = vi.fn();
    registerAppNavigator(mockNavigate);

    mockAuthStrategy = {
      platform: 'web',
      getAuthHeaders: vi.fn().mockResolvedValue({}),
      getCsrfHeader: vi.fn().mockResolvedValue({ 'X-CSRF-Token': 'csrf-123' }),
      handleUnauthorized: vi.fn(),
      clearSession: vi.fn().mockResolvedValue(undefined),
    };

    client = new UniversalHttpClient({
      authStrategy: mockAuthStrategy,
      defaultRole: 'buyer',
    });

    innerAxios = client.getAxiosInstance();
  });

  it('coalesces concurrent 401 requests into a single refresh call and replays all original requests', async () => {
    let refreshCount = 0;
    (mockAuthStrategy.handleUnauthorized as any).mockImplementation(async () => {
      refreshCount++;
      return true;
    });

    innerAxios.mockImplementation(async (config: any) => {
      if (!config._refreshRetried) {
        const err: any = new Error('Unauthorized');
        err.response = { status: 401, data: { message: 'Unauthorized' } };
        err.config = config;
        return innerAxios._responseErrorInterceptor(err);
      }
      return { status: 200, data: { success: true, url: config.url } };
    });

    // Simulate 3 concurrent requests (A, B, C)
    const promiseA = client.get('/buyer/profile');
    const promiseB = client.get('/buyer/orders');
    const promiseC = client.get('/buyer/settings');

    const results = await Promise.all([promiseA, promiseB, promiseC]);

    // Assertions
    expect(refreshCount).toBe(1);
    expect(mockAuthStrategy.handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
    expect(results[0].data.success).toBe(true);
    expect(results[1].data.success).toBe(true);
    expect(results[2].data.success).toBe(true);
  });

  it('_refreshRetried prevents infinite retry loops when replay returns 401 again', async () => {
    (mockAuthStrategy.handleUnauthorized as any).mockResolvedValue(true);

    innerAxios.mockImplementation(async (config: any) => {
      const err: any = new Error('Unauthorized');
      err.response = { status: 401, data: { message: 'Unauthorized' } };
      err.config = config;
      return innerAxios._responseErrorInterceptor(err);
    });

    await expect(client.get('/buyer/profile')).rejects.toThrow('Unauthorized');

    expect(mockAuthStrategy.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('/auth/refresh-token, /login, and /logout are never recursively refreshed', async () => {
    (mockAuthStrategy.handleUnauthorized as any).mockResolvedValue(true);

    const errRefresh: any = new Error('Unauthorized');
    errRefresh.response = { status: 401, data: { message: 'Unauthorized' } };
    errRefresh.config = { url: '/auth/refresh-token' };

    await expect(innerAxios._responseErrorInterceptor(errRefresh)).rejects.toThrow('Unauthorized');
    expect(mockAuthStrategy.handleUnauthorized).not.toHaveBeenCalled();

    const errLogin: any = new Error('Unauthorized');
    errLogin.response = { status: 401, data: { message: 'Unauthorized' } };
    errLogin.config = { url: '/buyers/login' };

    await expect(innerAxios._responseErrorInterceptor(errLogin)).rejects.toThrow('Unauthorized');
    expect(mockAuthStrategy.handleUnauthorized).not.toHaveBeenCalled();
  });

  it('emits session expiration event when 401 refresh fails', async () => {
    (mockAuthStrategy.handleUnauthorized as any).mockResolvedValue(false);

    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    innerAxios.mockImplementation(async (config: any) => {
      const err: any = new Error('Unauthorized');
      err.response = { status: 401, data: { message: 'Unauthorized' } };
      err.config = config;
      return innerAxios._responseErrorInterceptor(err);
    });

    await expect(client.get('/buyer/profile')).rejects.toThrow('Unauthorized');

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ redirectPath: '/buyer/login' });

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    clearAppNavigator(mockNavigate);
  });
});
