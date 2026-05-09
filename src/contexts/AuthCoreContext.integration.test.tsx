import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCoreProvider, useGlobalAuth } from './AuthCoreContext';

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

vi.mock('@/api/buyerApi', () => ({
  __esModule: true,
  default: mocks.mockBuyerApi,
}));

vi.mock('@/api/sellerApi', () => ({
  sellerApi: mocks.mockSellerApi,
}));

vi.mock('@/api/adminApi', () => ({
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

vi.mock('@/lib/authCleanup', () => ({
  clearAllAuthData: vi.fn(),
}));

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

describe('AuthCoreProvider integration', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('downgrades stale admin auth on focus when backend session is no longer valid', async () => {
    mocks.mockAdminApi.getMe.mockResolvedValueOnce({
      id: 1,
      email: 'admin@byblos.test',
      is_verified: true,
      createdAt: '2026-05-09T00:00:00.000Z',
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <AuthCoreProvider>
          <AuthProbe />
        </AuthCoreProvider>
      </MemoryRouter>
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
});
