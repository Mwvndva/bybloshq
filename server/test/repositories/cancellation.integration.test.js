// Cancellation regression through the real OrderService.cancelOrder path (was
// broken: OrderService.cancelOrder was missing → runtime TypeError).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/infrastructure/database/database.js';
import { initiateProductPayment } from '../../src/domains/payments/payments/productCheckout.service.js';
import CorePaymentService from '../../src/domains/payments/payments/CorePaymentService.js';
import { OrderService } from '../../src/domains/orders/order/OrderService.js';

const mockProvider = { async initiatePayment({ api_ref }) { return { success: true, reference: `PSK_${api_ref}`, status: 'pending' }; } };
function checkout(productId, buyerId, token) {
  return {
    buyer: { id: buyerId, name: 'B', phone: '0712345678', mobilePayment: '0712345678', email: 'b@byblos.test' },
    service: { id: productId, title: 'I', quantity: 1 },
    location: {}, metadata: { delivery: {}, client_checkout_token: token }, idempotencyKey: token,
  };
}
async function settle(res) { await CorePaymentService.completeVerifiedPayment({ paymentId: res.paymentId, providerPayload: { status: 'success', amount: 1019 }, source: 'test' }); }
async function status(id) { return (await pool.query('SELECT status FROM product_orders WHERE id=$1', [id])).rows[0].status; }

describe('order cancellation (integration, real path)', () => {
  let sellerId, productId, buyerId;
  const tokens = [];

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s@byblos.test','07','Shop-cancel','active') RETURNING id`)).rows[0].id;
    productId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status) VALUES ($1,'I',999,'physical',false,'available') RETURNING id`, [sellerId])).rows[0].id;
    buyerId = (await pool.query(`INSERT INTO buyers (full_name,email,mobile_payment,refunds) VALUES ('B','b@byblos.test','0712345678',0) RETURNING id`)).rows[0].id;
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query(`DELETE FROM payments WHERE metadata->>'order_id' IN (SELECT id::text FROM product_orders WHERE client_checkout_token=$1)`, [t]).catch(() => {});
      await pool.query('DELETE FROM product_orders WHERE client_checkout_token=$1', [t]).catch(() => {});
    }
    await pool.query('DELETE FROM buyers WHERE id=$1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('cancels a PAID order → CANCELLED and refunds the buyer', async () => {
    const t = `cx-ok-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(checkout(productId, buyerId, t), { providerClient: mockProvider });
    await settle(res);
    const before = Number((await pool.query('SELECT refunds FROM buyers WHERE id=$1', [buyerId])).rows[0].refunds);

    const updated = await OrderService.cancelOrder(res.orderId, 'Buyer requested cancellation');
    assert.equal(updated.status, 'CANCELLED');

    const after = Number((await pool.query('SELECT refunds FROM buyers WHERE id=$1', [buyerId])).rows[0].refunds);
    assert.equal(after - before, 1019, 'buyer refunded the full paid amount');
  });

  it('cannot cancel a COMPLETED order', async () => {
    const t = `cx-completed-${Date.now()}`; tokens.push(t);
    const res = await initiateProductPayment(checkout(productId, buyerId, t), { providerClient: mockProvider });
    await settle(res);
    await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'AWAITING_SELLER_ACTION');
    await OrderService.updateOrderStatus(res.orderId, { id: sellerId }, 'READY_FOR_BUYER');
    await OrderService.markAsCollected(res.orderId, buyerId); // → COMPLETED
    await assert.rejects(() => OrderService.cancelOrder(res.orderId, 'too late'), /Cannot cancel a completed order/);
    assert.equal(await status(res.orderId), 'COMPLETED');
  });
});
