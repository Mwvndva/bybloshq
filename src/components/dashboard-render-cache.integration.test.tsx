import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerDashboard from './buyer/BuyerDashboard';
import SellerDashboard from './seller/SellerDashboard';

const mocks = vi.hoisted(() => {
  const toast = vi.fn();
  const buyerApi = {
    getOrders: vi.fn(),
    getShops: vi.fn(),
    leaveClient: vi.fn(),
  };
  const sellerApi = {
    deleteProduct: vi.fn(),
    getAnalytics: vi.fn(),
    getOrders: vi.fn(),
    getProducts: vi.fn(),
    getWithdrawalRequests: vi.fn(),
    requestWithdrawal: vi.fn(),
    updateProduct: vi.fn(),
  };
  const auth = {
    buyer: {
      user: {
        id: 1,
        fullName: 'Buyer One',
        email: 'buyer@byblos.test',
        city: 'Nairobi',
        location: 'CBD',
        mobilePayment: '0712345678',
        whatsappNumber: '0712345678',
        refunds: 0,
      },
      logout: vi.fn(),
      updateBuyerProfile: vi.fn(),
    },
    seller: {
      seller: {
        id: 9,
        fullName: 'Ada Seller',
        shopName: 'AdaShop',
        email: 'seller@byblos.test',
        whatsappNumber: '0712345678',
      },
      isLoading: false,
      logout: vi.fn(),
      updateSellerProfile: vi.fn(),
    },
  };

  return {
    auth,
    buyerApi,
    sellerApi,
    toast,
  };
});

vi.mock('@/api/buyer', () => ({
  __esModule: true,
  default: mocks.buyerApi,
}));

vi.mock('@/api/seller', () => ({
  sellerApi: mocks.sellerApi,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/features/auth/contexts', () => ({
  useBuyerAuth: () => mocks.auth.buyer,
  useSellerAuth: () => mocks.auth.seller,
}));

vi.mock('@/hooks/useWishlist', () => ({
  useWishlist: () => ({ wishlist: [] }),
}));

vi.mock('@/components/SellerBrandCard', () => ({
  __esModule: true,
  default: ({ seller, showUnfollow, onUnfollow }: { seller: { shopName?: string, name?: string }, showUnfollow?: boolean, onUnfollow?: (s: unknown) => void }) => (
    <article data-testid="seller-brand-card">
      <span>{seller.shopName || seller.name}</span>
      {showUnfollow && (
        <button type="button" onClick={() => onUnfollow(seller)}>
          Unfollow {seller.shopName || seller.name}
        </button>
      )}
    </article>
  ),
}));

vi.mock('@/components/SellersGrid', () => ({
  __esModule: true,
  default: () => <div data-testid="sellers-grid" />,
}));

vi.mock('@/components/ProductGrid', () => ({
  __esModule: true,
  default: () => <div data-testid="product-grid" />,
}));

vi.mock('@/components/orders/OrdersSection', () => ({
  __esModule: true,
  default: () => <div data-testid="buyer-orders" />,
}));

vi.mock('@/components/AestheticCategories', () => ({
  __esModule: true,
  default: () => <div data-testid="aesthetic-categories" />,
}));

vi.mock('@/components/buyer/WishlistSection', () => ({
  __esModule: true,
  default: () => <div data-testid="wishlist-section" />,
}));

vi.mock('@/components/buyer/RefundCard', () => ({
  __esModule: true,
  default: () => <div data-testid="refund-card" />,
}));

vi.mock('@/components/seller/UnifiedAnalyticsHub', () => ({
  UnifiedAnalyticsHub: ({ analytics }: { analytics: { totalProducts?: number, clientCount?: number } }) => (
    <section data-testid="seller-analytics">
      <span>Products: {analytics.totalProducts}</span>
      <span>Followers: {analytics.clientCount}</span>
    </section>
  ),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement, queryClient: QueryClient, route: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('dashboard render and cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mocks.buyerApi.getOrders.mockResolvedValue([]);
    mocks.buyerApi.getShops.mockResolvedValue([
      {
        id: 101,
        shopName: 'Online Alpha',
        hasPhysicalShop: false,
        clientCount: 3,
      },
      {
        id: 202,
        shopName: 'Physical Beta',
        hasPhysicalShop: true,
        physicalAddress: 'Nairobi CBD',
        clientCount: 8,
      },
    ]);

    mocks.sellerApi.getProducts.mockResolvedValue([
      { id: 'p-1', name: 'Hat', price: 500, status: 'available' },
    ]);
    mocks.sellerApi.getAnalytics.mockResolvedValue({
      totalProducts: 1,
      totalSales: 2,
      totalRevenue: 1000,
      balance: 400,
      clientCount: 11,
      wishlistCount: 5,
      clickCount: 7,
      monthlySales: [],
      recentOrders: [
        {
          id: 'o-1',
          orderNumber: '#BYB-1',
          status: 'DELIVERY_PENDING',
          totalAmount: 500,
          createdAt: '2026-05-09T00:00:00.000Z',
          items: [{ quantity: 1, product_name: 'Hat' }],
        },
      ],
    });
    mocks.sellerApi.getOrders.mockResolvedValue([
      { id: 'o-1', createdAt: '2026-05-09T00:00:00.000Z' },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('buyer dashboard reuses followed-shop cache across remounts', async () => {
    const queryClient = createTestQueryClient();

    const firstRender = renderWithProviders(<BuyerDashboard />, queryClient, '/buyer/shops');

    await waitFor(() => {
      expect(screen.getAllByText('Online Alpha').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Physical Beta').length).toBeGreaterThan(0);
    });
    expect(mocks.buyerApi.getShops).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    renderWithProviders(<BuyerDashboard />, queryClient, '/buyer/shops');

    expect(screen.getAllByText('Online Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Physical Beta').length).toBeGreaterThan(0);
    expect(mocks.buyerApi.getShops).toHaveBeenCalledTimes(1);
  });

  it('seller dashboard reuses products, analytics, and orders cache across remounts', async () => {
    const queryClient = createTestQueryClient();

    const firstRender = renderWithProviders(<SellerDashboard />, queryClient, '/seller/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Welcome, Ada')).toBeInTheDocument();
      expect(screen.getByTestId('seller-analytics')).toHaveTextContent('Products: 1');
    });
    expect(mocks.sellerApi.getProducts).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getAnalytics).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getOrders).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    renderWithProviders(<SellerDashboard />, queryClient, '/seller/dashboard');

    expect(screen.getByText('Welcome, Ada')).toBeInTheDocument();
    expect(screen.getByTestId('seller-analytics')).toHaveTextContent('Followers: 11');
    expect(mocks.sellerApi.getProducts).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getAnalytics).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getOrders).toHaveBeenCalledTimes(1);
  });
});


