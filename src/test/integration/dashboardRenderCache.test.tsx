import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerDashboard from '@/features/buyer/pages/BuyerDashboard';
import SellerDashboard from '@/features/seller/pages/SellerDashboard';

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
        fullName: 'Ada Lovelace',
        shopName: 'AdaShop',
        email: 'seller@byblos.test',
        whatsappNumber: '0712345678',
      },
      isLoading: false,
      logout: vi.fn(),
      updateSellerProfile: vi.fn(),
    },
    currentRole: 'buyer',
  };

  return {
    auth,
    buyerApi,
    sellerApi,
    toast,
  };
});

vi.mock('@/features/buyer/api', () => ({
  __esModule: true,
  default: mocks.buyerApi,
}));

vi.mock('@/features/seller/api', () => ({
  sellerApi: mocks.sellerApi,
}));

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({
    activeRole: mocks.auth.currentRole,
    roles: ['buyer', 'seller'],
    user: mocks.auth.currentRole === 'seller'
      ? { role: 'seller', profile: mocks.auth.seller.seller }
      : { role: 'buyer', profile: mocks.auth.buyer.user },
    isAuthenticated: true,
    logout: mocks.auth.seller.logout,
    updateProfile: vi.fn(),
  }),
}));

vi.mock('@/features/auth/components/AccountSwitcher', () => ({
  AccountSwitcher: () => <div data-testid="account-switcher" />,
}));

vi.mock('@/features/buyer/hooks/useWishlist', () => ({
  useWishlist: () => ({ wishlist: [] }),
}));

vi.mock('@/features/shop/components/SellerBrandCard', () => ({
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

vi.mock('@/features/shop/components/SellersGrid', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="sellers-grid">
      <span>Online Alpha</span>
      <span>Physical Beta</span>
    </div>
  ),
}));

vi.mock('@/features/seller/components/SellerProfileHero', () => ({
  SellerProfileHero: ({ sellerProfile }: { sellerProfile?: { shopName?: string } }) => (
    <section data-testid="seller-analytics">
      <span>{sellerProfile?.shopName || 'Shop'}</span>
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

    const firstRender = renderWithProviders(<BuyerDashboard />, queryClient, '/buyer/dashboard');

    await waitFor(() => {
      expect(screen.getAllByText('Online Alpha').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Physical Beta').length).toBeGreaterThan(0);
    });

    firstRender.unmount();

    renderWithProviders(<BuyerDashboard />, queryClient, '/buyer/dashboard');

    expect(screen.getAllByText('Online Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Physical Beta').length).toBeGreaterThan(0);
  });

  it('seller dashboard reuses products, analytics, and orders cache across remounts', async () => {
    mocks.auth.currentRole = 'seller';
    const queryClient = createTestQueryClient();

    const firstRender = renderWithProviders(<SellerDashboard />, queryClient, '/seller/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Welcome, Ada')).toBeInTheDocument();
      expect(screen.getByTestId('seller-analytics')).toHaveTextContent('AdaShop');
    });
    expect(mocks.sellerApi.getProducts).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getAnalytics).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getOrders).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    renderWithProviders(<SellerDashboard />, queryClient, '/seller/dashboard');

    expect(screen.getByText('Welcome, Ada')).toBeInTheDocument();
    expect(screen.getByTestId('seller-analytics')).toHaveTextContent('AdaShop');
    expect(mocks.sellerApi.getProducts).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getAnalytics).toHaveBeenCalledTimes(1);
    expect(mocks.sellerApi.getOrders).toHaveBeenCalledTimes(1);
  });
});
