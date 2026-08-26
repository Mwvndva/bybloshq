import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { WebAuthStrategy, getFreshCsrfToken, setCachedCsrfToken } from './WebAuthStrategy';
import { StorageAdapter } from './types';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

describe('WebAuthStrategy', () => {
  let mockStorage: StorageAdapter;
  let strategy: WebAuthStrategy;
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setCachedCsrfToken(null);

    mockStorage = {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    strategy = new WebAuthStrategy(mockStorage);
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('obtains CSRF token via getCsrfHeader() when cache is empty', async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: { data: { csrfToken: 'token-abc-123' } },
    });

    const header = await strategy.getCsrfHeader();

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/public/csrf-token'),
      { withCredentials: true }
    );
    expect(header).toEqual({ 'X-CSRF-Token': 'token-abc-123' });
  });

  it('reuses cached CSRF token within TTL', async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: { data: { csrfToken: 'token-abc-123' } },
    });

    const header1 = await strategy.getCsrfHeader();
    dateSpy.mockReturnValue(1_000_000 + 5 * 60 * 1000); // + 5 minutes
    const header2 = await strategy.getCsrfHeader();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(header1).toEqual({ 'X-CSRF-Token': 'token-abc-123' });
    expect(header2).toEqual({ 'X-CSRF-Token': 'token-abc-123' });
  });

  it('fetches a new CSRF token after TTL expiration', async () => {
    (axios.get as any)
      .mockResolvedValueOnce({
        data: { data: { csrfToken: 'token-first' } },
      })
      .mockResolvedValueOnce({
        data: { data: { csrfToken: 'token-second' } },
      });

    const header1 = await strategy.getCsrfHeader();
    expect(header1).toEqual({ 'X-CSRF-Token': 'token-first' });

    // Advance beyond 10-minute TTL (10 * 60 * 1000 ms)
    dateSpy.mockReturnValue(1_000_000 + 11 * 60 * 1000);

    const header2 = await strategy.getCsrfHeader();

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(header2).toEqual({ 'X-CSRF-Token': 'token-second' });
  });

  it('executes POST /auth/refresh-token with credentials and CSRF header on handleUnauthorized', async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: { data: { csrfToken: 'csrf-token-xyz' } },
    });
    (axios.post as any).mockResolvedValueOnce({ status: 200, data: { status: 'success' } });

    const success = await strategy.handleUnauthorized();

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh-token'),
      {},
      {
        withCredentials: true,
        headers: { 'X-CSRF-Token': 'csrf-token-xyz' },
      }
    );
    expect(success).toBe(true);
  });

  it('reports refresh failure when POST /auth/refresh-token rejects', async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: { data: { csrfToken: 'csrf-token-xyz' } },
    });
    (axios.post as any).mockRejectedValueOnce(new Error('Network error'));

    const success = await strategy.handleUnauthorized();

    expect(success).toBe(false);
  });
});
