// Integration test for the restored product checkout orchestrator.
// Runs against the migrated test DB with a MOCKED Paystack provider — asserts
// real product_orders/payments rows, authoritative amounts, and idempotency.
//
//   npm run db:test:setup && npm run test:integration
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';

const mockProvider = {
  async initiatePayment({ api_ref }) {
    return {
      success: true,
      reference: `PSK_${api_ref}`,
      transaction_id: `PSK_${api_ref}`,
      status: 'pending',
      message: 'M-Pesa prompt sent',
    };
  },
};

function normalizedOrder(productId, token, overrides = {}) {
  return {
    buyer: {
      id: null,
      name: 'Test Buyer',
      phone: '0712345678',
      mobilePayment: '0712345678',
      email: 'buyer@byblos.test',
    },
    service: { id: productId, title: 'Smart audio glasses', quantity: 1 },
    location: { address: 'Nairobi CBD', lat: null, lng: null },
    metadata: { delivery: {}, client_checkout_token: token },
    idempotencyKey: token,
    ...overrides,
  };
}

describe('ProductCheckoutService.initiateProductPayment (integration)', () => {
  let sellerId;
  let productId;
  const tokens = [];

  before(async () => {
    const s = await pool.query(
      `INSERT INTO sellers (full_name, email, whatsapp_number, shop_name, status)
       VALUES ('Test Seller', 'seller@byblos.test', '0700000000', 'Test Shop', 'active') RETURNING id`
    );
    sellerId = s.rows[0].id;
    const p = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, status)
       VALUES ($1, 'Smart audio glasses', 999, 'physical', false, 'available') RETURNING id`,
      [sellerId]
    );
    productId = p.rows[0].id;
  });

  after(async () => {
    for (const t of tokens) {
      await pool
        .query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token = $1)`, [t])
        .catch(() => {});
      await pool.query(`DELETE FROM product_orders WHERE client_checkout_token = $1`, [t]).catch(() => {});
    }
    if (productId) await pool.query(`DELETE FROM products WHERE id = $1`, [productId]).catch(() => {});
    if (sellerId) await pool.query(`DELETE FROM sellers WHERE id = $1`, [sellerId]).catch(() => {});
    await pool.end();
  });

  it('creates order + payment with authoritative amounts (no creator, physical)', async () => {
    const token = `it-core-${Date.now()}`;
    tokens.push(token);

    const result = await initiateProductPayment(normalizedOrder(productId, token), {
      providerClient: mockProvider,
    });

    assert.ok(result.orderId, 'orderId returned');
    assert.match(String(result.orderNumber), /^ORD-\d{8}-\d{6}$/, 'DB trigger generated order number');

    const { rows: orows } = await pool.query('SELECT * FROM product_orders WHERE id = $1', [result.orderId]);
    const order = orows[0];
    assert.equal(Number(order.total_amount), 1019, 'buyer total = subtotal + 2% service charge');
    assert.equal(Number(order.platform_fee_amount), 30, 'platform fee = 10 + serviceCharge');
    assert.equal(Number(order.seller_payout_amount), 989, 'seller payout = subtotal - 10 (no creator)');
    assert.equal(order.status, 'PAYMENT_PENDING', 'initial status');
    assert.equal(order.payment_status, 'pending');
    assert.equal(order.order_type, 'PHYSICAL');
    assert.equal(order.fulfillment_type, 'COURIER', 'shopless seller physical → COURIER');
    assert.equal(order.client_checkout_token, token);

    const { rows: prows } = await pool.query('SELECT * FROM payments WHERE invoice_id = $1', [String(result.orderId)]);
    const payment = prows[0];
    assert.equal(Number(payment.amount), 1019);
    assert.equal(payment.status, 'pending');
    assert.match(payment.api_ref, new RegExp(`^BYB-${result.orderId}-`));
    assert.equal(payment.provider_reference, `PSK_${payment.api_ref}`, 'provider_reference persisted');
    assert.equal(result.paymentId, payment.id);
  });

  it('is idempotent: same checkout token returns the same order without a second charge', async () => {
    const token = `it-idem-${Date.now()}`;
    tokens.push(token);
    let charges = 0;
    const countingProvider = {
      async initiatePayment(args) {
        charges += 1;
        return mockProvider.initiatePayment(args);
      },
    };

    const first = await initiateProductPayment(normalizedOrder(productId, token), { providerClient: countingProvider });
    const second = await initiateProductPayment(normalizedOrder(productId, token), { providerClient: countingProvider });

    assert.equal(second.orderId, first.orderId, 'same order returned');
    assert.equal(second.idempotent, true, 'flagged idempotent replay');
    assert.equal(charges, 1, 'provider charged exactly once');

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM product_orders WHERE client_checkout_token = $1', [token]);
    assert.equal(rows[0].n, 1, 'exactly one order row for the token');
  });

  it('rejects an unavailable product without creating rows', async () => {
    const token = `it-unavail-${Date.now()}`;
    await pool.query(`UPDATE products SET status = 'draft' WHERE id = $1`, [productId]);
    await assert.rejects(
      () => initiateProductPayment(normalizedOrder(productId, token), { providerClient: mockProvider }),
      /Product not available/
    );
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM product_orders WHERE client_checkout_token = $1', [token]);
    assert.equal(rows[0].n, 0, 'no order created on validation failure');
    await pool.query(`UPDATE products SET status = 'available' WHERE id = $1`, [productId]);
  });
});
