import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { AndroidAuthStrategy } from './AndroidAuthStrategy';
import { StorageAdapter } from './types';
import { BYBLOS_AUTH_KEYS } from '../storage/storage';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(),
    },
  };
});

describe('AndroidAuthStrategy', () => {
  let mockStorage: Record<string, string>;
  let storageAdapter: StorageAdapter;
  let strategy: AndroidAuthStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};

    storageAdapter = {
      getItem: vi.fn().mockImplementation(async (key: string) => mockStorage[key] || null),
      setItem: vi.fn().mockImplementation(async (key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn().mockImplementation(async (key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn().mockImplementation(async () => {
        mockStorage = {};
      }),
    };

    strategy = new AndroidAuthStrategy(storageAdapter);
  });

  describe('Token Precedence & Bearer Header', () => {
    it('uses 1. explicit role token when present', async () => {
      mockStorage['sellerToken'] = 'seller-jwt-123';
      mockStorage[BYBLOS_AUTH_KEYS.ACTIVE_ROLE] = 'buyer';
      mockStorage['buyerToken'] = 'buyer-jwt-456';
      mockStorage[BYBLOS_AUTH_KEYS.TOKEN] = 'default-jwt-789';

      const headers = await strategy.getAuthHeaders('seller');
      expect(headers).toEqual({ Authorization: 'Bearer seller-jwt-123' });
    });

    it('falls back to 2. active role token when requested role token is missing', async () => {
      mockStorage[BYBLOS_AUTH_KEYS.ACTIVE_ROLE] = 'creator';
      mockStorage['creatorToken'] = 'creator-jwt-456';
      mockStorage[BYBLOS_AUTH_KEYS.TOKEN] = 'default-jwt-789';

      const headers = await strategy.getAuthHeaders('seller');
      expect(headers).toEqual({ Authorization: 'Bearer creator-jwt-456' });
    });

    it('falls back to 3. byblos.auth.token when role and activeRole tokens are missing', async () => {
      mockStorage[BYBLOS_AUTH_KEYS.TOKEN] = 'fallback-token-789';

      const headers = await strategy.getAuthHeaders('seller');
      expect(headers).toEqual({ Authorization: 'Bearer fallback-token-789' });
    });

    it('returns empty headers when no token is found', async () => {
      const headers = await strategy.getAuthHeaders('seller');
      expect(headers).toEqual({});
    });
  });

  describe('CSRF Exemption', () => {
    it('returns empty CSRF headers on Android', async () => {
      const headers = await strategy.getCsrfHeader();
      expect(headers).toEqual({});
    });
  });

  describe('Android Refresh', () => {
    it('persists new access and refresh tokens and uses updated token on next request', async () => {
      mockStorage['sellerRefreshToken'] = 'seller-ref-token';

      (axios.post as any).mockResolvedValueOnce({
        data: {
          data: {
            accessToken: 'new-seller-access-token',
            refreshToken: 'new-seller-refresh-token',
          },
        },
      });

      const success = await strategy.handleUnauthorized('seller');

      expect(success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh-token'),
        { refreshToken: 'seller-ref-token' },
        { withCredentials: true }
      );
      expect(mockStorage['sellerToken']).toBe('new-seller-access-token');
      expect(mockStorage['sellerRefreshToken']).toBe('new-seller-refresh-token');

      // Subsequent auth header request uses updated token
      const headers = await strategy.getAuthHeaders('seller');
      expect(headers).toEqual({ Authorization: 'Bearer new-seller-access-token' });
    });

    it('handles missing refresh token gracefully and returns false', async () => {
      const success = await strategy.handleUnauthorized('seller');
      expect(success).toBe(false);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('clears refresh token in storage when refresh request fails', async () => {
      mockStorage['sellerRefreshToken'] = 'invalid-ref-token';
      (axios.post as any).mockRejectedValueOnce(new Error('Invalid token'));

      const success = await strategy.handleUnauthorized('seller');

      expect(success).toBe(false);
      expect(mockStorage['sellerRefreshToken']).toBeUndefined();
    });
  });
});
