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
const { createBuyer, createSeller, createCreator, createCompletedOrder, cleanupBuyer, cleanupSeller, cleanupCreator, cleanupOrder } =
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

      // Regression guard for the generic-500-toast bug: this used to be a
      // plain `Error` (no statusCode, isOperational undefined), which
      // globalErrorHandler masks to a generic 500 "Something went wrong!" in
      // production regardless of the real message -- so assert it's a real
      // operational 400 AppError, not just "it throws".
      await assert.rejects(() => req(entityType, entity.id), (err) => {
        assert.match(err.message, /insufficient balance/i);
        assert.equal(err.statusCode, 400, 'a real 400, not masked to a generic 500');
        assert.equal(err.isOperational, true, 'operational, so globalErrorHandler surfaces the real message');
        return true;
      });

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
      (err) => {
        assert.match(err.message, /name/i);
        // Regression guard: this used to be a plain `Error` (no statusCode,
        // isOperational undefined) -- masked to a generic 500 in production.
        assert.equal(err.statusCode, 400, 'a real 400, not masked to a generic 500');
        assert.equal(err.isOperational, true, 'operational, so globalErrorHandler surfaces the real message');
        return true;
      }
    );
  });
});

// Security regression: buyer refunds take a per-request mpesaNumber straight from
// the client, so a stolen buyer session could redirect a cleared refund balance
// to an attacker's number. Sellers already hold a withdrawal for admin review
// when its destination differs from the last SUCCESSFUL payout; this guarantees
// buyer refunds now get the identical protection (extended in withdrawal.service.js
// createWithdrawalRequest -- the `entityType === 'seller' || entityType === 'buyer_refund'`
// branch). Creators are intentionally NOT covered: they pay out only to a stored,
// non-client-supplied number.
describe('Withdrawal — buyer_refund payout destination hold', () => {
  const NEW_PHONE = '0798765432'; // deliberately different from PHONE (0712345678)

  // Seeds a prior COMPLETED buyer withdrawal to `toNumber`, establishing a known
  // last-successful destination without going through the async provider flow.
  async function seedCompletedPayout(buyerId, toNumber) {
    await pool.query(
      `INSERT INTO withdrawal_requests
         (buyer_id, amount, mpesa_number, mpesa_name, status, api_call_pending, idempotency_key, metadata, created_at)
       VALUES ($1, $2, $3, 'Prior Payee', 'completed', FALSE, $4, '{}'::jsonb, NOW() - INTERVAL '1 day')`,
      [buyerId, AMOUNT, toNumber, `prior-${buyerId}-${Date.now()}`]
    );
  }

  test('a refund to a CHANGED destination is held for admin review, not dispatched', async (t) => {
    let buyer;
    t.after(() => buyer && cleanupEntity(ENTITIES.buyer_refund, buyer.id));
    buyer = await createBuyer({});
    await ENTITIES.buyer_refund.seedBalance(buyer.id, BALANCE);
    await seedCompletedPayout(buyer.id, PHONE); // last successful payout went to PHONE

    const before = await ENTITIES.buyer_refund.read(buyer.id);

    // Attacker-style request: same account, brand-new destination number.
    const request = await WithdrawalService.createWithdrawalRequest({
      entityId: buyer.id,
      entityType: 'buyer_refund',
      amount: AMOUNT,
      mpesaNumber: NEW_PHONE,
      idempotencyKey: `hold-${buyer.id}-${Date.now()}`
    });

    assert.equal(request.status, 'manual_review', 'held for review, not dispatched');

    const { rows: [row] } = await pool.query(
      'SELECT status, api_call_pending, metadata FROM withdrawal_requests WHERE id = $1',
      [request.id]
    );
    assert.equal(row.status, 'manual_review');
    assert.equal(row.api_call_pending, false, 'a held request must NOT be queued for the payout provider');
    assert.equal(row.metadata.held_for_review, true);
    assert.equal(row.metadata.hold_reason, 'payout_destination_changed');

    // Funds are still reserved while it waits for review (same as the seller hold),
    // so the balance can't be spent twice — it just can't leave without approval.
    const after = await ENTITIES.buyer_refund.read(buyer.id);
    assert.equal(after.available, before.available - DEDUCTION, 'refund balance reserved');
    assert.equal(after.reserved, before.reserved + DEDUCTION, 'held amount moved into the reserve');
  });

  test('a refund to the SAME destination as the last successful payout dispatches normally', async (t) => {
    let buyer;
    t.after(() => buyer && cleanupEntity(ENTITIES.buyer_refund, buyer.id));
    buyer = await createBuyer({});
    await ENTITIES.buyer_refund.seedBalance(buyer.id, BALANCE);
    await seedCompletedPayout(buyer.id, PHONE);

    const request = await WithdrawalService.createWithdrawalRequest({
      entityId: buyer.id,
      entityType: 'buyer_refund',
      amount: AMOUNT,
      mpesaNumber: PHONE, // unchanged destination
      idempotencyKey: `same-${buyer.id}-${Date.now()}`
    });

    assert.equal(request.status, 'processing', 'unchanged destination is not held');
    const settled = await waitForProviderSettled(request.id);
    assert.notEqual(settled.status, 'manual_review');
  });

  test('a first-ever refund (no prior successful payout) is not held', async (t) => {
    let buyer;
    t.after(() => buyer && cleanupEntity(ENTITIES.buyer_refund, buyer.id));
    buyer = await createBuyer({});
    await ENTITIES.buyer_refund.seedBalance(buyer.id, BALANCE);
    // No prior payout seeded — nothing to compare against.

    const request = await WithdrawalService.createWithdrawalRequest({
      entityId: buyer.id,
      entityType: 'buyer_refund',
      amount: AMOUNT,
      mpesaNumber: NEW_PHONE,
      idempotencyKey: `first-${buyer.id}-${Date.now()}`
    });

    assert.equal(request.status, 'processing', 'first-time withdrawal proceeds, matching seller behavior');
    await waitForProviderSettled(request.id);
  });
});

