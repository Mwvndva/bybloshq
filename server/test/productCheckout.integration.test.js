// Integration tests for initiateProductPayment() -- the checkout order-creation
// path -- against a REAL database. Focused on the multi-item bag validation
// rules, which were the source of a real bug: every one of these throws was a
// plain Error, and payment.controller.js's catch block classified 400 vs 500
// by an exact-match string allowlist that didn't include most of them (same
// seller only, no services in a bag, no custom/imported in a bag, empty cart,
// bag size limit) -- so a buyer hit a generic 500 "Product payment initiation
// failed" for validation failures the frontend's own BagContext doesn't even
// prevent (e.g. adding a custom product alongside a regular physical one is
// allowed client-side, then rejected here).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import { AppError } from '../src/shared/utils/errorHandler.js';
import { createUser, createBuyer, createSeller, createProduct, cleanupProduct, cleanupSeller, cleanupBuyer, cleanupUser } from './helpers/factories.js';

const { initiateProductPayment } = await import('../src/domains/payments/payments/productCheckout.service.js');

const fakeProviderClient = {
  // The happy-path test only needs initiatePayment to resolve; it doesn't
  // exercise the real Paystack integration (that's covered by
  // withdrawals.integration.test.js's mock-server pattern for payouts, and by
  // this session's earlier manual sandbox verification for charges).
  async initiatePayment() {
    return { reference: 'fake-provider-ref-' + Date.now(), status: 'pending' };
  },
};

let sellerAUser, sellerA, buyerUser, buyer;
let physicalProduct, digitalProduct, serviceProduct, customProduct;
let sellerBUser, sellerB, otherSellerProduct;
const createdOrderIds = [];

async function makeBuyerPayload() {
  return {
    id: buyer.id,
    name: buyer.full_name,
    email: buyer.email,
    mobilePayment: buyer.mobile_payment,
  };
}

