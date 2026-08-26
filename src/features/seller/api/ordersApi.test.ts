import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sellerOrdersApi } from './ordersApi';
import apiClient from '@/infrastructure/http/apiClient';

vi.mock('@/infrastructure/http/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getFreshCsrfToken: vi.fn().mockResolvedValue('csrf-token-123'),
}));

describe('sellerOrdersApi transport & transformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes getOrders(params) through canonical apiClient passing query params', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        orders: [
          {
            id: 'ord-99',
            totalAmount: 1500,
            status: 'PENDING',
          },
        ],
      },
    });

    const params = { status: 'PENDING' as const, page: 1, limit: 10 };
    const orders = await sellerOrdersApi.getOrders(params);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/sellers/orders', { params });
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('ord-99');
  });

  it('returns empty array [] fallback when response body is empty or invalid', async () => {
    (apiClient.get as any).mockResolvedValue({ data: null });

    const orders = await sellerOrdersApi.getOrders();

    expect(apiClient.get).toHaveBeenCalledWith('/sellers/orders', { params: undefined });
    expect(orders).toEqual([]);
  });
});
