// Buyer post-payment flow (integration): auto-login token on the status poll
// (Stage 4) and verification-link-as-login (Stage 3).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/infrastructure/database/database.js';
import { verifyToken } from '../src/shared/utils/jwt.js';
import { getOrderStatus } from '../src/application/controllers/public.controller.js';
import { verifyEmail } from '../src/domains/commerce/buyers/buyer.controller.js';

const uniq = `bpp-${Date.now()}`;

function mockRes() {
  const r = { statusCode: 200, body: null, cookies: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.cookie = (n, v) => { r.cookies[n] = v; return r; };
  r.clearCookie = (n) => { delete r.cookies[n]; return r; };
  return r;
}
const noop = () => {};

describe('buyer post-payment: auto-login token on status poll (Stage 4)', () => {
  let sellerId, userId, buyerId, orderId, orderNumber;
  const reference = `REF-${uniq}`;
  const clientToken = `cct-${crypto.randomUUID()}`;

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s-${uniq}@byblos.test','07','Shop-${uniq}','active') RETURNING id`)).rows[0].id;
    userId = (await pool.query(`INSERT INTO users (email,password_hash,role,is_verified,created_at,updated_at) VALUES ('u-${uniq}@byblos.test','x','buyer',true,NOW(),NOW()) RETURNING id`)).rows[0].id;
    buyerId = (await pool.query(`INSERT INTO buyers (full_name,email,mobile_payment,refunds,user_id) VALUES ('B','u-${uniq}@byblos.test','0712345678',0,$1) RETURNING id`, [userId])).rows[0].id;
    const ins = (await pool.query(
      `INSERT INTO product_orders (seller_id,buyer_id,status,payment_status,order_type,total_amount,platform_fee_amount,seller_payout_amount,client_checkout_token,payment_reference)
       VALUES ($1,$2,'PAID','completed','PHYSICAL',1000,10,990,$3,$4) RETURNING id, order_number`,
      [sellerId, buyerId, clientToken, reference]
    )).rows[0];
    orderId = ins.id;
    orderNumber = ins.order_number;
  });

  after(async () => {
    await pool.query('DELETE FROM product_orders WHERE id=$1', [orderId]).catch(() => {});
    await pool.query('DELETE FROM buyers WHERE id=$1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id=$1', [userId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  const poll = async (query) => {
    const res = mockRes();
    await getOrderStatus({ params: { id: orderNumber }, query, body: {} }, res, noop);
    return res;
  };

  it('mints an auto-login token when paid + correct client_checkout_token + verified buyer', async () => {
    const res = await poll({ client_checkout_token: clientToken });
    const token = res.body?.data?.autoLoginToken;
    assert.ok(token, 'autoLoginToken returned');
    const decoded = verifyToken(token);
    assert.equal(decoded.autoLogin, true);
    assert.equal(decoded.purpose, 'payment_success');
    assert.equal(String(decoded.id), String(userId));
  });

  it('does NOT mint a token without the client_checkout_token (reference alone is not enough)', async () => {
    const res = await poll({});
    assert.equal(res.body?.data?.autoLoginToken, undefined);
    assert.equal(res.body?.data?.orderNumber !== undefined, true, 'still returns order status');
  });

  it('does NOT mint a token for a wrong client_checkout_token', async () => {
    const res = await poll({ client_checkout_token: 'wrong-token' });
    assert.equal(res.body?.data?.autoLoginToken, undefined);
  });

  it('does NOT mint a token when the buyer is unverified', async () => {
    await pool.query('UPDATE users SET is_verified=false WHERE id=$1', [userId]);
    const res = await poll({ client_checkout_token: clientToken });
    assert.equal(res.body?.data?.autoLoginToken, undefined, 'unverified buyer uses magic-link, not auto-login');
    await pool.query('UPDATE users SET is_verified=true WHERE id=$1', [userId]);
  });
});

describe('buyer verification link doubles as login (Stage 3)', () => {
  let userId;
  const email = `verify-${uniq}@byblos.test`;
  const rawToken = crypto.randomBytes(16).toString('hex');

  before(async () => {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    userId = (await pool.query(
      `INSERT INTO users (email,password_hash,role,is_verified,email_verification_token,email_verification_expires,created_at,updated_at)
       VALUES ($1,'x','buyer',false,$2,NOW()+INTERVAL '1 hour',NOW(),NOW()) RETURNING id`,
      [email, hashed]
    )).rows[0].id;
  });

  after(async () => { await pool.query('DELETE FROM users WHERE id=$1', [userId]).catch(() => {}); });

  it('verifies the email AND issues a buyer session (magic-link)', async () => {
    const res = mockRes();
    await verifyEmail({ query: { email, token: rawToken } }, res, noop);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.autoLoggedIn, true, 'session issued');
    const token = res.body?.data?.token;
    assert.ok(token, 'session token returned');
    const decoded = verifyToken(token);
    assert.equal(String(decoded.id), String(userId));
    assert.equal(decoded.role, 'buyer');
    assert.ok(res.cookies.jwt, 'auth cookie set');

    const verified = (await pool.query('SELECT is_verified FROM users WHERE id=$1', [userId])).rows[0];
    assert.equal(verified.is_verified, true, 'email marked verified');
  });
});
