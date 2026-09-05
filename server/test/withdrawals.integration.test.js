// Integration tests for the three withdrawal flows — seller, creator, and
// buyer_refund — against a REAL database and the REAL WithdrawalService, with a
// local mock standing in for Paystack's payout endpoints (/transferrecipient,
// /transfer) so the fire-and-forget provider call resolves deterministically to
// "accepted" instead of failing against an unreachable URL.
//
// PAYSTACK_BASE_URL is overridden to the mock BEFORE the app modules are
// imported, so the payout client constructed at import time targets it.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// --- point the payout client at a local mock BEFORE importing app code -------
const MOCK_PORT = 3099;
process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key_for_testing';
process.env.PAYOUT_PROVIDER = 'paystack';

const { pool } = await import('../src/infrastructure/database/database.js');
const WithdrawalService = (await import('../src/domains/payments/withdrawals/withdrawal.service.js')).default;
const Fees = (await import('../src/shared/config/fees.js')).default;
const { createBuyer, createSeller, createCreator, cleanupBuyer, cleanupSeller, cleanupCreator } =
  await import('./helpers/factories.js');

const BALANCE = 10000;
const AMOUNT = 1000;
const FEE = Fees.calculateWithdrawalFee(AMOUNT);
const DEDUCTION = AMOUNT + FEE;
const PHONE = '0712345678';

let mockServer;

before(async () => {
  // Mock Paystack transfer endpoints — always succeed.
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

// Per-entity-type config: how to seed a balance and where to read it back.
const ENTITIES = {
  creator: {
    create: () => createCreator({}),
    seedBalance: (id, bal) => pool.query('UPDATE creators SET balance = $2 WHERE id = $1', [id, bal]),
    read: async (id) => (await pool.query('SELECT balance::float AS available, COALESCE(withdrawal_reserved_balance,0)::float AS reserved FROM creators WHERE id = $1', [id])).rows[0],
    idCol: 'creator_id',
    cleanup: cleanupCreator,
    needsName: false
  },
  seller: {
    create: () => createSeller({}),
    seedBalance: (id, bal) => pool.query('UPDATE sellers SET balance = $2 WHERE id = $1', [id, bal]),
    read: async (id) => (await pool.query('SELECT balance::float AS available, COALESCE(withdrawal_reserved_balance,0)::float AS reserved FROM sellers WHERE id = $1', [id])).rows[0],
    idCol: 'seller_id',
    cleanup: cleanupSeller,
    needsName: true
  },
  buyer_refund: {
    create: () => createBuyer({}),
    seedBalance: (id, bal) => pool.query('UPDATE buyers SET refunds = $2 WHERE id = $1', [id, bal]),
    read: async (id) => (await pool.query('SELECT refunds::float AS available, COALESCE(refund_withdrawal_reserved_balance,0)::float AS reserved FROM buyers WHERE id = $1', [id])).rows[0],
    idCol: 'buyer_id',
    cleanup: cleanupBuyer,
    needsName: false
  }
};

async function cleanupEntity(cfg, id) {
  // Fire-and-forget provider writes settle first — retry briefly.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await pool.query(`DELETE FROM payout_provider_attempts WHERE ${cfg.idCol} = $1`, [id]);
      await pool.query(`DELETE FROM withdrawal_requests WHERE ${cfg.idCol} = $1`, [id]);
      await cfg.cleanup(id);
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

// Wait until the fire-and-forget provider call has resolved (api_call_pending flips false).
async function waitForProviderSettled(requestId, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query('SELECT api_call_pending, provider_reference, status FROM withdrawal_requests WHERE id = $1', [requestId]);
    if (rows[0] && rows[0].api_call_pending === false) return rows[0];
    await new Promise((r) => setTimeout(r, 150));
  }
  const { rows } = await pool.query('SELECT api_call_pending, provider_reference, status FROM withdrawal_requests WHERE id = $1', [requestId]);
  return rows[0];
}

const req = (entityType, entityId, extra = {}) => WithdrawalService.createWithdrawalRequest({
  entityId, entityType, amount: AMOUNT, mpesaNumber: PHONE, mpesaName: 'Test Payee', idempotencyKey: `wd-${entityType}-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...extra
});

for (const [entityType, cfg] of Object.entries(ENTITIES)) {
  describe(`Withdrawal — ${entityType}`, () => {
    test('reserves amount+fee, creates the request, and the provider call is accepted', async (t) => {
      let entity;
      t.after(() => entity && cleanupEntity(cfg, entity.id));
      entity = await cfg.create();
      await cfg.seedBalance(entity.id, BALANCE);

      const request = await req(entityType, entity.id);
      assert.equal(Number(request.amount), AMOUNT);

      const settled = await waitForProviderSettled(request.id);
      assert.notEqual(settled.status, 'failed', 'a successful provider call must not fail/refund');
      assert.ok(settled.provider_reference, 'provider reference recorded');

      const bal = await cfg.read(entity.id);
      assert.equal(bal.available, BALANCE - DEDUCTION, 'available balance reduced by amount + fee');
      assert.equal(bal.reserved, DEDUCTION, 'the deducted funds are held in the withdrawal reserve');
    });

    test('rejects a withdrawal that exceeds the available balance', async (t) => {
      let entity;
      t.after(() => entity && cleanupEntity(cfg, entity.id));
      entity = await cfg.create();
      await cfg.seedBalance(entity.id, 100); // < AMOUNT + fee

      await assert.rejects(() => req(entityType, entity.id), /insufficient balance/i);

      const bal = await cfg.read(entity.id);
      assert.equal(bal.available, 100, 'balance untouched on rejection');
      assert.equal(bal.reserved, 0, 'nothing reserved on rejection');
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM withdrawal_requests WHERE ${cfg.idCol} = $1`, [entity.id]);
      assert.equal(rows[0].n, 0, 'no request row created on rejection');
    });

    test('is idempotent — the same key deducts exactly once', async (t) => {
      let entity;
      t.after(() => entity && cleanupEntity(cfg, entity.id));
      entity = await cfg.create();
      await cfg.seedBalance(entity.id, BALANCE);

      const key = `idem-${entityType}-${Date.now()}`;
      const first = await req(entityType, entity.id, { idempotencyKey: key });
      const second = await req(entityType, entity.id, { idempotencyKey: key });

      assert.equal(second.id, first.id, 'the same idempotency key returns the same request');
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM withdrawal_requests WHERE ${cfg.idCol} = $1`, [entity.id]);
      assert.equal(rows[0].n, 1, 'exactly one request row for the repeated key');

      await waitForProviderSettled(first.id);
      const bal = await cfg.read(entity.id);
      assert.equal(bal.available, BALANCE - DEDUCTION, 'deducted exactly once despite two calls');
    });
  });
}

describe('Withdrawal — seller-specific guard', () => {
  test('a seller withdrawal without an M-Pesa name is rejected', async (t) => {
    let seller;
    t.after(() => seller && cleanupEntity(ENTITIES.seller, seller.id));
    seller = await createSeller({});
    await ENTITIES.seller.seedBalance(seller.id, BALANCE);

    await assert.rejects(
      () => WithdrawalService.createWithdrawalRequest({
        entityId: seller.id, entityType: 'seller', amount: AMOUNT, mpesaNumber: PHONE, idempotencyKey: `noname-${Date.now()}`
      }),
      /name/i
    );
  });
});
