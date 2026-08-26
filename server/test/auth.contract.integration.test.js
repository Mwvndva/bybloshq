import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import expressLoader from '../src/application/bootstrap/express.js';
import AuthService from '../src/domains/identity/auth/auth.service.js';
import LogisticsDashboardService from '../src/domains/logistics/logisticsDashboard.service.js';
import { signToken, verifyToken } from '../src/shared/utils/jwt.js';
import { generateRefreshToken } from '../src/shared/utils/refreshToken.js';
import TokenBlacklistService from '../src/domains/identity/tokens/tokenBlacklist.service.js';

describe('Backend Authentication & HTTP Transport Contract Integration', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Stub AuthService.login and LogisticsDashboardService.login to test contract handling deterministically
    AuthService.login = async (email, password, type) => {
      if (password !== 'ValidPassword123!') return null;
      const role = type || 'buyer';
      const idMap = { buyer: 101, seller: 102, creator: 103, admin: 104, marketing: 105, logistics: 106 };
      const userId = idMap[role] || 999;
      const token = signToken(userId, role, { email });
      const profile = { id: `prof-${role}-1`, email, role };
      return { user: { id: userId, email, role, is_verified: true }, profile, token };
    };

    LogisticsDashboardService.login = async ({ email, password }) => {
      if (password !== 'ValidPassword123!') throw new Error('Invalid email or password');
      const token = signToken(106, 'logistics', { email: email || 'logistics@test.com' });
      return { token, partner: { id: 'l-1', name: 'Logistics Partner' } };
    };

    const app = express();
    await expressLoader(app);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. SIX-ROLE LOGIN CONTRACT
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Six-Role Login Contract', () => {
    it('Buyer login returns HTTP 200, buyer token, refreshToken, and sets jwt cookie', async () => {
      const res = await fetch(`${baseUrl}/api/buyers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'buyer@test.com', password: 'ValidPassword123!' }),
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Set-Cookie header must contain jwt cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.token, 'Response must include data.token');
      assert.ok(json.data.refreshToken, 'Buyer response must include data.refreshToken');

      const decoded = verifyToken(json.data.token);
      assert.strictEqual(decoded.role, 'buyer');
    });

    it('Seller login returns HTTP 200, seller token, refreshToken, and sets jwt cookie', async () => {
      const res = await fetch(`${baseUrl}/api/sellers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'seller@test.com', password: 'ValidPassword123!' }),
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Set-Cookie header must contain jwt cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.token);
      assert.ok(json.data.refreshToken);

      const decoded = verifyToken(json.data.token);
      assert.strictEqual(decoded.role, 'seller');
    });

    it('Creator login returns HTTP 200, creator token, refreshToken, and sets jwt cookie', async () => {
      const res = await fetch(`${baseUrl}/api/creators/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'creator@test.com', password: 'ValidPassword123!' }),
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Set-Cookie header must contain jwt cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.token);
      assert.ok(json.data.refreshToken);

      const decoded = verifyToken(json.data.token);
      assert.strictEqual(decoded.role, 'creator');
    });

    it('Admin login returns HTTP 200, admin token, and sets jwt cookie', async () => {
      const res = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@test.com', password: 'ValidPassword123!' }),
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Set-Cookie header must contain jwt cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.token);

      const decoded = verifyToken(json.data.token);
      assert.strictEqual(decoded.role, 'admin');
    });

    it('Marketing login returns HTTP 200, marketing token, and sets jwt cookie', async () => {
      const res = await fetch(`${baseUrl}/api/admin/marketing/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'marketing@test.com', password: 'ValidPassword123!' }),
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Set-Cookie header must contain jwt cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.token);

      const decoded = verifyToken(json.data.token);
      assert.strictEqual(decoded.role, 'marketing');
    });

    it('Logistics login returns HTTP 200, logistics token, and sets jwt cookie', async () => {
      const res = await fetch(`${baseUrl}/api/logistics/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'logistics@test.com', password: 'ValidPassword123!' }),
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Set-Cookie header must contain jwt cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.token);

      const decoded = verifyToken(json.data.token);
      assert.strictEqual(decoded.role, 'logistics');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. WEB CSRF ENFORCEMENT
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Web CSRF Enforcement', () => {
    it('State-changing POST request from Web origin without X-CSRF-Token is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/sellers/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ name: 'Unprotected Product' }),
      });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.status, 'error');
      assert.ok(json.message.includes('CSRF mismatch'));
    });

    it('State-changing POST request from Web origin with valid csrf-token-v2 cookie + matching X-CSRF-Token passes CSRF', async () => {
      const token = 'csrf-secret-token-abc-123';
      const res = await fetch(`${baseUrl}/api/sellers/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          Cookie: `csrf-token-v2=${token}`,
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({ name: 'Protected Product' }),
      });

      // Does not fail with 403 CSRF error (may return 401 unauthenticated, but CSRF passed)
      assert.notStrictEqual(res.status, 403);
    });

    it('GET request from Web origin is exempt from CSRF validation', async () => {
      const res = await fetch(`${baseUrl}/api/public/csrf-token`, {
        method: 'GET',
        headers: { Origin: 'http://localhost:3000' },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.csrfToken);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. NATIVE CSRF EXEMPTION & ANTI-SPOOFING
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Native CSRF Exemption & Anti-Spoofing', () => {
    it('Legitimate Native Capacitor request (Origin: https://localhost) with Bearer token is exempt from CSRF', async () => {
      const sellerToken = signToken(102, 'seller');
      const res = await fetch(`${baseUrl}/api/sellers/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://localhost',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({ name: 'Native Product' }),
      });

      // Exemption allows request past CSRF middleware (will not return 403 CSRF mismatch)
      assert.notStrictEqual(res.status, 403);
    });

    it('Browser Web origin supplying X-Platform: android header without CSRF token is NOT exempt (rejected 403)', async () => {
      const sellerToken = signToken(102, 'seller');
      const res = await fetch(`${baseUrl}/api/sellers/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          'X-Platform': 'android',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({ name: 'Spoofed Native Product' }),
      });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.ok(json.message.includes('CSRF mismatch'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. REFRESH TOKEN CONTRACT
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Refresh Token Contract', () => {
    it('WEB mode: POST /api/auth/refresh-token with cookie & CSRF header returns new tokens and updates cookies', async () => {
      const oldRefreshToken = generateRefreshToken(101, 'buyer');
      const csrfToken = 'csrf-web-token-refresh';

      // Ensure 1s delay so JWT iat timestamp advances for rotation assertion
      await new Promise((resolve) => setTimeout(resolve, 1050));

      const res = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          Cookie: `csrf-token-v2=${csrfToken}; refreshToken=${oldRefreshToken}`,
          'X-CSRF-Token': csrfToken,
        },
      });

      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes('jwt='), 'Must set updated jwt access cookie');
      assert.ok(setCookie.includes('refreshToken='), 'Must set updated refreshToken cookie');

      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.accessToken);
      assert.ok(json.data.refreshToken);
      assert.notStrictEqual(json.data.refreshToken, oldRefreshToken, 'Rolling refresh token must be newly generated');
    });

    it('NATIVE mode: POST /api/auth/refresh-token with JSON payload & Native Origin returns data.accessToken and data.refreshToken', async () => {
      const oldRefreshToken = generateRefreshToken(102, 'seller');

      // Ensure 1s delay so JWT iat timestamp advances for rotation assertion
      await new Promise((resolve) => setTimeout(resolve, 1050));

      const res = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://localhost',
        },
        body: JSON.stringify({ refreshToken: oldRefreshToken }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.accessToken);
      assert.ok(json.data.refreshToken);
      assert.strictEqual(json.data.user.id, 102);
      assert.strictEqual(json.data.user.role, 'seller');
      assert.notStrictEqual(json.data.refreshToken, oldRefreshToken);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. TOKEN REVOCATION CONTRACT
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Token Revocation Contract', () => {
    it('POST /api/auth/revoke-token handles single token payload (Native Origin)', async () => {
      const tokenToRevoke = signToken(101, 'buyer');

      const res = await fetch(`${baseUrl}/api/auth/revoke-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://localhost',
        },
        body: JSON.stringify({ token: tokenToRevoke }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
    });

    it('POST /api/auth/revoke-token handles multi-token payload (Native Origin)', async () => {
      const token1 = signToken(101, 'buyer');
      const token2 = signToken(102, 'seller');

      const res = await fetch(`${baseUrl}/api/auth/revoke-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://localhost',
        },
        body: JSON.stringify({ tokens: [token1, token2] }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
    });

    it('POST /api/auth/revoke-token handles Authorization Bearer header fallback (Native Origin)', async () => {
      const tokenToRevoke = signToken(103, 'creator');

      const res = await fetch(`${baseUrl}/api/auth/revoke-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://localhost',
          Authorization: `Bearer ${tokenToRevoke}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
    });

    it('POST /api/auth/revoke-token handles malformed or expired tokens gracefully (Native Origin)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/revoke-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://localhost',
        },
        body: JSON.stringify({ tokens: ['malformed-token-xyz', null, ''] }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
    });

    it('Revoked token is rejected by protect middleware with HTTP 401', async () => {
      const token = signToken(104, 'admin');

      // Blacklist token directly via TokenBlacklistService
      const decoded = verifyToken(token);
      await TokenBlacklistService.addToken(token, decoded.exp);

      // Attempt protected request using revoked token
      const res = await fetch(`${baseUrl}/api/admin/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.ok(json.message.includes('invalidated') || json.message.includes('logged in'));
    });
  });
});
