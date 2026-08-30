// Creator attribution + earnings regression (integration).
// Proves the authoritative creator model end-to-end against the full schema:
//   commission = round(subtotal × agreedRate) on the FULL subtotal,
//   deducted from seller payout, excluded from platform_fee_amount,
//   buyer total unchanged, and creator_earnings credited from the metadata.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';
import CreatorService from '../../src/domains/growth/creators/creator.service.js';

const mockProvider = {
  async initiatePayment({ api_ref }) {
    return { success: true, reference: `PSK_${api_ref}`, status: 'pending', message: 'ok' };
  },
};

function order(productId, token, creatorCode) {
  return {
    buyer: { id: null, name: 'Buyer', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: 'Item', quantity: 1 },
    location: { address: 'Nairobi', lat: null, lng: null },
    metadata: { delivery: {}, client_checkout_token: token, creator: creatorCode },
    idempotencyKey: token,
  };
}

describe('creator attribution + earnings (integration)', () => {
  let sellerId, productId, creatorId;
  const CODE = 'CREATOR5';
  const RATE = 0.05;
  const tokens = [];

  before(async () => {
    const s = await pool.query(
      `INSERT INTO sellers (full_name, email, whatsapp_number, shop_name, status)
       VALUES ('Seller','seller@byblos.test','0700000000','Shop','active') RETURNING id`
    );
    sellerId = s.rows[0].id;
    const p = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, status)
       VALUES ($1,'Item',999,'physical',false,'available') RETURNING id`,
      [sellerId]
    );
    productId = p.rows[0].id;
    const c = await pool.query(
      `INSERT INTO creators (first_name, last_name, email, mpesa_number, status)
       VALUES ('Cre','Ator','creator@byblos.test','0722000000','active') RETURNING id`
    );
    creatorId = c.rows[0].id;
    await pool.query(
      `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
       VALUES ($1,$2,$3,$4,'active')`,
      [sellerId, creatorId, CODE, RATE]
    );
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query(`DELETE FROM creator_earnings WHERE order_id IN (SELECT id FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM product_orders WHERE client_checkout_token=$1`, [t]).catch(() => {});
    }
    await pool.query(`DELETE FROM seller_creator_links WHERE seller_id=$1`, [sellerId]).catch(() => {});
    await pool.query(`DELETE FROM creators WHERE id=$1`, [creatorId]).catch(() => {});
    await pool.query(`DELETE FROM products WHERE id=$1`, [productId]).catch(() => {});
    await pool.query(`DELETE FROM sellers WHERE id=$1`, [sellerId]).catch(() => {});
    await pool.end();
  });

  it('creator @5% agreement: commission 49.95, payout 939.05, platform 30, buyer 1019', async () => {
    const token = `cr-5-${Date.now()}`;
    tokens.push(token);
    const res = await initiateProductPayment(order(productId, token, CODE), { providerClient: mockProvider });

    const { rows } = await pool.query('SELECT * FROM product_orders WHERE id=$1', [res.orderId]);
    const o = rows[0];
    assert.equal(Number(o.total_amount), 1019, 'buyer total unchanged by creator commission');
    assert.equal(Number(o.platform_fee_amount), 30, 'platform fee excludes creator commission');
    assert.equal(Number(o.seller_payout_amount), 939.05, 'seller payout = 999 - 49.95 - 10');

    const attr = o.metadata.creator_attribution;
    assert.ok(attr, 'creator_attribution stored in order metadata');
    assert.equal(Number(attr.commission_amount), 49.95, 'commission = 999 x 5% (full subtotal)');
    assert.equal(Number(attr.commission_base_amount), 999, 'base is full subtotal, not subtotal - 10');
    assert.equal(attr.creator_id, creatorId);
  });

  it('credits creator_earnings from the stored attribution and updates creator balance', async () => {
    const token = `cr-earn-${Date.now()}`;
    tokens.push(token);
    const res = await initiateProductPayment(order(productId, token, CODE), { providerClient: mockProvider });
    const { rows: orows } = await pool.query('SELECT * FROM product_orders WHERE id=$1', [res.orderId]);

    const before = await pool.query('SELECT balance FROM creators WHERE id=$1', [creatorId]);
    try {
      await CreatorService.creditCreatorForOrder(pool, { order: orows[0], paymentId: res.paymentId });
    } catch (e) {
      // notifyCreatorSaleSuccess may fail without notification infra; earnings
      // + balance are written before it, so assert the DB state regardless.
    }

    const { rows: earn } = await pool.query('SELECT * FROM creator_earnings WHERE order_id=$1', [res.orderId]);
    assert.equal(earn.length, 1, 'exactly one creator_earnings row');
    assert.equal(Number(earn[0].amount), 49.95, 'earning = commission amount');
    assert.equal(Number(earn[0].base_amount), 999);

    const after = await pool.query('SELECT balance FROM creators WHERE id=$1', [creatorId]);
    assert.equal(Number(after.rows[0].balance) - Number(before.rows[0].balance), 49.95, 'creator balance credited');
  });

  it('no creator agreement (unknown code): no attribution, payout 989', async () => {
    const token = `cr-none-${Date.now()}`;
    tokens.push(token);
    const res = await initiateProductPayment(order(productId, token, 'NOPE'), { providerClient: mockProvider });
    const { rows } = await pool.query('SELECT * FROM product_orders WHERE id=$1', [res.orderId]);
    const o = rows[0];
    assert.equal(Number(o.seller_payout_amount), 989, 'payout = subtotal - 10 (no creator)');
    assert.equal(o.metadata.creator_attribution ?? null, null, 'no attribution stored');
  });
});
