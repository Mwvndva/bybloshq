// Inventory reservation regression (H1). Stock-tracked products must not oversell,
// and a declined charge must release the reservation.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';

const ok = { async initiatePayment({ api_ref }) { return { success: true, reference: `PSK_${api_ref}`, status: 'pending' }; } };
const declined = { async initiatePayment() { throw Object.assign(new Error('Declined'), { statusCode: 400 }); } };

function order(productId, token) {
  return {
    buyer: { id: null, name: 'B', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: 'I', quantity: 1 },
    location: {}, metadata: { delivery: {}, client_checkout_token: token }, idempotencyKey: token,
  };
}
async function reserved(productId) { return Number((await pool.query('SELECT reserved_quantity FROM products WHERE id=$1', [productId])).rows[0].reserved_quantity); }

describe('inventory reservation (integration)', () => {
  let sellerId, productId;
  const tokens = [];

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s@byblos.test','07','Shop-inv','active') RETURNING id`)).rows[0].id;
    productId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status,track_inventory,quantity,reserved_quantity) VALUES ($1,'I',999,'physical',false,'available',true,1,0) RETURNING id`, [sellerId])).rows[0].id;
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query('DELETE FROM product_orders WHERE client_checkout_token=$1', [t]).catch(() => {});
    }
    await pool.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('reserves stock on checkout and rejects the second buyer (no oversell)', async () => {
    const t1 = `inv-1-${Date.now()}`; tokens.push(t1);
    const r1 = await initiateProductPayment(order(productId, t1), { providerClient: ok });
    assert.ok(r1.orderId, 'first order created');
    assert.equal(await reserved(productId), 1, 'stock reserved');

    const t2 = `inv-2-${Date.now()}`; tokens.push(t2);
    await assert.rejects(() => initiateProductPayment(order(productId, t2), { providerClient: ok }), /Insufficient stock/);
    assert.equal(await reserved(productId), 1, 'no over-reservation');
    assert.equal((await pool.query('SELECT count(*)::int n FROM product_orders WHERE client_checkout_token=$1', [t2])).rows[0].n, 0, 'no order for the rejected second buyer');
  });

  it('releases the reservation when the charge is explicitly declined', async () => {
    // reset stock
    await pool.query('UPDATE products SET reserved_quantity=0 WHERE id=$1', [productId]);
    const t = `inv-decline-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(order(productId, t), { providerClient: declined });
    assert.equal(res.failed, true, 'explicit decline → failed');
    assert.equal(await reserved(productId), 0, 'reservation released after decline');
  });
});