// Security regression: the T+2 clearing hold for creators and buyer refunds was
// only enforced by a read-before-lock advisory check in the controller. Because
// creators.balance / buyers.refunds hold the FULL amount immediately (unlike
// sellers, whose uncleared money lives in pending_settlement_balance), two
// concurrent withdrawal requests could each pass that advisory check and then
// both drain past the hold — extracting money frozen for chargeback/self-dealing
// review. The fix recomputes the clearing balance INSIDE the FOR UPDATE
// transaction against the locked balance (withdrawal.service.js
// createWithdrawalRequest), so the second request sees the first's reserve and
// the clearing floor, and is rejected.
describe('Withdrawal — clearing-hold race (creator & buyer_refund)', () => {
  const RACE_AMOUNT = 300;
  const RACE_DEDUCTION = RACE_AMOUNT + Fees.calculateWithdrawalFee(RACE_AMOUNT); // 321
  const UNCLEARED = 700;                     // one earning/refund still within T+2
  const RACE_SEED = UNCLEARED + RACE_DEDUCTION; // 1021: covers the hold + exactly ONE withdrawal
  // available = RACE_SEED - UNCLEARED = RACE_DEDUCTION, so a single withdrawal
  // fits and two do not — yet 2*RACE_DEDUCTION < RACE_SEED, so the RAW-balance
  // check would let both through. Only the in-transaction clearing check stops
  // the second.

  test('creator: two concurrent withdrawals cannot drain past the T+2 clearing hold', async (t) => {
    let creator, seller, buyer, order;
    t.after(async () => {
      if (creator) {
        await pool.query('DELETE FROM creator_earnings WHERE creator_id = $1', [creator.id]).catch(() => {});
        await cleanupEntity(ENTITIES.creator, creator.id).catch(() => {});
      }
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    creator = await createCreator({});
    seller = await createSeller({});
    buyer = await createBuyer({});
    order = await createCompletedOrder({ buyerId: buyer.id, sellerId: seller.id, totalAmount: 1000, sellerPayoutAmount: 900 });
    await pool.query('UPDATE creators SET balance = $2 WHERE id = $1', [creator.id, RACE_SEED]);
    // One credited earning of UNCLEARED, created NOW -> still inside the T+2 window.
    await pool.query(
      `INSERT INTO creator_earnings (creator_id, seller_id, order_id, amount, rate, base_amount, status, created_at)
       VALUES ($1, $2, $3, $4, 0.01, $4, 'credited', NOW())`,
      [creator.id, seller.id, order.id, UNCLEARED]
    );

    const results = await Promise.allSettled([
      WithdrawalService.createWithdrawalRequest({ entityId: creator.id, entityType: 'creator', amount: RACE_AMOUNT, idempotencyKey: `race-c1-${creator.id}` }),
      WithdrawalService.createWithdrawalRequest({ entityId: creator.id, entityType: 'creator', amount: RACE_AMOUNT, idempotencyKey: `race-c2-${creator.id}` })
    ]);

    const ok = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    assert.equal(ok.length, 1, 'exactly one concurrent withdrawal succeeds');
    assert.equal(failed.length, 1, 'the other is rejected by the in-transaction clearing check');
    assert.match(failed[0].reason.message, /available balance|clearing/i);

    // The T+2-held money must remain: spendable balance stays at or above the
    // uncleared floor (without the fix, both would commit and balance would drop
    // to RACE_SEED - 2*RACE_DEDUCTION = 379, i.e. 321 of held money leaked).
    const { rows: [c] } = await pool.query('SELECT balance::float AS balance FROM creators WHERE id = $1', [creator.id]);
    assert.ok(c.balance >= UNCLEARED, `clearing hold preserved: balance ${c.balance} >= uncleared ${UNCLEARED}`);
  });

  test('buyer_refund: two concurrent withdrawals cannot drain past the T+2 clearing hold', async (t) => {
    let buyer;
    t.after(async () => {
      if (!buyer) return;
      await pool.query('DELETE FROM refund_requests WHERE buyer_id = $1', [buyer.id]).catch(() => {});
      await cleanupEntity(ENTITIES.buyer_refund, buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    await pool.query('UPDATE buyers SET refunds = $2 WHERE id = $1', [buyer.id, RACE_SEED]);
    // One completed refund of UNCLEARED, credited NOW -> still inside the T+2 window.
    await pool.query(
      `INSERT INTO refund_requests (buyer_id, amount, status, processed_at, requested_at)
       VALUES ($1, $2, 'completed', NOW(), NOW())`,
      [buyer.id, UNCLEARED]
    );

    const results = await Promise.allSettled([
      WithdrawalService.createWithdrawalRequest({ entityId: buyer.id, entityType: 'buyer_refund', amount: RACE_AMOUNT, mpesaNumber: PHONE, idempotencyKey: `race-b1-${buyer.id}` }),
      WithdrawalService.createWithdrawalRequest({ entityId: buyer.id, entityType: 'buyer_refund', amount: RACE_AMOUNT, mpesaNumber: PHONE, idempotencyKey: `race-b2-${buyer.id}` })
    ]);

    const ok = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    assert.equal(ok.length, 1, 'exactly one concurrent refund withdrawal succeeds');
    assert.equal(failed.length, 1, 'the other is rejected by the in-transaction clearing check');
    assert.match(failed[0].reason.message, /available balance|clearing/i);

    const { rows: [b] } = await pool.query('SELECT refunds::float AS refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.ok(b.refunds >= UNCLEARED, `clearing hold preserved: refunds ${b.refunds} >= uncleared ${UNCLEARED}`);
  });
});
