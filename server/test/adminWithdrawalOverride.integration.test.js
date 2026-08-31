// Admin withdrawal override (integration): admin marking a payout 'failed' must
// REFUND the seller (via the safe side-effects path), and an already-finalized
// request cannot be overridden again (terminal-state guard).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import AdminService from '../src/domains/identity/admin/admin.service.js';

const uniq = `awo-${Date.now()}`;
const AMOUNT = 1000, FEE = 21, RESERVE = AMOUNT + FEE;

describe('admin withdrawal override (integration, real path)', () => {
  let sellerId, reqId;

  before(async () => {
    // Seller with the withdrawal already reserved (balance debited, moved to reserved).
    sellerId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status,balance,withdrawal_reserved_balance)
       VALUES ('S','s-${uniq}@byblos.test','07','Shop-${uniq}','active',5000,$1) RETURNING id`, [RESERVE]
    )).rows[0].id;
    reqId = (await pool.query(
      `INSERT INTO withdrawal_requests (seller_id, amount, mpesa_number, mpesa_name, status, idempotency_key, metadata, created_at)
       VALUES ($1,$2,'254700000000','Name','processing',$3,$4::jsonb,NOW()) RETURNING id`,
      [sellerId, AMOUNT, `${uniq}-idem`, JSON.stringify({ withdrawal_fee: FEE, total_deducted: RESERVE })]
    )).rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM withdrawal_requests WHERE id=$1', [reqId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  const wallet = async () => (await pool.query(
    'SELECT balance::float AS balance, withdrawal_reserved_balance::float AS reserved FROM sellers WHERE id=$1', [sellerId]
  )).rows[0];

  it('marking a payout failed REFUNDS the seller (amount+fee back to available)', async () => {
    await AdminService.overrideWithdrawalStatus({ id: reqId, status: 'failed', reason: 'test', adminId: 1 });

    const w = await wallet();
    assert.equal(w.balance, 5000 + RESERVE, 'seller refunded the reserved amount+fee');
    assert.equal(w.reserved, 0, 'reserve released');
    const status = (await pool.query('SELECT status FROM withdrawal_requests WHERE id=$1', [reqId])).rows[0].status;
    assert.equal(status, 'failed');
  });

  it('cannot override an already-finalized request (terminal-state guard, no double refund)', async () => {
    await assert.rejects(
      () => AdminService.overrideWithdrawalStatus({ id: reqId, status: 'completed', reason: 'again', adminId: 1 }),
      /already finalized/i
    );
    const w = await wallet();
    assert.equal(w.balance, 5000 + RESERVE, 'balance unchanged by the blocked second override (no double credit)');
  });
});
