// Functional money-out tests: seller withdrawal balance movements through the
// real WithdrawalService (integration). Deterministic — uses the M3 hold path
// and direct status transitions so the async payout provider is never called
// (no real money, no network).
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import withdrawalService from '../src/domains/payments/withdrawals/withdrawal.service.js';
import Fees from '../src/shared/config/fees.js';

const uniq = `mo-${Date.now()}`;
const AMOUNT = 1000;
const FEE = Fees.calculateWithdrawalFee(AMOUNT);      // 21 for the 50–1500 tier
const RESERVE = AMOUNT + FEE;                          // 1021

describe('money-out: seller withdrawals (integration, real path)', () => {
  let sellerId;
  let idemCounter = 0;
  const nextIdem = () => `${uniq}-idem-${++idemCounter}`;

  before(async () => {
    sellerId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status,balance,withdrawal_reserved_balance)
       VALUES ('S','s-${uniq}@byblos.test','0712345678','Shop-${uniq}','active',0,0) RETURNING id`
    )).rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM withdrawal_requests WHERE seller_id = $1', [sellerId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]).catch(() => {});
  });

  const setWallet = (balance, reserved = 0) =>
    pool.query('UPDATE sellers SET balance=$1, withdrawal_reserved_balance=$2 WHERE id=$3', [balance, reserved, sellerId]);
  const wallet = async () => {
    const { rows } = await pool.query(
      'SELECT balance::float AS balance, withdrawal_reserved_balance::float AS reserved FROM sellers WHERE id=$1', [sellerId]);
    return rows[0];
  };

  // Seed a prior successful payout to a DIFFERENT number so new requests are M3-held
  // (status manual_review) and therefore never dispatched to the provider.
  beforeEach(async () => {
    await pool.query('DELETE FROM withdrawal_requests WHERE seller_id=$1', [sellerId]);
    await pool.query(
      `INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, idempotency_key, created_at)
       VALUES ($1, 500, '254700000000', 'Old Name', 'completed', $2, NOW() - INTERVAL '1 day')`,
      [sellerId, nextIdem()]
    );
  });

  it('rejects a withdrawal above available balance without debiting', async () => {
    await setWallet(100, 0);
    await assert.rejects(
      () => withdrawalService.createWithdrawalRequest({
        entityId: sellerId, entityType: 'seller', amount: AMOUNT,
        mpesaNumber: '0712345678', mpesaName: 'New Name', idempotencyKey: nextIdem(),
      }),
      /Insufficient balance/i
    );
    const w = await wallet();
    assert.equal(w.balance, 100, 'balance untouched');
    assert.equal(w.reserved, 0, 'nothing reserved');
  });

  it('reserves funds (amount + fee) and holds when the payout number changed (M3)', async () => {
    await setWallet(10000, 0);
    const req = await withdrawalService.createWithdrawalRequest({
      entityId: sellerId, entityType: 'seller', amount: AMOUNT,
      mpesaNumber: '0712345678', mpesaName: 'New Name', idempotencyKey: nextIdem(),
    });
    assert.equal(req.status, 'manual_review', 'destination change is held for review');

    const w = await wallet();
    assert.equal(w.balance, 10000 - RESERVE, 'available balance debited by amount+fee');
    assert.equal(w.reserved, RESERVE, 'amount+fee moved into reserved');
  });

  it('completion clears the reserve and leaves the balance debited', async () => {
    await setWallet(10000, 0);
    const req = await withdrawalService.createWithdrawalRequest({
      entityId: sellerId, entityType: 'seller', amount: AMOUNT,
      mpesaNumber: '0712345678', mpesaName: 'New Name', idempotencyKey: nextIdem(),
    });
    await withdrawalService.updateStatusWithSideEffects(req.id, 'completed', { remarks: 'paid' });

    const w = await wallet();
    assert.equal(w.reserved, 0, 'reserve cleared on completion');
    assert.equal(w.balance, 10000 - RESERVE, 'money left the wallet (balance stays debited)');
  });

  it('failure refunds the reserve back to available balance', async () => {
    await setWallet(10000, 0);
    const req = await withdrawalService.createWithdrawalRequest({
      entityId: sellerId, entityType: 'seller', amount: AMOUNT,
      mpesaNumber: '0712345678', mpesaName: 'New Name', idempotencyKey: nextIdem(),
    });
    await withdrawalService.updateStatusWithSideEffects(req.id, 'failed', { remarks: 'provider declined' });

    const w = await wallet();
    assert.equal(w.balance, 10000, 'full amount+fee refunded to available balance');
    assert.equal(w.reserved, 0, 'reserve released');
  });

  it('does not double-process a terminal request (idempotent status guard)', async () => {
    await setWallet(10000, 0);
    const req = await withdrawalService.createWithdrawalRequest({
      entityId: sellerId, entityType: 'seller', amount: AMOUNT,
      mpesaNumber: '0712345678', mpesaName: 'New Name', idempotencyKey: nextIdem(),
    });
    await withdrawalService.updateStatusWithSideEffects(req.id, 'completed', { remarks: 'paid' });
    const afterComplete = await wallet();

    // A late 'failed' on an already-completed request must NOT refund (no double credit).
    await withdrawalService.updateStatusWithSideEffects(req.id, 'failed', { remarks: 'late callback' });
    const afterLate = await wallet();

    assert.deepEqual(afterLate, afterComplete, 'terminal request unchanged by a late update');
  });
});
