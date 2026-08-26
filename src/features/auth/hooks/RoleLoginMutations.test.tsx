import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useSellerLoginMutation,
  useCreatorLoginMutation,
  useMarketingLoginMutation,
  useLogisticsLoginMutation,
} from './useAuthMutations';
import apiClient from '@/infrastructure/http/apiClient';

vi.mock('@/infrastructure/http/apiClient', () => ({
  __esModule: true,
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Role Login Mutations - Canonical Transport Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seller login mutation uses sellerApi and POST /sellers/login', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          seller: { id: 1, email: 'seller@byblos.test', shopName: 'Test Shop' },
          token: 'seller-token-123',
        },
      },
    });

    const { result } = renderHook(() => useSellerLoginMutation(), { wrapper: createWrapper() });

    result.current.mutate({ email: 'seller@byblos.test', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/sellers/login', {
      email: 'seller@byblos.test',
      password: 'password123',
    });
    expect(result.current.data?.token).toBe('seller-token-123');
  });

  it('creator login mutation uses POST /creators/login', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          creator: { id: 2, email: 'creator@byblos.test' },
          token: 'creator-token-456',
        },
      },
    });

    const { result } = renderHook(() => useCreatorLoginMutation(), { wrapper: createWrapper() });

    result.current.mutate({ email: 'creator@byblos.test', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/creators/login', {
      email: 'creator@byblos.test',
      password: 'password123',
    });
    expect(result.current.data?.token).toBe('creator-token-456');
  });

  it('marketing login mutation uses POST /admin/marketing/login', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          user: { id: 3, email: 'marketing@byblos.test', role: 'marketing' },
          token: 'marketing-token-789',
        },
      },
    });

    const { result } = renderHook(() => useMarketingLoginMutation(), { wrapper: createWrapper() });

    result.current.mutate({ email: 'marketing@byblos.test', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/admin/marketing/login', {
      email: 'marketing@byblos.test',
      password: 'password123',
    });
    expect(result.current.data?.token).toBe('marketing-token-789');
  });

  it('logistics login mutation uses POST /logistics/login', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          partner: { id: 4, name: 'Mzigo Logistics Partner' },
          token: 'logistics-token-abc',
        },
      },
    });

    const { result } = renderHook(() => useLogisticsLoginMutation(), { wrapper: createWrapper() });

    result.current.mutate({ email: 'logistics@byblos.test', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/logistics/login', {
      email: 'logistics@byblos.test',
      password: 'password123',
    });
    expect(result.current.data?.token).toBe('logistics-token-abc');
  });
});
