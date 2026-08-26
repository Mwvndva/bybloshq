import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforceSingleActiveRole, getActiveRole, getSessionKey } from './authSession';
import { storage } from '@/infrastructure/storage/storage';
import apiClient from '@/infrastructure/http/apiClient';

vi.mock('@/infrastructure/http/apiClient', () => ({
  __esModule: true,
  default: {
    post: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
  },
}));

describe('authSession - enforceSingleActiveRole()', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await storage.clear();
  });

  it('purges inactive role tokens and session markers, calls server token revocation, and sets new active role', async () => {
    // Setup previous session state for seller and creator
    await storage.set('sellerToken', 'old-seller-jwt');
    await storage.set('sellerRefreshToken', 'old-seller-refresh');
    await storage.set(getSessionKey('seller'), 'true');

    await storage.set('creatorToken', 'old-creator-jwt');
    await storage.set('creatorRefreshToken', 'old-creator-refresh');
    await storage.set(getSessionKey('creator'), 'true');

    // Enforce buyer as the new active role
    await enforceSingleActiveRole('buyer');

    // 1. Client cleanup verification
    expect(await storage.get('sellerToken')).toBeNull();
    expect(await storage.get('sellerRefreshToken')).toBeNull();
    expect(await storage.get(getSessionKey('seller'))).toBeNull();

    expect(await storage.get('creatorToken')).toBeNull();
    expect(await storage.get('creatorRefreshToken')).toBeNull();
    expect(await storage.get(getSessionKey('creator'))).toBeNull();

    // 2. Server token revocation verification
    expect(apiClient.post).toHaveBeenCalledWith('/auth/revoke-token', {
      tokens: expect.arrayContaining(['old-seller-jwt', 'old-creator-jwt']),
    });

    // 3. New active role verification
    const activeRole = await getActiveRole();
    expect(activeRole).toBe('buyer');
  });
});
