// Pure-logic unit tests for the authoritative checkout pricing + creator
// commission derivation (no DB). The load-bearing rule is the accounting
// invariant: buyerTotal === sellerPayout + creatorCommission + platformFee +
// deliveryFee. Commission is seller-funded and must never inflate what the
// buyer pays.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOrderFinancials,
  computeCreatorCommission,
  computeServiceCharge,
  roundMoney,
  PLATFORM_SELLER_FEE
} from '../src/domains/payments/payments/checkoutPricing.js';

const invariantHolds = (f, delivery = 0) =>
  roundMoney(f.buyerTotal) === roundMoney(f.sellerPayout + f.creatorCommission + f.platformFee + delivery);

describe('computeCreatorCommission', () => {
  test('is round(subtotal × agreed rate)', () => {
    assert.equal(computeCreatorCommission(1400, 0.05), 70);
    assert.equal(computeCreatorCommission(1000, 0.1), 100);
  });
  test('is zero with no/zero/negative rate', () => {
    assert.equal(computeCreatorCommission(1000, 0), 0);
    assert.equal(computeCreatorCommission(1000, undefined), 0);
    assert.equal(computeCreatorCommission(1000, -0.5), 0);
  });
  test('uses the FULL subtotal (not subtotal − fee)', () => {
    // 5% of 2000 is 100, not 5% of (2000-10).
    assert.equal(computeCreatorCommission(2000, 0.05), 100);
  });
});

describe('deriveOrderFinancials', () => {
  test('no commission, no delivery — seller keeps subtotal minus the flat fee', () => {
    const f = deriveOrderFinancials({ subtotal: 1000 });
    const sc = computeServiceCharge(1000);
    assert.equal(f.serviceCharge, sc);
    assert.equal(f.platformFee, PLATFORM_SELLER_FEE + sc);
    assert.equal(f.sellerPayout, 1000 - PLATFORM_SELLER_FEE);
    assert.equal(f.buyerTotal, 1000 + sc);
    assert.ok(invariantHolds(f));
  });

  test('commission is deducted from the seller, NOT added to the buyer', () => {
    const withOut = deriveOrderFinancials({ subtotal: 1400 });
    const withCommission = deriveOrderFinancials({ subtotal: 1400, creatorCommission: 70 });
    // Buyer pays the same either way — commission is seller-funded.
    assert.equal(withCommission.buyerTotal, withOut.buyerTotal);
    // Seller absorbs the commission.
    assert.equal(withCommission.sellerPayout, withOut.sellerPayout - 70);
    assert.equal(withCommission.creatorCommission, 70);
    // Platform fee is unchanged — it excludes the seller-funded commission.
    assert.equal(withCommission.platformFee, withOut.platformFee);
    assert.ok(invariantHolds(withCommission));
  });

  test('delivery passes through to the buyer total and the invariant', () => {
    const f = deriveOrderFinancials({ subtotal: 1000, deliveryFee: 150, creatorCommission: 50 });
    assert.equal(f.buyerTotal, 1000 + f.serviceCharge + 150);
    assert.equal(f.sellerPayout, 1000 - 50 - PLATFORM_SELLER_FEE);
    assert.ok(invariantHolds(f, 150));
  });

  test('the accounting invariant holds across many combinations', () => {
    for (const subtotal of [50, 100, 333, 999, 1400, 25000]) {
      for (const rate of [0, 0.01, 0.05, 0.1, 0.25]) {
        for (const deliveryFee of [0, 100, 337]) {
          const commission = computeCreatorCommission(subtotal, rate);
          const f = deriveOrderFinancials({ subtotal, deliveryFee, creatorCommission: commission });
          assert.ok(
            invariantHolds(f, deliveryFee),
            `invariant broke for subtotal=${subtotal} rate=${rate} delivery=${deliveryFee}`
          );
        }
      }
    }
  });
});
