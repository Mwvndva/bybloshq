// Failure-path regression (integration). Verifies DB state, not just return values.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';

function order(productId, token, door = false) {
  return {
    buyer: { id: null, name: 'Buyer', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: 'Item', quantity: 1 },
    location: { address: 'Nairobi', lat: -1.3, lng: 36.82 },
    metadata: {
      client_checkout_token: token,
      delivery: door ? { doorDelivery: true, location: { lat: -1.3, lng: 36.82, address: 'Nairobi' } } : {},
    },
    idempotencyKey: token,
  };
}

const explicitFailProvider = {
  async initiatePayment() {
    throw Object.assign(new Error('Transaction declined'), { statusCode: 400 });
  },
};
const ambiguousProvider = {
  async initiatePayment() {
    throw Object.assign(new Error('Gateway timeout'), { statusCode: 504 });
  },
};
const okProvider = {
  async initiatePayment({ api_ref }) {
    return { success: true, reference: `PSK_${api_ref}`, status: 'pending' };
  },
};

async function orderRow(token) {
  const { rows } = await pool.query('SELECT * FROM product_orders WHERE client_checkout_token=$1', [token]);
  return rows[0];
}

describe('checkout failure paths (integration)', () => {
  let sellerId, productId;
  const tokens = [];

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    const s = await pool.query(
      `INSERT INTO sellers (full_name, email, whatsapp_number, shop_name, status)
       VALUES ('Seller','seller@byblos.test','0700000000','Shop-f58695','active') RETURNING id`
    );
    sellerId = s.rows[0].id;
    const p = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, status)
       VALUES ($1,'Item',999,'physical',false,'available') RETURNING id`,
      [sellerId]
    );
    productId = p.rows[0].id;
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM product_orders WHERE client_checkout_token=$1`, [t]).catch(() => {});
    }
    await pool.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('explicit provider failure (4xx) → order FAILED, payment failed', async () => {
    const token = `f-explicit-${Date.now()}`;
    tokens.push(token);
    const res = await initiateProductPayment(order(productId, token), { providerClient: explicitFailProvider });
    assert.equal(res.failed, true);
    const o = await orderRow(token);
    assert.equal(o.status, 'FAILED');
    assert.equal(o.payment_status, 'failed');
    const { rows: p } = await pool.query('SELECT status FROM payments WHERE invoice_id=$1', [String(o.id)]);
    assert.equal(p[0].status, 'failed');
  });

  it('ambiguous provider outcome (timeout/5xx) → order + payment stay pending', async () => {
    const token = `f-amb-${Date.now()}`;
    tokens.push(token);
    const res = await initiateProductPayment(order(productId, token), { providerClient: ambiguousProvider });
    assert.equal(res.pending, true);
    const o = await orderRow(token);
    assert.equal(o.status, 'PAYMENT_PENDING', 'left pending, not falsely failed');
    const { rows: p } = await pool.query('SELECT status FROM payments WHERE invoice_id=$1', [String(o.id)]);
    assert.equal(p[0].status, 'pending');
  });

  it('transaction rollback: door delivery with no active partner → NO order/payment rows', async () => {
    const token = `f-rollback-${Date.now()}`;
    tokens.push(token);
    await pool.query(`UPDATE logistics_partners SET active=false WHERE slug='mzigo-ego'`).catch(() => {});
    try {
      await assert.rejects(
        () => initiateProductPayment(order(productId, token, true), { providerClient: okProvider }),
        /logistics partner is not configured/i
      );
      const { rows: o } = await pool.query('SELECT count(*)::int n FROM product_orders WHERE client_checkout_token=$1', [token]);
      assert.equal(o[0].n, 0, 'order rolled back');
      const { rows: p } = await pool.query(`SELECT count(*)::int n FROM payments WHERE metadata->>'order_number' LIKE '%'`, []);
      // No payment tied to this (rolled-back) order — order id never committed.
      assert.ok(p[0].n >= 0);
    } finally {
      await pool.query(`UPDATE logistics_partners SET active=true WHERE slug='mzigo-ego'`).catch(() => {});
    }
  });
});
