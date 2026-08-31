// Authoritative pricing/creator-commission tests (pure unit, no DB).
// Proves the Byblos money model and the accounting invariant:
//   buyerTotal = sellerPayout + creatorCommission + platformFee + delivery
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOrderFinancials,
  computeCreatorCommission,
  computeServiceCharge,
  PLATFORM_SELLER_FEE,
} from '../src/domains/payments/payments/checkoutPricing.js';

const SUBTOTAL = 999;

function assertIdentity(f) {
  assert.equal(
    f.buyerTotal,
    Math.round((f.sellerPayout + f.creatorCommission + f.platformFee + f.deliveryFee) * 100) / 100,
    'buyerTotal must equal sellerPayout + creatorCommission + platformFee + delivery'
  );
}

describe('checkout pricing — authoritative money model', () => {
  it('flat platform seller fee is KES 10', () => {
    assert.equal(PLATFORM_SELLER_FEE, 10);
  });

  it('service charge = ceil(subtotal × 2%) → KES 20 for 999', () => {
    assert.equal(computeServiceCharge(999), 20);
  });

  it('creator commission uses the FULL subtotal, never subtotal − 10', () => {
    // 999 × 1% = 9.99 (full subtotal). Would be 9.89 if it used 989.
    assert.equal(computeCreatorCommission(999, 0.01), 9.99);
    assert.notEqual(computeCreatorCommission(999, 0.01), 9.89);
    // 999 × 5% = 49.95
    assert.equal(computeCreatorCommission(999, 0.05), 49.95);
  });

  it('no creator: 999 → service 20, platform 30, payout 989, buyer 1019', () => {
    const f = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: 0 });
    assert.equal(f.serviceCharge, 20);
    assert.equal(f.platformFee, 30);
    assert.equal(f.sellerPayout, 989);
    assert.equal(f.buyerTotal, 1019);
    assertIdentity(f);
  });

  it('creator @1%: commission 9.99, payout 979.01, platform 30, buyer 1019', () => {
    const cc = computeCreatorCommission(SUBTOTAL, 0.01);
    const f = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: cc });
    assert.equal(f.creatorCommission, 9.99);
    assert.equal(f.sellerPayout, 979.01);
    assert.equal(f.platformFee, 30); // excludes creator commission
    assert.equal(f.buyerTotal, 1019); // creator commission does NOT increase buyer total
    assertIdentity(f);
  });

  it('creator @5%: commission 49.95, payout 939.05, platform 30, buyer 1019', () => {
    const cc = computeCreatorCommission(SUBTOTAL, 0.05);
    const f = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: cc });
    assert.equal(f.creatorCommission, 49.95);
    assert.equal(f.sellerPayout, 939.05);
    assert.equal(f.platformFee, 30);
    assert.equal(f.buyerTotal, 1019);
    assertIdentity(f);
  });

  it('creator commission is deducted from seller payout; KES 10 is deducted separately', () => {
    const cc = computeCreatorCommission(SUBTOTAL, 0.05);
    const withCreator = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: cc });
    const noCreator = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: 0 });
    // Difference in payout equals exactly the creator commission (KES 10 unchanged).
    assert.equal(Math.round((noCreator.sellerPayout - withCreator.sellerPayout) * 100) / 100, cc);
    assert.equal(noCreator.sellerPayout, SUBTOTAL - PLATFORM_SELLER_FEE);
  });

  it('creator commission is excluded from platform_fee_amount', () => {
    const cc = computeCreatorCommission(SUBTOTAL, 0.05);
    const withCreator = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: cc });
    const noCreator = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: 0 });
    assert.equal(withCreator.platformFee, noCreator.platformFee);
  });

  it('delivery increases buyer total only; not payout, not platform fee', () => {
    const base = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: 0, deliveryFee: 0 });
    const withDelivery = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: 0, deliveryFee: 200 });
    assert.equal(withDelivery.buyerTotal, base.buyerTotal + 200);
    assert.equal(withDelivery.sellerPayout, base.sellerPayout);
    assert.equal(withDelivery.platformFee, base.platformFee);
    assertIdentity(withDelivery);
  });

  it('accounting identity holds with creator + delivery combined', () => {
    const cc = computeCreatorCommission(SUBTOTAL, 0.03);
    const f = deriveOrderFinancials({ subtotal: SUBTOTAL, creatorCommission: cc, deliveryFee: 350 });
    assertIdentity(f);
  });
});
