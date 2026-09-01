// Integration test for multi-item (per-seller bag) checkout.
// One order + N order_items + one payment + one STK push, with authoritative
// aggregated pricing. Runs against the migrated test DB with a MOCKED provider.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';

const uniq = `mi-${Date.now()}`;

let charges = 0;
const mockProvider = {
  async initiatePayment({ api_ref }) {
    charges += 1;
    return { success: true, reference: `PSK_${api_ref}`, status: 'pending', message: 'ok' };
  },
};

function baseOrder(token, overrides = {}) {
  return {
    buyer: {
      id: null,
      name: 'Bag Buyer',
      phone: '0712345678',
      mobilePayment: '0712345678',
      email: `${uniq}@byblos.test`,
    },
    location: { address: 'Nairobi CBD', lat: null, lng: null },
    metadata: { delivery: {}, client_checkout_token: token },
    idempotencyKey: token,
    ...overrides,
  };
}

describe('multi-item (bag) checkout (integration)', () => {
  let sellerA, sellerB, pA1, pA2, pDigital, pService, pB1;
  const tokens = [];

  before(async () => {
    sellerA = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status)
       VALUES ('Seller A','a-${uniq}@byblos.test','0700000001','ShopA-${uniq}','active') RETURNING id`
    )).rows[0].id;
    sellerB = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status)
       VALUES ('Seller B','b-${uniq}@byblos.test','0700000002','ShopB-${uniq}','active') RETURNING id`
    )).rows[0].id;
    const mk = async (sid, name, price, type, digital) => (await pool.query(
      `INSERT INTO products (seller_id,name,price,product_type,is_digital,status)
       VALUES ($1,$2,$3,$4,$5,'available') RETURNING id`, [sid, name, price, type, digital]
    )).rows[0].id;
    pA1 = await mk(sellerA, 'Glasses', 1000, 'physical', false);
    pA2 = await mk(sellerA, 'Case', 500, 'physical', false);
    pDigital = await mk(sellerA, 'Ebook', 300, 'digital', true);
    pService = await mk(sellerA, 'Consultation', 800, 'service', false);
    pB1 = await mk(sellerB, 'Other', 400, 'physical', false);
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM product_orders WHERE client_checkout_token=$1`, [t]).catch(() => {});
    }
    for (const id of [pA1, pA2, pDigital, pService, pB1]) await pool.query(`DELETE FROM products WHERE id=$1`, [id]).catch(() => {});
    for (const id of [sellerA, sellerB]) await pool.query(`DELETE FROM sellers WHERE id=$1`, [id]).catch(() => {});
  });

  it('creates ONE order + N order_items + ONE payment with aggregated pricing', async () => {
    const token = `${uniq}-multi`;
    tokens.push(token);
    charges = 0;

    const result = await initiateProductPayment(
      baseOrder(token, { items: [{ productId: pA1, quantity: 2 }, { productId: pA2, quantity: 1 }] }),
      { providerClient: mockProvider }
    );

    assert.ok(result.orderId, 'orderId returned');
    assert.equal(charges, 1, 'exactly one STK push for the whole bag');

    const order = (await pool.query('SELECT * FROM product_orders WHERE id=$1', [result.orderId])).rows[0];
    // subtotal = 1000*2 + 500*1 = 2500; serviceCharge = ceil(2500*0.02) = 50
    assert.equal(Number(order.total_amount), 2550, 'buyer total = subtotal + 2%');
    assert.equal(Number(order.platform_fee_amount), 60, 'platform fee = 10 + serviceCharge');
    assert.equal(Number(order.seller_payout_amount), 2490, 'seller payout = subtotal - 10');
    assert.equal(Number(order.total_quantity), 3, 'total quantity = sum of line quantities');
    assert.equal(order.fulfillment_type, 'COURIER');
    assert.equal(order.seller_id, sellerA);

    const items = (await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [result.orderId])).rows;
    assert.equal(items.length, 2, 'two order_items rows');
    const byProduct = Object.fromEntries(items.map(i => [String(i.product_id), i]));
    assert.equal(Number(byProduct[pA1].quantity), 2);
    assert.equal(Number(byProduct[pA1].subtotal), 2000);
    // both column pairs populated (readers use product_name/product_price)
    assert.ok(byProduct[pA1].product_name && byProduct[pA1].name, 'both name columns set');
    assert.equal(Number(byProduct[pA1].product_price), 1000);
    assert.equal(Number(byProduct[pA1].price), 1000);

    const payments = (await pool.query('SELECT * FROM payments WHERE invoice_id=$1', [String(result.orderId)])).rows;
    assert.equal(payments.length, 1, 'one payment for the bag');
    assert.equal(Number(payments[0].amount), 2550);
  });

  it('single-item checkout now also writes an order_items row (unified model)', async () => {
    const token = `${uniq}-single`;
    tokens.push(token);
    const result = await initiateProductPayment(
      baseOrder(token, { items: [{ productId: pA1, quantity: 1 }] }),
      { providerClient: mockProvider }
    );
    const items = (await pool.query('SELECT * FROM order_items WHERE order_id=$1', [result.orderId])).rows;
    assert.equal(items.length, 1, 'single-item order has one order_items row');
    assert.equal(Number(items[0].product_id), pA1);
    assert.equal(Number(items[0].subtotal), 1000);
  });

  it('allows a physical + digital bag (COURIER)', async () => {
    const token = `${uniq}-mix`;
    tokens.push(token);
    const result = await initiateProductPayment(
      baseOrder(token, { items: [{ productId: pA1, quantity: 1 }, { productId: pDigital, quantity: 1 }] }),
      { providerClient: mockProvider }
    );
    const order = (await pool.query('SELECT * FROM product_orders WHERE id=$1', [result.orderId])).rows[0];
    assert.equal(Number(order.total_amount), 1300 + Math.ceil(1300 * 0.02), 'subtotal 1300 + 2%');
    assert.equal(order.fulfillment_type, 'COURIER', 'any physical → COURIER');
  });

  it('rejects a mixed-seller bag without creating an order', async () => {
    const token = `${uniq}-mixed-seller`;
    tokens.push(token);
    await assert.rejects(
      () => initiateProductPayment(
        baseOrder(token, { items: [{ productId: pA1, quantity: 1 }, { productId: pB1, quantity: 1 }] }),
        { providerClient: mockProvider }
      ),
      /same (seller|shop)|one seller/i
    );
    const n = (await pool.query(`SELECT count(*)::int AS n FROM product_orders WHERE client_checkout_token=$1`, [token])).rows[0].n;
    assert.equal(n, 0, 'no order created');
  });

  it('rejects a service product inside a multi-item bag', async () => {
    const token = `${uniq}-service-bag`;
    tokens.push(token);
    await assert.rejects(
      () => initiateProductPayment(
        baseOrder(token, { items: [{ productId: pA1, quantity: 1 }, { productId: pService, quantity: 1 }] }),
        { providerClient: mockProvider }
      ),
      /on its own|not.*bag|single/i
    );
  });

  it('rejects a bag larger than 5 items', async () => {
    const token = `${uniq}-toobig`;
    tokens.push(token);
    const items = Array.from({ length: 6 }, () => ({ productId: pA1, quantity: 1 }));
    await assert.rejects(
      () => initiateProductPayment(baseOrder(token, { items }), { providerClient: mockProvider }),
      /at most 5|maximum|too many/i
    );
  });
});
