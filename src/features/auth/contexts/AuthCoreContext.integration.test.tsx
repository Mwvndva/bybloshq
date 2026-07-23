import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCoreProvider } from './AuthCoreContext';
import { useGlobalAuth } from '../hooks/useGlobalAuth';

function renderWithProviders(ui: React.ReactElement, initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mocks = vi.hoisted(() => {
  const mockBuyerApi = {
    getProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    updateProfile: vi.fn(),
  };

  const mockSellerApi = {
    getProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    updateProfile: vi.fn(),
  };

  const mockAdminApi = {
    getMe: vi.fn(),
    login: vi.fn(),
  };

  const mockApiClient = {
    post: vi.fn(),
  };

  const mockAuthStateManager = {
    setRehydrating: vi.fn(),
  };

  const mockToast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });

  return {
    mockBuyerApi,
    mockSellerApi,
    mockAdminApi,
    mockApiClient,
    mockAuthStateManager,
    mockToast,
  };
});

vi.mock('@/api/buyer', () => ({
  __esModule: true,
  default: mocks.mockBuyerApi,
}));

vi.mock('@/api/seller', () => ({
  sellerApi: mocks.mockSellerApi,
}));

vi.mock('@/api/admin', () => ({
  __esModule: true,
  default: mocks.mockAdminApi,
  adminApi: mocks.mockAdminApi,
}));

vi.mock('@/lib/apiClient', () => ({
  __esModule: true,
  default: mocks.mockApiClient,
}));

vi.mock('@/lib/authState', () => ({
  authStateManager: mocks.mockAuthStateManager,
}));

vi.mock('@/features/auth/services/authSession', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/auth/services/authSession')>();
  return {
    ...mod,
    clearRoleSessionMarkers: vi.fn(),
  };
});


vi.mock('@/components/LoadingScreen', () => ({
  LoadingScreen: ({ message }: { message: string }) => <div data-testid="loading">{message}</div>,
}));

vi.mock('sonner', () => ({
  toast: mocks.mockToast,
}));

function AuthProbe() {
  const auth = useGlobalAuth();
  return (
    <div>
      <span data-testid="role">{auth.role || 'none'}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="profile-email">{auth.user?.profile?.email || 'none'}</span>
    </div>
  );
}

function BuyerLoginProbe() {
  const auth = useGlobalAuth();
  return (
    <div>
      <button type="button" onClick={() => auth.login('buyer@byblos.test', 'secret', 'buyer')}>
        Login buyer
      </button>
      <span data-testid="role">{auth.role || 'none'}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="profile-email">{auth.user?.profile?.email || 'none'}</span>
    </div>
  );
}

describe('AuthCoreProvider integration', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    cleanup();
  });

  it('downgrades stale admin auth on focus when backend session is no longer valid', async () => {
    mocks.mockAdminApi.getMe.mockResolvedValueOnce({
      id: 1,
      email: 'admin@byblos.test',
      is_verified: true,
      createdAt: '2026-05-09T00:00:00.000Z',
    });

    renderWithProviders(
      <AuthCoreProvider>
        <AuthProbe />
      </AuthCoreProvider>,
      ['/admin/dashboard']
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('profile-email')).toHaveTextContent('admin@byblos.test');
    });

    expect(mocks.mockAdminApi.getMe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('adminSessionActive')).toBe('true');

    mocks.mockAdminApi.getMe.mockRejectedValueOnce({ response: { status: 401 } });
    nowSpy.mockReturnValue(1_000_000 + 6 * 60 * 1000);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('none');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });

    expect(mocks.mockAdminApi.getMe.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem('adminSessionActive')).toBeNull();
  });

  it('persists buyer auth marker after successful login without relying on page reload state', async () => {
    mocks.mockBuyerApi.login.mockResolvedValueOnce({
      buyer: {
        id: 7,
        fullName: 'Buyer Seven',
        email: 'buyer@byblos.test',
        is_verified: true,
      },
    });

    renderWithProviders(
      <AuthCoreProvider>
        <BuyerLoginProbe />
      </AuthCoreProvider>,
      ['/buyer/login']
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Login buyer' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login buyer' }));

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('buyer');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('profile-email')).toHaveTextContent('buyer@byblos.test');
    });

    expect(mocks.mockBuyerApi.login).toHaveBeenCalledWith({
      email: 'buyer@byblos.test',
      password: 'secret',
    });
    expect(localStorage.getItem('buyerSessionActive')).toBe('true');
    expect(localStorage.getItem('sellerSessionActive')).toBeNull();
    expect(localStorage.getItem('adminSessionActive')).toBeNull();
  });
});


