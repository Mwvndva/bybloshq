// Fulfillment-type resolution (unit) — the hub-centric business rule:
// physical goods always route via the Mzigo Ego hub (COURIER, never buyer<->seller),
// services are always at the seller (BUYER_TO_SELLER), digital is DIGITAL.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFulfillmentType, FulfillmentType } from '../src/shared/utils/fulfillment.js';

const sellerWithShop = { latitude: -1.28, longitude: 36.82 };
const sellerNoShop = { latitude: null, longitude: null };

describe('resolveFulfillmentType — hub-centralized model', () => {
  it('physical goods ALWAYS route via the hub (COURIER), even when the seller has a shop', () => {
    assert.equal(resolveFulfillmentType(sellerWithShop, 'physical'), FulfillmentType.COURIER);
    assert.equal(resolveFulfillmentType(sellerNoShop, 'physical'), FulfillmentType.COURIER);
  });

  it('physical goods stay COURIER regardless of door-delivery choice (a leg-level detail)', () => {
    assert.equal(
      resolveFulfillmentType(sellerWithShop, 'physical', { delivery: { doorDelivery: true } }),
      FulfillmentType.COURIER
    );
    assert.equal(
      resolveFulfillmentType(sellerWithShop, 'physical', { delivery: { doorDelivery: false } }),
      FulfillmentType.COURIER
    );
  });

  it('a physical order NEVER resolves to buyer-to-seller (buyer never collects from the seller)', () => {
    assert.notEqual(resolveFulfillmentType(sellerWithShop, 'physical'), FulfillmentType.BUYER_TO_SELLER);
  });

  it('services are always fulfilled AT the seller (BUYER_TO_SELLER)', () => {
    assert.equal(resolveFulfillmentType(sellerWithShop, 'service'), FulfillmentType.BUYER_TO_SELLER);
    // Even the (should-not-happen) shopless service resolves to buyer-to-seller, not mobile.
    assert.equal(resolveFulfillmentType(sellerNoShop, 'service'), FulfillmentType.BUYER_TO_SELLER);
  });

  it('digital resolves to DIGITAL (by type or metadata flags)', () => {
    assert.equal(resolveFulfillmentType(sellerWithShop, 'digital'), FulfillmentType.DIGITAL);
    assert.equal(resolveFulfillmentType(sellerNoShop, 'physical', { is_digital: true }), FulfillmentType.DIGITAL);
    assert.equal(resolveFulfillmentType(sellerNoShop, 'physical', { is_virtual: true }), FulfillmentType.DIGITAL);
  });
});
