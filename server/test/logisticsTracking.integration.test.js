// Real-path tests for the read-only logistics surface (integration):
//  - public tracking link: valid HMAC token returns a PII-free payload; a tampered
//    token and a forged-audience token are rejected (crypto gate).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import LogisticsTrackingLinkService from '../src/domains/logistics/logisticsTrackingLink.service.js';

const uniq = `track-${Date.now()}`;
const BUYER_NAME = `SecretBuyer_${uniq}`;
const BUYER_EMAIL = `secret-${uniq}@byblos.test`;

describe('logistics read-only surface (integration, real path)', () => {
  let sellerId, buyerId, orderId, requestId, publicId, partnerId;

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status)
       VALUES ('SellerCo','sc-${uniq}@byblos.test','0700','ShopFront-${uniq}','active') RETURNING id`
    )).rows[0].id;
    buyerId = (await pool.query(
      `INSERT INTO buyers (full_name,email,mobile_payment,whatsapp_number,refunds)
       VALUES ($1,$2,'0712345678','0712345678',0) RETURNING id`, [BUYER_NAME, BUYER_EMAIL]
    )).rows[0].id;
    orderId = (await pool.query(
      `INSERT INTO product_orders
         (seller_id, buyer_id, status, payment_status, order_type,
          total_amount, platform_fee_amount, seller_payout_amount, client_checkout_token,
          buyer_name, buyer_email)
       VALUES ($1,$2,'PAID','completed','PHYSICAL',1000,10,990,$3,$4,$5) RETURNING id`,
      [sellerId, buyerId, `${uniq}-tok`, BUYER_NAME, BUYER_EMAIL]
    )).rows[0].id;
    partnerId = (await pool.query(
      `INSERT INTO logistics_partners (name,slug) VALUES ('Mzigo ${uniq}','mzigo-${uniq}') RETURNING id`
    )).rows[0].id;
    requestId = (await pool.query(
      `INSERT INTO logistics_requests (order_id, partner_id, status) VALUES ($1,$2,'in_progress') RETURNING id`,
      [orderId, partnerId]
    )).rows[0].id;
    await pool.query(
      `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, destination_address)
       VALUES ($1,'delivery','buyer','out_for_delivery','123 Buyer Street, Nairobi')`, [requestId]
    );
    publicId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO logistics_tracking_links (logistics_request_id, audience, public_id, active)
       VALUES ($1,'buyer',$2,true)`, [requestId, publicId]
    );
  });

  after(async () => {
    await pool.query('DELETE FROM logistics_tracking_links WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_legs WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_requests WHERE id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]).catch(() => {});
    await pool.query('DELETE FROM logistics_partners WHERE id = $1', [partnerId]).catch(() => {});
    await pool.query('DELETE FROM buyers WHERE id = $1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]).catch(() => {});
  });

  it('a valid buyer token returns a payload with NO buyer PII', async () => {
    const token = LogisticsTrackingLinkService.tokenFor(publicId, 'buyer');
    const payload = await LogisticsTrackingLinkService.getSafeTrackingByToken(token);

    assert.ok(payload.orderNumber, 'exposes order number');
    assert.equal(payload.audience, 'buyer');

    // The public payload must never leak buyer identity/contact.
    const json = JSON.stringify(payload);
    assert.ok(!json.includes(BUYER_NAME), 'buyer name must not appear');
    assert.ok(!json.includes(BUYER_EMAIL), 'buyer email must not appear');
    assert.ok(!json.includes('0712345678'), 'buyer phone must not appear');
  });

  it('rejects a tampered token (HMAC signature gate)', async () => {
    const token = LogisticsTrackingLinkService.tokenFor(publicId, 'buyer');
    // Flip the last character of the signature.
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A');
    await assert.rejects(
      () => LogisticsTrackingLinkService.getSafeTrackingByToken(tampered),
      /invalid/i
    );
  });

  it('rejects forging a seller token from a buyer public_id (audience-scoped HMAC)', async () => {
    // No seller link exists; a token minted for the seller audience over the same
    // public_id must fail because the DB has no matching (public_id, audience) row.
    const sellerToken = LogisticsTrackingLinkService.tokenFor(publicId, 'seller');
    await assert.rejects(
      () => LogisticsTrackingLinkService.getSafeTrackingByToken(sellerToken),
      /invalid or not active/i
    );
  });
});
