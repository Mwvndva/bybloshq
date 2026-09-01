// Auth session-security regression tests (no DB required).
//
// Covers the AUTH audit fix: logout must revoke BOTH the access token and the
// refresh token, and the refresh flow must reject a revoked refresh token.
// Also pins the JWT-hardening behaviour (algorithm confusion, tampering, wrong
// secret) that the audit verified as safe.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../src/shared/utils/jwt.js';
import { generateRefreshToken, refreshAccessToken } from '../src/shared/utils/refreshToken.js';
import { revokeSessionTokens } from '../src/shared/utils/sessionRevocation.js';
import tokenBlacklist from '../src/domains/identity/tokens/tokenBlacklist.service.js';

describe('refresh-token revocation (logout must end the session)', () => {
  before(() => {
    // Guard: these tests are meaningless without the signing secrets.
    assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be set in .env.test');
  });

  it('mints a fresh access token for a valid, non-revoked refresh token', async () => {
    const rt = generateRefreshToken(4242, 'seller');
    const { accessToken, refreshToken: rolled, user } = await refreshAccessToken(rt);

    const decoded = verifyToken(accessToken);
    assert.equal(decoded.id, 4242);
    assert.equal(decoded.role, 'seller');
    assert.equal(user.id, 4242);
    // A refresh token is rolled back to the caller. (Note: with no jti/nonce it is
    // byte-identical when re-issued within the same second — see audit finding on
    // single-use rotation.) Assert it is a usable refresh token, not that it differs.
    const rolledDecoded = jwt.decode(rolled);
    assert.equal(rolledDecoded.type, 'refresh');
    assert.equal(rolledDecoded.id, 4242);
  });

  it('REJECTS a refresh token that was revoked on logout (the fix)', async () => {
    const rt = generateRefreshToken(777, 'buyer');
    const { exp } = jwt.decode(rt);

    // Simulate logout revoking the refresh token.
    await tokenBlacklist.addToken(rt, exp);

    await assert.rejects(
      () => refreshAccessToken(rt),
      /revoked/i,
      'a revoked refresh token must not be able to mint access tokens'
    );
  });
});

describe('revokeSessionTokens', () => {
  it('blacklists BOTH the access token and the refresh token on a request', async () => {
    const access = signToken(555, 'seller');
    const refresh = generateRefreshToken(555, 'seller');

    const req = {
      headers: { authorization: `Bearer ${access}` },
      cookies: { refreshToken: refresh },
    };

    await revokeSessionTokens(req);

    assert.equal(await tokenBlacklist.isBlacklisted(access), true, 'access token revoked');
    assert.equal(await tokenBlacklist.isBlacklisted(refresh), true, 'refresh token revoked');
  });
});

describe('JWT hardening (audit-verified safe behaviour)', () => {
  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ id: 1, role: 'admin' }, 'not-the-real-secret', { algorithm: 'HS256' });
    assert.throws(() => verifyToken(forged), /invalid token/i);
  });

  it('rejects an algorithm-confusion (alg:none) token', () => {
    // Hand-craft an unsigned token: header.payload with an empty signature.
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const noneToken = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: 1, role: 'admin' })}.`;
    assert.throws(() => verifyToken(noneToken), /invalid token/i);
  });

  it('rejects a tampered payload', () => {
    const good = signToken(9, 'buyer');
    const [h, , s] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ id: 9, role: 'admin' })).toString('base64url');
    assert.throws(() => verifyToken(`${h}.${forgedPayload}.${s}`), /invalid token/i);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ id: 3, role: 'buyer' }, process.env.JWT_SECRET, {
      algorithm: 'HS256', expiresIn: '-1s',
    });
    assert.throws(() => verifyToken(expired), /expired/i);
  });
});
