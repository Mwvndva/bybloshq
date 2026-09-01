// Custom / imported product regression (H3). SLA + custom status are derived from
// the product, validated server-side, and cannot be forged via client metadata.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';

const ok = { async initiatePayment({ api_ref }) { return { success: true, reference: `PSK_${api_ref}`, status: 'pending' }; } };

function order(productId, token, extraMeta = {}) {
  return {
    buyer: { id: null, name: 'B', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: 'I', quantity: 1 },
    location: {}, metadata: { delivery: {}, client_checkout_token: token, ...extraMeta }, idempotencyKey: token,
  };
}
async function orderRow(id) { return (await pool.query('SELECT * FROM product_orders WHERE id=$1', [id])).rows[0]; }

describe('custom / imported products (integration)', () => {
  let sellerId, customId, importedId, plainId;
  const tokens = [];

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s@byblos.test','07','Shop-cust','active') RETURNING id`)).rows[0].id;
    customId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status,is_custom_product,production_days) VALUES ($1,'Custom',999,'physical',false,'available',true,3) RETURNING id`, [sellerId])).rows[0].id;
    importedId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status,is_imported_product,import_days) VALUES ($1,'Imported',999,'physical',false,'available',true,14) RETURNING id`, [sellerId])).rows[0].id;
    plainId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status) VALUES ($1,'Plain',999,'physical',false,'available') RETURNING id`, [sellerId])).rows[0].id;
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query('DELETE FROM product_orders WHERE client_checkout_token=$1', [t]).catch(() => {});
    }
    await pool.query('DELETE FROM products WHERE id=ANY($1)', [[customId, importedId, plainId]]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('custom product requires customization instructions', async () => {
    const t = `cp-noinstr-${Date.now()}`; tokens.push(t);
    await assert.rejects(() => initiateProductPayment(order(customId, t), { providerClient: ok }), /Customization instructions are required/);
  });

  it('custom product: SLA derived from the product (production_days), not the client', async () => {
    const t = `cp-ok-${Date.now()}`; tokens.push(t);
    // client lies about production_days; server must use the product's value (3)
    const res = await initiateProductPayment(order(customId, t, { customization_instructions: 'Blue, size L', custom_product: { production_days: 30 } }), { providerClient: ok });
    const o = await orderRow(res.orderId);
    assert.equal(o.pre_handoff_sla.type, 'custom_production');
    assert.equal(o.pre_handoff_sla.production_days, 3, 'production_days from product, not client 30');
    assert.equal(o.pre_handoff_sla.buyer_instructions, 'Blue, size L');
  });

  it('imported product: import_waiting SLA with product import_days', async () => {
    const t = `cp-imp-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(order(importedId, t), { providerClient: ok });
    const o = await orderRow(res.orderId);
    assert.equal(o.pre_handoff_sla.type, 'import_waiting');
    assert.equal(o.pre_handoff_sla.import_days, 14);
  });

  it('plain product: client-injected custom_product metadata is ignored (no fake SLA)', async () => {
    const t = `cp-inject-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(order(plainId, t, { custom_product: { is_custom_product: true, production_days: 30 } }), { providerClient: ok });
    const o = await orderRow(res.orderId);
    assert.equal(o.pre_handoff_sla ?? null, null, 'no SLA for a non-custom product');
    assert.equal(o.metadata.custom_product ?? null, null, 'client-injected custom_product ignored');
  });
});
