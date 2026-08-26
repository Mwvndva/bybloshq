import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrders } from './orders';
import { buyerApiInstance } from './instance';

vi.mock('./instance', () => ({
  buyerApiInstance: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('buyer orders API transport & normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes getOrders through buyerApiInstance and upper-cases status strings', async () => {
    (buyerApiInstance.get as any).mockResolvedValue({
      data: [
        {
          id: 'buyer-ord-50',
          status: 'pending',
          paymentStatus: 'completed',
          items: [{ id: 'item-1', name: 'Product A' }],
        },
      ],
    });

    const orders = await getOrders();

    expect(buyerApiInstance.get).toHaveBeenCalledTimes(1);
    expect(buyerApiInstance.get).toHaveBeenCalledWith('/orders/user');
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('buyer-ord-50');
    expect(orders[0].status).toBe('PENDING');
    expect(orders[0].paymentStatus).toBe('COMPLETED');
  });

  it('returns [] when buyerApiInstance returns null or non-object response', async () => {
    (buyerApiInstance.get as any).mockResolvedValue({ data: null });

    const orders = await getOrders();

    expect(buyerApiInstance.get).toHaveBeenCalledWith('/orders/user');
    expect(orders).toEqual([]);
  });
});
