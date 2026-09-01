// Digital access control (integration): a buyer can only get a download for a
// digital product inside a PAID order they OWN — not another buyer's, not an unpaid one.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import { findVerifiedDigitalItem } from '../src/domains/commerce/repositories/digitalDownload.repository.js';

const uniq = `da-${Date.now()}`;

async function makeOrder(sellerId, buyerId, productId, paymentStatus) {
  const orderId = (await pool.query(
    `INSERT INTO product_orders (seller_id,buyer_id,status,payment_status,order_type,total_amount,platform_fee_amount,seller_payout_amount,client_checkout_token)
     VALUES ($1,$2,'PAID',$3,'DIGITAL',1000,10,990,$4) RETURNING id`,
    [sellerId, buyerId, paymentStatus, `${uniq}-${Math.random().toString(36).slice(2)}`]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal) VALUES ($1,$2,'Digital',1000,1,1000)`,
    [orderId, productId]
  );
  return orderId;
}

describe('digital download access control (integration)', () => {
  let sellerId, buyerA, buyerB, productId, paidOrder, unpaidOrder;

  before(async () => {
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s-${uniq}@byblos.test','07','Shop-${uniq}','active') RETURNING id`)).rows[0].id;
    buyerA = (await pool.query(`INSERT INTO buyers (full_name,email,mobile_payment,refunds) VALUES ('A','a-${uniq}@byblos.test','0712345678',0) RETURNING id`)).rows[0].id;
    buyerB = (await pool.query(`INSERT INTO buyers (full_name,email,mobile_payment,refunds) VALUES ('B','b-${uniq}@byblos.test','0712345679',0) RETURNING id`)).rows[0].id;
    productId = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status,digital_file_path) VALUES ($1,'DigitalGood',1000,'digital',true,'available','vault/${uniq}.pdf') RETURNING id`, [sellerId])).rows[0].id;
    paidOrder = await makeOrder(sellerId, buyerA, productId, 'completed');
    unpaidOrder = await makeOrder(sellerId, buyerA, productId, 'pending');
  });

  after(async () => {
    await pool.query('DELETE FROM order_items WHERE order_id IN ($1,$2)', [paidOrder, unpaidOrder]).catch(() => {});
    await pool.query('DELETE FROM product_orders WHERE id IN ($1,$2)', [paidOrder, unpaidOrder]).catch(() => {});
    await pool.query('DELETE FROM products WHERE id=$1', [productId]).catch(() => {});
    await pool.query('DELETE FROM buyers WHERE id IN ($1,$2)', [buyerA, buyerB]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('the owning buyer of a PAID order gets the digital item', async () => {
    const item = await findVerifiedDigitalItem({ orderId: paidOrder, buyerId: buyerA, productId });
    assert.ok(item, 'item returned for the paying owner');
    assert.equal(String(item.product_id), String(productId));
  });

  it('a DIFFERENT buyer gets nothing (no cross-buyer download)', async () => {
    const item = await findVerifiedDigitalItem({ orderId: paidOrder, buyerId: buyerB, productId });
    assert.equal(item, undefined, 'other buyer cannot access the file');
  });

  it('an UNPAID order yields nothing (no pay-less download)', async () => {
    const item = await findVerifiedDigitalItem({ orderId: unpaidOrder, buyerId: buyerA, productId });
    assert.equal(item, undefined, 'unpaid order cannot access the file');
  });
});
