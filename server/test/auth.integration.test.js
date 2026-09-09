// Integration tests for AuthService.login() -- the single shared entry point
// for buyer, seller, creator, admin, and marketing logins -- against a REAL
// database. There was zero coverage of authentication before this file,
// which is how three real bugs shipped unnoticed:
//
//   1. Every "soft" login error (EMAIL_NOT_VERIFIED, PENDING_VERIFICATION,
//      ACCOUNT_DEACTIVATED, TERMS_NOT_ACCEPTED, role mismatch) was a plain
//      Error with a manually-set .statusCode instead of an AppError, so
//      globalErrorHandler's isOperational check masked all of them as a
//      generic 500 "Something went wrong!" in production.
//   2. The terms-acceptance login gate never actually fired for buyers
//      (read profile.terms_accepted, but Buyer.findByUserId returns
//      camelCase) or sellers (findSellerByUserId's SELECT didn't even
//      include the column) -- anyone with terms_accepted = false could log
//      in anyway.
//   3. seller.auth.controller.js's login catch block had no branch for
//      ACCOUNT_DEACTIVATED and no generic fallback, so a deactivated
//      seller saw a hardcoded "Login failed. Please try again." with the
//      real reason discarded.
//
// Each `it` below is a direct regression test for one of those.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { pool } from '../src/infrastructure/database/database.js';
import { AppError } from '../src/shared/utils/errorHandler.js';

const AuthService = (await import('../src/domains/identity/auth/auth.service.js')).default;

const PASSWORD = 'TestPass123!';
let passwordHash;

const createdUserIds = [];

