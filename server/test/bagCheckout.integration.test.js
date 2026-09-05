// Integration tests for the bag (cart) checkout — the real
// initiateProductPayment against a real DB, with a mock payment provider. Proves
// a multi-item bag builds the correct order + items + payment with authoritative
// financials, that creator commission is resolved and persisted (and funded by
// the seller, not the buyer), that the checkout is idempotent, and that the
// single-seller-per-bag rule is enforced.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const { initiateProductPayment } = await import('../src/domains/payments/payments/productCheckout.service.js');
const { computeServiceCharge } = await import('../src/domains/payments/payments/checkoutPricing.js');
const { createBuyer, createSeller, createCreator, createSellerCreatorLink, cleanupOrder, cleanupBuyer, cleanupSeller, cleanupCreator } =
  await import('./helpers/factories.js');

let productSeq = 0;
async function createProduct(sellerId, price, { productType = 'physical', name } = {}) {
  productSeq += 1;
  const { rows } = await pool.query(
    `INSERT INTO products (seller_id, name, price, product_type, status, is_digital)
     VALUES ($1, $2, $3, $4, 'available', $5) RETURNING id, price`,
    [sellerId, name || `Test Product ${productSeq}`, price, productType, productType === 'digital']
  );
  return rows[0];
}

const mockProvider = { initiatePayment: async () => ({ reference: `mock-ref-${Date.now()}`, status: 'pending' }) };

function buyerInput(buyer) {
  return { id: buyer.id, name: 'Test Buyer', email: buyer.email, mobilePayment: '0712345678' };
}

async function orderByToken(token) {
  const { rows } = await pool.query(
    'SELECT * FROM product_orders WHERE client_checkout_token = $1 ORDER BY id DESC LIMIT 1', [token]
  );
  return rows[0];
}

async function cleanupCheckout({ order, products = [], buyer, seller, creator }) {
  if (order) await cleanupOrder(order.id).catch(() => {});
  for (const p of products) await pool.query('DELETE FROM products WHERE id = $1', [p.id]).catch(() => {});
  if (creator) await cleanupCreator(creator.id).catch(() => {});
  if (seller) await cleanupSeller(seller.id).catch(() => {});
  if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
}

describe('Bag checkout (real initiateProductPayment, mock provider)', () => {
  test('a multi-item bag builds one order with authoritative financials + one item row per line', async (t) => {
    const ctx = {};
    t.after(() => cleanupCheckout(ctx));
    ctx.seller = await createSeller({});
    ctx.buyer = await createBuyer({});
    const p1 = await createProduct(ctx.seller.id, 600);
    const p2 = await createProduct(ctx.seller.id, 400);
    ctx.products = [p1, p2];

    const token = `bag-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await initiateProductPayment({
      buyer: buyerInput(ctx.buyer),
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 2 }],
      metadata: {}, location: {}, idempotencyKey: token
    }, { providerClient: mockProvider });

    ctx.order = await orderByToken(token);
    const subtotal = 600 * 1 + 400 * 2; // 1400
    const sc = computeServiceCharge(subtotal);
    assert.equal(Number(ctx.order.total_amount), subtotal + sc, 'buyer total = subtotal + service charge');
    assert.equal(Number(ctx.order.seller_payout_amount), subtotal - 10, 'seller payout = subtotal - flat fee');
    assert.equal(Number(ctx.order.platform_fee_amount), 10 + sc, 'platform fee = flat fee + service charge');
    assert.equal(Number(ctx.order.total_quantity), 3);

    const { rows: items } = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id', [ctx.order.id]);
    assert.equal(items.length, 2, 'one order_items row per distinct product');
    const { rows: [pay] } = await pool.query('SELECT id FROM payments WHERE order_id = $1', [ctx.order.id]);
    assert.ok(pay, 'a payment row was created');
  });

  test('creator commission is resolved, persisted, and funded by the seller (buyer pays the same)', async (t) => {
    const ctx = {};
    t.after(() => cleanupCheckout(ctx));
    ctx.seller = await createSeller({});
    ctx.buyer = await createBuyer({});
    ctx.creator = await createCreator({});
    const link = await createSellerCreatorLink({ sellerId: ctx.seller.id, creatorId: ctx.creator.id, commissionRate: 0.05 });
    const p1 = await createProduct(ctx.seller.id, 1400);
    ctx.products = [p1];

    const token = `bagc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await initiateProductPayment({
      buyer: buyerInput(ctx.buyer),
      items: [{ productId: p1.id, quantity: 1 }],
      metadata: { creator_code: link.code }, location: {}, idempotencyKey: token
    }, { providerClient: mockProvider });

    ctx.order = await orderByToken(token);
    const subtotal = 1400;
    const sc = computeServiceCharge(subtotal);
    const commission = Math.round(subtotal * 0.05 * 100) / 100; // 70

    const attribution = ctx.order.metadata?.creator_attribution;
    assert.ok(attribution, 'creator_attribution persisted on the order');
    assert.equal(Number(attribution.creator_id), ctx.creator.id);
    assert.equal(Number(attribution.commission_amount), commission, 'commission = 5% of full subtotal');

    // Seller funds the commission; buyer total is unchanged by it.
    assert.equal(Number(ctx.order.total_amount), subtotal + sc, 'buyer pays subtotal + service charge — commission NOT added');
    assert.equal(Number(ctx.order.seller_payout_amount), subtotal - commission - 10, 'seller payout absorbs the commission');
    // Accounting invariant on the persisted order (no delivery here).
    assert.equal(
      Number(ctx.order.total_amount),
      Number(ctx.order.seller_payout_amount) + commission + Number(ctx.order.platform_fee_amount),
      'buyerTotal = sellerPayout + commission + platformFee'
    );
  });

  test('checkout is idempotent — the same token returns the same order', async (t) => {
    const ctx = {};
    t.after(() => cleanupCheckout(ctx));
    ctx.seller = await createSeller({});
    ctx.buyer = await createBuyer({});
    const p1 = await createProduct(ctx.seller.id, 500);
    ctx.products = [p1];

    const token = `bagi-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const input = { buyer: buyerInput(ctx.buyer), items: [{ productId: p1.id, quantity: 1 }], metadata: {}, location: {}, idempotencyKey: token };

    await initiateProductPayment(input, { providerClient: mockProvider });
    await initiateProductPayment(input, { providerClient: mockProvider });

    ctx.order = await orderByToken(token);
    const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM product_orders WHERE client_checkout_token = $1', [token]);
    assert.equal(n, 1, 'exactly one order for the repeated checkout token');
  });

  test('a bag with items from two different sellers is rejected', async (t) => {
    const ctx = { products: [] };
    let seller2;
    t.after(async () => { await cleanupCheckout(ctx); if (seller2) await cleanupSeller(seller2.id).catch(() => {}); });
    ctx.seller = await createSeller({});
    seller2 = await createSeller({});
    ctx.buyer = await createBuyer({});
    const p1 = await createProduct(ctx.seller.id, 300);
    const p2 = await createProduct(seller2.id, 300);
    ctx.products = [p1, p2];

    await assert.rejects(
      () => initiateProductPayment({
        buyer: buyerInput(ctx.buyer),
        items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
        metadata: {}, location: {}, idempotencyKey: `bagx-${Date.now()}`
      }, { providerClient: mockProvider }),
      /same seller/i
    );
  });
});
