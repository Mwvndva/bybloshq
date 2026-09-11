// Integration tests for AdminService.overrideWithdrawalStatus -- the admin
// "approve/reject" action behind PATCH /admin/withdrawal-requests/:id/status
// -- against a REAL database and the REAL service, with a local mock standing
// in for Paystack's payout endpoints (same pattern as withdrawals.integration.test.js).
//
// Written while investigating a UI audit finding ("no loading/disabled state,
// no idempotency key -- a double-click could fire two approvals"). That
// finding assumed a single click worked at all; it didn't. The frontend has
// sent status: 'approved' / 'rejected' this whole time, but
// overrideWithdrawalStatus only ever accepted 'completed' / 'failed' (the
// only two values the DB's real withdrawal lifecycle uses -- see
// WithdrawalService.updateStatusWithSideEffects and the 'completed'/'failed'
// checks throughout withdrawal.service.js). Every admin approve/reject click
// was already failing with a 400 "Admin override status must be 'completed'
// or 'failed'", regardless of double-clicking. Fixed the frontend to send
// the values the backend actually accepts; these tests cover the now-working
// action end to end, plus the double-submit guard that already existed here
// (a row lock + status check) but was unreachable until the value mismatch
// was fixed.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MOCK_PORT = 3098;
process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key_for_testing';
process.env.PAYOUT_PROVIDER = 'paystack';

const { pool } = await import('../src/infrastructure/database/database.js');
const WithdrawalService = (await import('../src/domains/payments/withdrawals/withdrawal.service.js')).default;
const AdminService = (await import('../src/domains/identity/admin/admin.service.js')).default;
const Fees = (await import('../src/shared/config/fees.js')).default;
const { createSeller, cleanupSeller } = await import('./helpers/factories.js');

const BALANCE = 10000;
const AMOUNT = 1000;
const FEE = Fees.calculateWithdrawalFee(AMOUNT);
const DEDUCTION = AMOUNT + FEE;
const PHONE = '0712345678';

let mockServer;

before(async () => {
  mockServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.includes('/transferrecipient')) {
        res.end(JSON.stringify({ status: true, message: 'ok', data: { recipient_code: 'RCP_mock_123' } }));
      } else if (req.url.includes('/transfer')) {
        let ref = 'byblos-mock-ref';
        try { ref = JSON.parse(body).reference || ref; } catch { /* keep default */ }
        res.end(JSON.stringify({ status: true, message: 'ok', data: { transfer_code: 'TRF_mock_123', reference: ref, status: 'success' } }));
      } else {
        res.end(JSON.stringify({ status: true, data: {} }));
      }
    });
  });
  await new Promise((resolve) => mockServer.listen(MOCK_PORT, '127.0.0.1', resolve));
});

after(async () => {
  await new Promise((resolve) => mockServer.close(resolve));
});

async function cleanupRequest(sellerId) {
  await pool.query('DELETE FROM payout_provider_attempts WHERE seller_id = $1', [sellerId]);
  await pool.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [sellerId]);
  await cleanupSeller(sellerId);
}

async function seedPendingRequest() {
  const seller = await createSeller({});
  await pool.query('UPDATE sellers SET balance = $2 WHERE id = $1', [seller.id, BALANCE]);
  const request = await WithdrawalService.createWithdrawalRequest({
    entityId: seller.id,
    entityType: 'seller',
    amount: AMOUNT,
    mpesaNumber: PHONE,
    mpesaName: 'Test Payee',
    idempotencyKey: `wd-override-${Date.now()}-${Math.random().toString(36).slice(2)}`
  });
  return { seller, request };
}

describe('AdminService.overrideWithdrawalStatus — admin approve/reject', () => {
  test('rejects any status other than "completed" or "failed" (e.g. the old "approved"/"rejected" values the frontend used to send)', async () => {
    // Validated before any DB lookup, so no request needs to exist for this one.
    for (const badStatus of ['approved', 'rejected', 'pending', 'anything-else']) {
      await assert.rejects(
        () => AdminService.overrideWithdrawalStatus({ id: 999999, status: badStatus, reason: 'test', adminId: 1 }),
        (err) => {
          assert.match(err.message, /must be "completed" or "failed"/i);
          assert.equal(err.statusCode, 400);
          return true;
        },
        `status "${badStatus}" should be rejected`
      );
    }
  });

  test('approving ("completed") releases the withdrawal reserve and finalizes the request', async () => {
    let seller, request;
    try {
      ({ seller, request } = await seedPendingRequest());

      const result = await AdminService.overrideWithdrawalStatus({ id: request.id, status: 'completed', reason: 'approved in review', adminId: 1 });
      assert.equal(result.status, 'completed');

      const { rows: [row] } = await pool.query('SELECT status, metadata FROM withdrawal_requests WHERE id = $1', [request.id]);
      assert.equal(row.status, 'completed');
      assert.equal(row.metadata.admin_override.reason, 'approved in review');

      const { rows: [s] } = await pool.query('SELECT withdrawal_reserved_balance::float AS reserved FROM sellers WHERE id = $1', [seller.id]);
      assert.equal(s.reserved, 0, 'the reserved amount was released on completion');
    } finally {
      if (seller) await cleanupRequest(seller.id);
    }
  });

  test('rejecting ("failed") refunds the balance back to the seller', async () => {
    let seller, request;
    try {
      ({ seller, request } = await seedPendingRequest());
      const before = (await pool.query('SELECT balance::float AS b FROM sellers WHERE id = $1', [seller.id])).rows[0].b;

      const result = await AdminService.overrideWithdrawalStatus({ id: request.id, status: 'failed', reason: 'flagged as fraud', adminId: 1 });
      assert.equal(result.status, 'failed');

      const { rows: [s] } = await pool.query('SELECT balance::float AS balance, withdrawal_reserved_balance::float AS reserved FROM sellers WHERE id = $1', [seller.id]);
      assert.equal(s.balance, before + DEDUCTION, 'the full deducted amount (withdrawal + fee) was refunded');
      assert.equal(s.reserved, 0, 'nothing left reserved after refund');
    } finally {
      if (seller) await cleanupRequest(seller.id);
    }
  });

  test('double-submit guard: a second override on an already-finalized request is rejected, not double-applied', async () => {
    let seller, request;
    try {
      ({ seller, request } = await seedPendingRequest());

      await AdminService.overrideWithdrawalStatus({ id: request.id, status: 'completed', reason: 'first click', adminId: 1 });

      // Simulates exactly the bug scenario: a second approval firing (double
      // click, or a retried request) against a request that's already
      // finalized. Must be rejected, not silently re-applied.
      await assert.rejects(
        () => AdminService.overrideWithdrawalStatus({ id: request.id, status: 'completed', reason: 'second click', adminId: 1 }),
        (err) => {
          assert.match(err.message, /already finalized/i);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );

      const { rows: [row] } = await pool.query('SELECT status, metadata FROM withdrawal_requests WHERE id = $1', [request.id]);
      assert.equal(row.status, 'completed');
      assert.equal(row.metadata.admin_override.reason, 'first click', 'the second, rejected call did not overwrite the first');
    } finally {
      if (seller) await cleanupRequest(seller.id);
    }
  });
});