async function makeUser({ role, isVerified = true, isActive = true }) {
  passwordHash = passwordHash || (await bcrypt.hash(PASSWORD, 12));
  const email = `auth-it-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.byblos.local`;
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, email`,
    [email, passwordHash, role, isVerified, isActive]
  );
  const userId = rows[0].id;
  createdUserIds.push(userId);

  const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE slug = $1', [role]);
  if (roleRows[0]) {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleRows[0].id]
    );
  }

  return { id: userId, email };
}

async function makeBuyerProfile(userId, email, { termsAccepted = true } = {}) {
  await pool.query(
    `INSERT INTO buyers (user_id, full_name, email, mobile_payment, terms_accepted)
     VALUES ($1, 'Auth IT Buyer', $2, $3, $4)`,
    [userId, email, `0722${String(userId).padStart(6, '0')}`, termsAccepted]
  );
}

async function makeSellerProfile(userId, email, { termsAccepted = true } = {}) {
  await pool.query(
    `INSERT INTO sellers (user_id, full_name, email, shop_name, whatsapp_number, terms_accepted, location)
     VALUES ($1, 'Auth IT Seller', $2, $3, $4, $5, 'Nairobi')`,
    [userId, email, `Auth IT Shop ${userId}`, `0722${String(userId).padStart(6, '0')}`, termsAccepted]
  );
}

async function makeCreatorProfile(userId, email) {
  await pool.query(
    `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number)
     VALUES ($1, 'Auth', 'IT Creator', $2, $3)`,
    [userId, email, `0722${String(userId).padStart(6, '0')}`]
  );
}

after(async () => {
  if (createdUserIds.length) {
    await pool.query('DELETE FROM buyers WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM sellers WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM creators WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
  }
});

async function assertAppErrorRejection(promise, { statusCode, code }) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof AppError, `expected an AppError instance, got ${err.constructor?.name}: ${err.message}`);
    assert.equal(err.isOperational, true, 'AppError must be isOperational so globalErrorHandler shows the real message instead of masking it as a 500');
    assert.equal(err.statusCode, statusCode);
    if (code) assert.equal(err.code, code);
    return true;
  });
}

describe('AuthService.login — invalid credentials', () => {
  test('wrong password returns null (not a thrown error) for every role', async () => {
    for (const role of ['buyer', 'seller', 'creator']) {
      const user = await makeUser({ role });
      if (role === 'buyer') await makeBuyerProfile(user.id, user.email);
      if (role === 'seller') await makeSellerProfile(user.id, user.email);
      if (role === 'creator') await makeCreatorProfile(user.id, user.email);

      const result = await AuthService.login(user.email, 'WrongPassword1!', role);
      assert.equal(result, null, `${role} login with wrong password should return null`);
    }
  });

  test('nonexistent email returns null', async () => {
    const result = await AuthService.login('nonexistent-auth-it@test.byblos.local', PASSWORD, 'buyer');
    assert.equal(result, null);
  });

  test('missing email/password throws a 400 AppError, not a crash', async () => {
    await assertAppErrorRejection(AuthService.login('', PASSWORD, 'buyer'), { statusCode: 400 });
    await assertAppErrorRejection(AuthService.login('someone@test.byblos.local', '', 'buyer'), { statusCode: 400 });
  });
});

describe('AuthService.login — email verification gate', () => {
  test('unverified buyer login throws AppError(403, EMAIL_NOT_VERIFIED)', async () => {
    const user = await makeUser({ role: 'buyer', isVerified: false });
    await makeBuyerProfile(user.id, user.email);
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'buyer'), {
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  test('unverified seller login throws AppError(403, EMAIL_NOT_VERIFIED)', async () => {
    const user = await makeUser({ role: 'seller', isVerified: false });
    await makeSellerProfile(user.id, user.email);
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'seller'), {
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  test('unverified creator login throws AppError(403, EMAIL_NOT_VERIFIED)', async () => {
    const user = await makeUser({ role: 'creator', isVerified: false });
    await makeCreatorProfile(user.id, user.email);
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'creator'), {
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });
});

describe('AuthService.login — account deactivation gate', () => {
  test('deactivated buyer login throws AppError(403, ACCOUNT_DEACTIVATED)', async () => {
    const user = await makeUser({ role: 'buyer', isActive: false });
    await makeBuyerProfile(user.id, user.email);
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'buyer'), {
      statusCode: 403,
      code: 'ACCOUNT_DEACTIVATED',
    });
  });

  test('deactivated seller login throws AppError(403, ACCOUNT_DEACTIVATED)', async () => {
    const user = await makeUser({ role: 'seller', isActive: false });
    await makeSellerProfile(user.id, user.email);
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'seller'), {
      statusCode: 403,
      code: 'ACCOUNT_DEACTIVATED',
    });
  });

  test('deactivated creator login throws AppError(403, ACCOUNT_DEACTIVATED)', async () => {
    const user = await makeUser({ role: 'creator', isActive: false });
    await makeCreatorProfile(user.id, user.email);
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'creator'), {
      statusCode: 403,
      code: 'ACCOUNT_DEACTIVATED',
    });
  });
});

describe('AuthService.login — terms acceptance gate (regression: was silently unenforced for everyone)', () => {
  test('buyer with terms_accepted = false is blocked at login', async () => {
    const user = await makeUser({ role: 'buyer' });
    await makeBuyerProfile(user.id, user.email, { termsAccepted: false });
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'buyer'), {
      statusCode: 403,
      code: 'TERMS_NOT_ACCEPTED',
    });
  });

  test('seller with terms_accepted = false is blocked at login', async () => {
    const user = await makeUser({ role: 'seller' });
    await makeSellerProfile(user.id, user.email, { termsAccepted: false });
    await assertAppErrorRejection(AuthService.login(user.email, PASSWORD, 'seller'), {
      statusCode: 403,
      code: 'TERMS_NOT_ACCEPTED',
    });
  });

  test('buyer with terms_accepted = true logs in normally', async () => {
    const user = await makeUser({ role: 'buyer' });
    await makeBuyerProfile(user.id, user.email, { termsAccepted: true });
    const result = await AuthService.login(user.email, PASSWORD, 'buyer');
    assert.ok(result, 'expected a successful login result');
    assert.equal(result.user.email, user.email);
  });

  test('seller with terms_accepted = true logs in normally', async () => {
    const user = await makeUser({ role: 'seller' });
    await makeSellerProfile(user.id, user.email, { termsAccepted: true });
    const result = await AuthService.login(user.email, PASSWORD, 'seller');
    assert.ok(result, 'expected a successful login result');
    assert.equal(result.user.email, user.email);
  });
});

describe('AuthService.login — wrong-portal (role mismatch)', () => {
  test('a verified buyer logging into the seller portal is rejected with WRONG_PORTAL', async () => {
    const user = await makeUser({ role: 'buyer' });
    await makeBuyerProfile(user.id, user.email);

    await assert.rejects(AuthService.login(user.email, PASSWORD, 'seller'), (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.isOperational, true);
      assert.equal(err.statusCode, 401);
      assert.equal(err.code, 'WRONG_PORTAL');
      assert.equal(err.isRoleMismatch, true);
      return true;
    });
  });
});

describe('AuthService.login — happy path', () => {
  test('correct credentials for a verified, active, terms-accepted buyer succeed', async () => {
    const user = await makeUser({ role: 'buyer' });
    await makeBuyerProfile(user.id, user.email);
    const result = await AuthService.login(user.email, PASSWORD, 'buyer');
    assert.ok(result);
    assert.ok(result.token);
    assert.equal(result.user.email, user.email);
  });
});
