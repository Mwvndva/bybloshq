import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sellerProductsApi } from './productsApi';
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

describe('sellerProductsApi transport & transformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes getProducts through canonical apiClient without fetch fallback', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        products: [
          {
            id: 'p-101',
            name: 'Handcrafted Vase',
            price: '2500.50',
            status: 'available',
            seller_id: 'seller-77',
          },
        ],
      },
    });

    const products = await sellerProductsApi.getProducts();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/sellers/products');
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe('p-101');
    expect(products[0].price).toBe(2500.5);
    expect(products[0].sellerId).toBe('seller-77');
  });

  it('returns empty array cleanly when apiClient returns non-object payload', async () => {
    (apiClient.get as any).mockResolvedValue({ data: null });

    const products = await sellerProductsApi.getProducts();

    expect(apiClient.get).toHaveBeenCalledWith('/sellers/products');
    expect(products).toEqual([]);
  });
});
