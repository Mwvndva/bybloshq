// Concurrency regression for the generate_order_number() trigger.
//
// Fires many simultaneous order inserts (each on its own pooled connection, so they
// are genuinely concurrent transactions) and asserts every one gets a DISTINCT
// order_number with no unique-constraint failure. Against the old non-atomic
// MAX(...)+1 trigger this collides and some inserts throw; the advisory-lock fix
// serializes per-day generation so all succeed.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';

const uniq = `onc-${Date.now()}`;
const N = 25;

describe('generate_order_number concurrency (integration, real path)', () => {
  let sellerId, buyerId;
  const tokens = [];

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
  });

  after(async () => {
    for (const t of tokens) {
      await pool.query('DELETE FROM product_orders WHERE client_checkout_token = $1', [t]).catch(() => {});
    }
    await pool.query('DELETE FROM buyers WHERE id = $1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]).catch(() => {});
  });

  it(`assigns ${N} distinct order numbers under fully concurrent inserts`, async () => {
    const insertOne = (i) => {
      const token = `${uniq}-${i}`;
      tokens.push(token);
      // order_number omitted -> trigger fires (WHEN order_number IS NULL).
      return pool.query(
        `INSERT INTO product_orders
           (seller_id, buyer_id, status, payment_status, order_type,
            total_amount, platform_fee_amount, seller_payout_amount, client_checkout_token)
         VALUES ($1,$2,'PAYMENT_PENDING','pending','PHYSICAL',1000,10,990,$3)
         RETURNING order_number`,
        [sellerId, buyerId, token]
      );
    };

    // Fire all N at once — each pool.query grabs its own connection => concurrent txns.
    const results = await Promise.all(Array.from({ length: N }, (_, i) => insertOne(i)));
    const orderNumbers = results.map(r => r.rows[0].order_number);

    // Every insert succeeded (no duplicate-key throw) and produced a value.
    assert.equal(orderNumbers.length, N);
    assert.ok(orderNumbers.every(Boolean), 'every order got a number');

    // All numbers are unique.
    const unique = new Set(orderNumbers);
    assert.equal(unique.size, N, `expected ${N} distinct order numbers, got ${unique.size}`);

    // And they match the canonical ORD-YYYYMMDD-NNNNNN format.
    assert.ok(orderNumbers.every(n => /^ORD-\d{8}-\d{6}$/.test(n)), 'canonical order-number format preserved');
  });
});
