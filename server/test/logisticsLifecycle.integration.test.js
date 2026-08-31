// Real-path tests for the Mzigo delivery leg lifecycle (integration).
//
// Verifies the audited behaviour of LogisticsDashboardService.updateLegStatus:
//  - marking the DELIVERY leg 'delivered' hands the order off to the buyer
//    (status -> READY_FOR_BUYER) WITHOUT completing it or firing payout — Mzigo
//    never completes; the buyer confirms;
//  - a partner can only update legs of requests assigned to them (no BOLA);
//  - the transition is idempotent (a repeat 'delivered' is a no-op).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import LogisticsDashboardService from '../src/domains/logistics/logisticsDashboard.service.js';

const uniq = `logi-${Date.now()}`;

describe('Mzigo delivery leg lifecycle (integration, real path)', () => {
  let sellerId, buyerId, productId, orderId, partnerId, otherPartnerId, requestId;

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status)
       VALUES ('S','s-${uniq}@byblos.test','07','Shop-${uniq}','active') RETURNING id`
    )).rows[0].id;
    buyerId = (await pool.query(
      `INSERT INTO buyers (full_name,email,mobile_payment,refunds)
       VALUES ('B','b-${uniq}@byblos.test','0712345678',0) RETURNING id`
    )).rows[0].id;
    productId = (await pool.query(
      `INSERT INTO products (seller_id,name,price,product_type,is_digital,status)
       VALUES ($1,'I',999,'physical',false,'available') RETURNING id`, [sellerId]
    )).rows[0].id;
    orderId = (await pool.query(
      `INSERT INTO product_orders
         (seller_id, buyer_id, status, payment_status, order_type,
          total_amount, platform_fee_amount, seller_payout_amount, client_checkout_token)
       VALUES ($1,$2,'PAID','completed','PHYSICAL',1000,10,990,$3) RETURNING id`,
      [sellerId, buyerId, `${uniq}-tok`]
    )).rows[0].id;
    partnerId = (await pool.query(
      `INSERT INTO logistics_partners (name,slug) VALUES ('Mzigo ${uniq}','mzigo-${uniq}') RETURNING id`
    )).rows[0].id;
    otherPartnerId = (await pool.query(
      `INSERT INTO logistics_partners (name,slug) VALUES ('Other ${uniq}','other-${uniq}') RETURNING id`
    )).rows[0].id;
    requestId = (await pool.query(
      `INSERT INTO logistics_requests (order_id, partner_id, status) VALUES ($1,$2,'in_progress') RETURNING id`,
      [orderId, partnerId]
    )).rows[0].id;
    // Delivery leg already out for delivery (past the payment gate).
    await pool.query(
      `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status)
       VALUES ($1,'delivery','buyer','out_for_delivery')`, [requestId]
    );
  });

  after(async () => {
    await pool.query('DELETE FROM logistics_legs WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_tracking_events WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_requests WHERE id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]).catch(() => {});
    await pool.query('DELETE FROM logistics_partners WHERE id IN ($1,$2)', [partnerId, otherPartnerId]).catch(() => {});
    await pool.query('DELETE FROM products WHERE id = $1', [productId]).catch(() => {});
    await pool.query('DELETE FROM buyers WHERE id = $1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]).catch(() => {});
  });

  const orderStatus = async () =>
    (await pool.query('SELECT status FROM product_orders WHERE id = $1', [orderId])).rows[0].status;

  it('rejects a partner updating a request that is not theirs (no BOLA)', async () => {
    await assert.rejects(
      () => LogisticsDashboardService.updateLegStatus({
        partner: { id: otherPartnerId }, partnerId: otherPartnerId,
        requestId, legType: 'delivery', status: 'delivered',
      }),
      /not found for this partner/i
    );
    assert.equal(await orderStatus(), 'PAID', 'order untouched by the unauthorized attempt');
  });

  it('marks the delivery leg delivered and hands the order to the buyer (READY_FOR_BUYER)', async () => {
    const res = await LogisticsDashboardService.updateLegStatus({
      partner: { id: partnerId, name: 'Mzigo' }, partnerId,
      requestId, legType: 'delivery', status: 'delivered',
    });
    assert.equal(res.status, 'delivered');

    // The buyer, not Mzigo, completes — so the order is READY_FOR_BUYER, NOT COMPLETED.
    assert.equal(await orderStatus(), 'READY_FOR_BUYER');
  });

  it('is idempotent — a repeat delivered is a no-op and does not complete the order', async () => {
    const res = await LogisticsDashboardService.updateLegStatus({
      partner: { id: partnerId, name: 'Mzigo' }, partnerId,
      requestId, legType: 'delivery', status: 'delivered',
    });
    assert.equal(res.updated, false);
    assert.equal(await orderStatus(), 'READY_FOR_BUYER', 'still awaiting buyer confirmation');
  });
});