function checkoutToken(suffix) {
  return `it-checkout-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupOrderByToken(token) {
  const { rows } = await pool.query('SELECT id FROM product_orders WHERE client_checkout_token = $1', [token]);
  for (const row of rows) {
    createdOrderIds.push(row.id);
  }
}

describe('initiateProductPayment — multi-item bag validation (regression for the 500-masking bug)', () => {
  test('setup: seed a seller with physical, digital, service, and custom products, plus a buyer', async () => {
    sellerAUser = await createUser({ role: 'seller' });
    sellerA = await createSeller({ userId: sellerAUser.id });
    buyerUser = await createUser({ role: 'buyer' });
    buyer = await createBuyer({ userId: buyerUser.id });

    physicalProduct = await createProduct({ sellerId: sellerA.id, name: 'IT Physical', price: 500, productType: 'physical' });
    digitalProduct = await createProduct({ sellerId: sellerA.id, name: 'IT Digital', price: 300, productType: 'digital', isDigital: true });
    serviceProduct = await createProduct({ sellerId: sellerA.id, name: 'IT Service', price: 1000, productType: 'service' });

    const { rows } = await pool.query(
      `INSERT INTO products (seller_id, name, price, product_type, is_digital, track_inventory, is_custom_product, production_days, customization_prompt)
       VALUES ($1, 'IT Custom', 700, 'physical', false, false, true, 3, 'Describe it')
       RETURNING *`,
      [sellerA.id]
    );
    customProduct = rows[0];

    sellerBUser = await createUser({ role: 'seller' });
    sellerB = await createSeller({ userId: sellerBUser.id });
    otherSellerProduct = await createProduct({ sellerId: sellerB.id, name: 'IT Other Seller Product', price: 400, productType: 'physical' });
  });

  test('mixing a service into a multi-item bag is a 400 AppError, not a 500', async () => {
    const token = checkoutToken('service-mix');
    await assert.rejects(
      initiateProductPayment(
        {
          buyer: await makeBuyerPayload(),
          metadata: {},
          idempotencyKey: token,
          items: [
            { productId: physicalProduct.id, quantity: 1 },
            { productId: serviceProduct.id, quantity: 1 },
          ],
        },
        { providerClient: fakeProviderClient }
      ),
      (err) => {
        assert.ok(err instanceof AppError, `expected AppError, got ${err.constructor?.name}: ${err.message}`);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Services must be booked on their own/);
        return true;
      }
    );
    await cleanupOrderByToken(token);
  });

  test('mixing a custom product into a multi-item bag is a 400 AppError, not a 500 (reachable via the real UI — BagContext does not block this)', async () => {
    const token = checkoutToken('custom-mix');
    await assert.rejects(
      initiateProductPayment(
        {
          buyer: await makeBuyerPayload(),
          metadata: { customization_instructions: 'blue please' },
          idempotencyKey: token,
          items: [
            { productId: physicalProduct.id, quantity: 1 },
            { productId: customProduct.id, quantity: 1 },
          ],
        },
        { providerClient: fakeProviderClient }
      ),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Custom and imported products must be bought on their own/);
        return true;
      }
    );
    await cleanupOrderByToken(token);
  });

  test('mixing products from two different sellers is a 400 AppError, not a 500', async () => {
    const token = checkoutToken('cross-seller');
    await assert.rejects(
      initiateProductPayment(
        {
          buyer: await makeBuyerPayload(),
          metadata: {},
          idempotencyKey: token,
          items: [
            { productId: physicalProduct.id, quantity: 1 },
            { productId: otherSellerProduct.id, quantity: 1 },
          ],
        },
        { providerClient: fakeProviderClient }
      ),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /same seller/);
        return true;
      }
    );
    await cleanupOrderByToken(token);
  });

  test('an empty items array is a 400 AppError, not a 500', async () => {
    const token = checkoutToken('empty');
    await assert.rejects(
      initiateProductPayment(
        { buyer: await makeBuyerPayload(), metadata: {}, idempotencyKey: token, items: [] },
        { providerClient: fakeProviderClient }
      ),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('more than 5 raw line entries is a 400 AppError, not a 500', async () => {
    const token = checkoutToken('toomany');
    const items = Array.from({ length: 6 }, () => ({ productId: physicalProduct.id, quantity: 1 }));
    await assert.rejects(
      initiateProductPayment(
        { buyer: await makeBuyerPayload(), metadata: {}, idempotencyKey: token, items },
        { providerClient: fakeProviderClient }
      ),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /at most 5 products/);
        return true;
      }
    );
  });

  test('a valid physical + digital mixed bag succeeds and creates a PHYSICAL order', async () => {
    const token = checkoutToken('valid-mix');
    const result = await initiateProductPayment(
      {
        buyer: await makeBuyerPayload(),
        metadata: {},
        idempotencyKey: token,
        items: [
          { productId: physicalProduct.id, quantity: 1 },
          { productId: digitalProduct.id, quantity: 1 },
        ],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(result.success, true);
    createdOrderIds.push(result.orderId);

    const { rows } = await pool.query(
      'SELECT order_type, fulfillment_type, total_quantity FROM product_orders WHERE id = $1',
      [result.orderId]
    );
    assert.equal(rows[0].order_type, 'PHYSICAL');
    assert.equal(rows[0].total_quantity, 2);
  });

  test('a custom product bought on its own (single-item) succeeds', async () => {
    const token = checkoutToken('custom-solo');
    const result = await initiateProductPayment(
      {
        buyer: await makeBuyerPayload(),
        metadata: { customization_instructions: 'red, size M' },
        idempotencyKey: token,
        items: [{ productId: customProduct.id, quantity: 1 }],
      },
      { providerClient: fakeProviderClient }
    );
    assert.equal(result.success, true);
    createdOrderIds.push(result.orderId);
  });

  test('a custom product without customization instructions is a 400 AppError', async () => {
    const token = checkoutToken('custom-no-instructions');
    await assert.rejects(
      initiateProductPayment(
        { buyer: await makeBuyerPayload(), metadata: {}, idempotencyKey: token, items: [{ productId: customProduct.id, quantity: 1 }] },
        { providerClient: fakeProviderClient }
      ),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Customization instructions are required/);
        return true;
      }
    );
  });
});

after(async () => {
  for (const orderId of createdOrderIds) {
    await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]);
  }
  await cleanupProduct(customProduct?.id);
  await cleanupProduct(serviceProduct?.id);
  await cleanupProduct(digitalProduct?.id);
  await cleanupProduct(physicalProduct?.id);
  await cleanupProduct(otherSellerProduct?.id);
  await cleanupBuyer(buyer?.id);
  await cleanupSeller(sellerA?.id);
  await cleanupSeller(sellerB?.id);
  await cleanupUser(buyerUser?.id);
  await cleanupUser(sellerAUser?.id);
  await cleanupUser(sellerBUser?.id);
});
