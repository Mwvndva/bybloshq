// Full fulfillment-lifecycle regression through the REAL OrderService methods
// (no direct SQL status jumps except the history-trigger fixture). Proves that a
// PAID order progresses to COMPLETED via seller prep + BUYER confirmation, and
// that completion fires the payout trigger. Also covers invalid/unauthorized
// transitions (status-machine audit).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';
import CorePaymentService from '../../src/domains/payments/payments/CorePaymentService.js';
import { OrderService } from '../../src/domains/orders/order/OrderService.js';

const mockProvider = { async initiatePayment({ api_ref }) { return { success: true, reference: `PSK_${api_ref}`, status: 'pending' }; } };

function checkout(productId, buyerId, token, productTitle = 'Item') {
  return {
    buyer: { id: buyerId, name: 'Buyer', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: productTitle, quantity: 1 },
    location: { address: 'Nairobi', lat: null, lng: null },
    metadata: { delivery: {}, client_checkout_token: token },
    idempotencyKey: token,
  };
}

async function settle(res) {
  await CorePaymentService.completeVerifiedPayment({ paymentId: res.paymentId, providerPayload: { status: 'success', amount: 1019 }, source: 'test' });
}
async function status(orderId) { return (await pool.query('SELECT status, completed_at FROM product_orders WHERE id=$1', [orderId])).rows[0]; }

describe('order fulfillment lifecycle (integration, real methods)', () => {
  let sellerId, physicalId, serviceId, buyerId;
  const tokens = [];

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s@byblos.test','07','Shop-61ffdf','active') RETURNING id`)).rows[0].id;
    physicalId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status) VALUES ($1,'Phys',999,'physical',false,'available') RETURNING id`, [sellerId])).rows[0].id;
    serviceId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status) VALUES ($1,'Svc',999,'service',false,'available') RETURNING id`, [sellerId])).rows[0].id;
    buyerId = (await pool.query(`INSERT INTO buyers (full_name,email,mobile_payment) VALUES ('Buyer','b@byblos.test','0712345678') RETURNING id`)).rows[0].id;
  });

  after(async () => {
    for (const t of tokens) {
      const ids = (await pool.query('SELECT id FROM product_orders WHERE client_checkout_token=$1', [t])).rows.map(r => r.id);
      for (const id of ids) await pool.query('DELETE FROM payouts WHERE order_id=$1', [id]).catch(() => {});
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query('DELETE FROM product_orders WHERE client_checkout_token=$1', [t]).catch(() => {});
    }
    await pool.query('DELETE FROM buyers WHERE id=$1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM products WHERE id=ANY($1)', [[physicalId, serviceId]]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('collection/pickup: PAID → AWAITING_SELLER_ACTION → READY_FOR_BUYER → (buyer collects) COMPLETED → payout', async () => {
    const t = `lc-pickup-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(checkout(physicalId, buyerId, t), { providerClient: mockProvider });
    await settle(res);
    assert.equal((await status(res.orderId)).status, 'PAID');

    await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'AWAITING_SELLER_ACTION');
    await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'READY_FOR_BUYER');
    assert.equal((await status(res.orderId)).status, 'READY_FOR_BUYER');

    const done = await OrderService.markAsCollected(res.orderId, buyerId); // buyer confirms
    assert.equal(done.status, 'COMPLETED');
    assert.ok((await status(res.orderId)).completed_at, 'completed_at set');

    const payout = (await pool.query('SELECT amount, seller_id FROM payouts WHERE order_id=$1', [res.orderId])).rows;
    assert.equal(payout.length, 1, 'payout created on completion');
    assert.equal(Number(payout[0].amount), 989, 'payout = seller_payout_amount');
  });

  it('service: PAID → (seller confirmBooking) FULFILLING → READY_FOR_BUYER → (buyer confirms) COMPLETED → payout', async () => {
    const t = `lc-svc-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(checkout(serviceId, buyerId, t, 'Svc'), { providerClient: mockProvider });
    await settle(res);

    const booked = await OrderService.confirmBooking(res.orderId, sellerId);
    assert.equal(booked.status, 'FULFILLING', 'seller booking → FULFILLING');
    await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'READY_FOR_BUYER');

    const done = await OrderService.confirmOrderReceipt(res.orderId, buyerId);
    assert.equal(done.status, 'COMPLETED');
    assert.equal(Number((await pool.query('SELECT amount FROM payouts WHERE order_id=$1', [res.orderId])).rows[0].amount), 989);
  });

  it('status-machine: buyer cannot complete a PAID order that is not ready (invalid transition rejected)', async () => {
    const t = `lc-invalid-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(checkout(physicalId, buyerId, t), { providerClient: mockProvider });
    await settle(res); // order is PAID (not READY_FOR_BUYER)
    await assert.rejects(() => OrderService.confirmOrderReceipt(res.orderId, buyerId), /Invalid.*transition|transition/i);
    assert.equal((await status(res.orderId)).status, 'PAID', 'still PAID; no illegal jump to COMPLETED');
    assert.equal((await pool.query('SELECT count(*)::int n FROM payouts WHERE order_id=$1', [res.orderId])).rows[0].n, 0, 'no payout for incomplete order');
  });

  it('authorization: a different buyer cannot confirm someone else\'s order', async () => {
    const t = `lc-auth-${Date.now()}`; tokens.push(t);
    const other = (await pool.query(`INSERT INTO buyers (full_name,email,mobile_payment) VALUES ('Other','o@byblos.test','0722000000') RETURNING id`)).rows[0].id;
    try {
      const res = await initiateProductPayment(checkout(physicalId, buyerId, t), { providerClient: mockProvider });
      await settle(res);
      await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'AWAITING_SELLER_ACTION');
      await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'READY_FOR_BUYER');
      await assert.rejects(() => OrderService.markAsCollected(res.orderId, other), /unauthorized|not found/i);
      assert.equal((await status(res.orderId)).status, 'READY_FOR_BUYER', 'unchanged by unauthorized actor');
    } finally {
      await pool.query('DELETE FROM buyers WHERE id=$1', [other]).catch(() => {});
    }
  });
});
