// Fulfillment / logistics regression (integration).
// Door-delivery path: delivery fee is buyer-paid and passes through to logistics
// (excluded from seller payout and platform fee); a payment_pending logistics
// request is created; fulfillment_type is COURIER.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';

const mockProvider = {
  async initiatePayment({ api_ref }) {
    return { success: true, reference: `PSK_${api_ref}`, status: 'pending', message: 'ok' };
  },
};

function doorOrder(productId, token) {
  return {
    buyer: { id: null, name: 'Buyer', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: 'Item', quantity: 1 },
    location: { address: 'Nairobi', lat: -1.30, lng: 36.82 },
    metadata: {
      delivery: { doorDelivery: true, location: { lat: -1.30, lng: 36.82, address: 'Buyer address, Nairobi' } },
      client_checkout_token: token,
    },
    idempotencyKey: token,
  };
}

describe('door delivery / logistics (integration)', () => {
  let sellerId, productId;
  const tokens = [];

  before(async () => {
    // See settlement test: history trigger is PG17-incompatible on updates.
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    await pool.query(
      `INSERT INTO logistics_partners (name, slug, active) VALUES ('Mzigo Ego','mzigo-ego',true)
       ON CONFLICT DO NOTHING`
    ).catch(async () => {
      await pool.query(`UPDATE logistics_partners SET active=true WHERE slug='mzigo-ego'`).catch(() => {});
    });
    const s = await pool.query(
      `INSERT INTO sellers (full_name, email, whatsapp_number, shop_name, status)
       VALUES ('Seller','seller@byblos.test','0700000000','Shop-d712e8','active') RETURNING id`
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
      await pool.query(`DELETE FROM logistics_legs WHERE logistics_request_id IN (SELECT id FROM logistics_requests WHERE order_id IN (SELECT id FROM product_orders WHERE client_checkout_token=$1))`, [t]).catch(() => {});
      await pool.query(`DELETE FROM logistics_requests WHERE order_id IN (SELECT id FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query(`DELETE FROM product_orders WHERE client_checkout_token=$1`, [t]).catch(() => {});
    }
    await pool.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('door delivery: fee added to buyer total only; payout & platform fee unchanged; COURIER + logistics request', async () => {
    const token = `log-${Date.now()}`;
    tokens.push(token);
    const res = await initiateProductPayment(doorOrder(productId, token), { providerClient: mockProvider });

    const { rows } = await pool.query('SELECT * FROM product_orders WHERE id=$1', [res.orderId]);
    const o = rows[0];
    const deliveryFee = Number(o.metadata.pricing.buyer_delivery_fee);
    assert.ok(deliveryFee > 0, 'a positive delivery fee was quoted');

    assert.equal(o.fulfillment_type, 'COURIER', 'physical + door delivery → COURIER');
    assert.equal(Number(o.seller_payout_amount), 989, 'seller payout excludes delivery fee (= subtotal - 10)');
    assert.equal(Number(o.platform_fee_amount), 30, 'platform fee excludes delivery fee (= 10 + serviceCharge)');
    assert.equal(Number(o.total_amount), 999 + 20 + deliveryFee, 'buyer total = subtotal + serviceCharge + delivery');

    const { rows: lr } = await pool.query('SELECT * FROM logistics_requests WHERE order_id=$1', [res.orderId]);
    assert.equal(lr.length, 1, 'one logistics request created');

    const { rows: legs } = await pool.query(
      `SELECT status FROM logistics_legs WHERE logistics_request_id=$1 AND leg_type='delivery'`,
      [lr[0].id]
    );
    assert.ok(legs.length >= 1, 'a delivery leg was created');
    assert.equal(legs[0].status, 'payment_pending', 'delivery leg starts payment_pending');
  });
});
